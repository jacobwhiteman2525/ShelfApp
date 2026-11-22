const assert = require('node:assert/strict');
const test = require('node:test');
const { once } = require('node:events');
const {
  normalizeGame, sameGame, availablePlatforms, mergePages, linkMetadata, selectPlatform,
} = require('../discovery/model');
const { gameQuery } = require('../discovery/queries');
const { createCache, CACHE_KEY } = require('../discovery/cache');
const { readSavedRecords, collectGame } = require('../collectionRecords');
const { createProxy } = require('../server/rawg-proxy');
const { classifyExplicit, discoveryIntent, permitsGame } = require('../discovery/contentPolicy');
const { createCoverLookup, selectFrontCover } = require('../server/cover-art');

const switchPlatform = { id: 7, name: 'Nintendo Switch' };
const pcPlatform = { id: 4, name: 'PC' };
const fixture = {
  id: 100, name: 'Player’s Game', released: '2025-01-01',
  platforms: [switchPlatform, pcPlatform, switchPlatform].map(platform => ({ platform })),
  rating: 4.25, ratings_count: 12, metacritic: 82,
  esrb_rating: { name: 'Teen' },
  genres: [{ name: 'Adventure' }],
  developers: [{ name: 'Developer' }], publishers: [{ name: 'Publisher' }],
  background_image: 'https://media.rawg.io/media/image.jpg',
  description: '<p>Play &amp; explore &#x1f3ae;</p><script>ignored</script>',
};

test('normalizes optional provider data and never exposes HTML markup as rich text', () => {
  const game = normalizeGame(fixture);
  assert.deepEqual(game, {
    provider: 'rawg', providerId: 100, title: 'Player’s Game',
    platforms: [switchPlatform, pcPlatform],
    backgroundImageUrl: fixture.background_image, description: 'Play & explore 🎮', releaseDate: '2025-01-01',
    genre: 'Adventure', developer: 'Developer', publisher: 'Publisher', contentRating: 'Teen',
    metacriticScore: 82, rawgRating: 4.25, rawgRatingsCount: 12,
  });
});

test('prefers the plain description and omits absent ratings and TBA dates', () => {
  const game = normalizeGame({
    ...fixture, description_raw: 'Plain text', background_image: 'http://example.com/image',
    rating: 0, ratings_count: 0, metacritic: null, tba: true,
  });
  assert.equal(game.description, 'Plain text');
  assert.equal(game.rawgRating, undefined);
  assert.equal(game.metacriticScore, undefined);
  assert.equal(game.releaseDate, undefined);
  assert.equal(game.backgroundImageUrl, undefined);
  assert.equal(game.coverArtUrl, undefined);
  assert.equal(normalizeGame({}), null);
});

test('deduplicates with provider plus platform and falls back safely for older records', () => {
  const game = normalizeGame(fixture);
  const switchGame = selectPlatform(game, switchPlatform);
  const legacy = { title: "  PLAYER'S   GAME ", platform: 'nintendo switch' };
  assert.equal(sameGame(switchGame, legacy), true);
  assert.equal(sameGame(switchGame, { ...switchGame, title: 'Different name' }), true);
  assert.equal(sameGame(switchGame, { ...switchGame, providerId: 101 }), false);
  assert.equal(sameGame(switchGame, selectPlatform(game, pcPlatform)), false);
  assert.deepEqual(availablePlatforms(game, [legacy]), [pcPlatform]);
  assert.deepEqual(availablePlatforms(game, []), [switchPlatform, pcPlatform]);
});

test('reads legacy storage as-is, links only additively, and preserves personal data on transfer', () => {
  const wish = { id: 'wanted', title: "Player's Game", platform: 'Nintendo Switch', notes: 'Mine', description: 'Local' };
  const owned = { id: 'owned', title: 'Old game', platform: 'Nintendo Switch', notes: 'Keep me' };
  const existing = {
    theme: 'modern', sort: 'custom', games: [owned],
    shelves: [{ id: 'switch', name: 'Nintendo Switch', ids: ['owned'] }],
  };
  const saved = readSavedRecords(JSON.stringify(existing), JSON.stringify([wish]), () => assert.fail());
  assert.deepEqual(saved, { library: existing, wishlist: [wish] });
  assert.throws(() => readSavedRecords('{}', '[]', () => assert.fail()));
  assert.throws(() => readSavedRecords(JSON.stringify(existing), 'null', () => assert.fail()));
  const game = normalizeGame(fixture);
  const linked = linkMetadata(wish, game, switchPlatform);
  assert.deepEqual(linked, { ...linked, ...wish });
  assert.equal(linked.providerId, fixture.id);
  const library = collectGame(existing, selectPlatform(game, switchPlatform), wish, 'new', 'new-shelf');
  assert.deepEqual(library.shelves[0].ids, ['owned', 'wanted']);
  assert.deepEqual(library.games[0], owned);
  assert.equal(library.theme, existing.theme);
  assert.equal(library.sort, existing.sort);
  assert.equal(library.games[1].notes, 'Mine');
  assert.equal(library.games[1].description, 'Local');
  assert.equal(library.games[1].platformId, switchPlatform.id);
  assert.equal(collectGame(library, selectPlatform(game, switchPlatform), wish, 'dup', 'dup-shelf'), library);
});

test('combines search, platform and server ordering with local release windows', () => {
  const now = new Date(2024, 1, 29, 23, 30);
  const options = { search: ' game ', platform: 7 };
  assert.deepEqual(gameQuery({ ...options, section: 'upcoming', sort: 'upcoming' }, now), {
    search: 'game', platforms: 7, ordering: 'released', dates: '2024-02-29,2025-02-28',
  });
  assert.deepEqual(gameQuery({ ...options, section: 'new', sort: 'new' }, now), {
    search: 'game', platforms: 7, ordering: '-released', dates: '2023-03-01,2024-02-29',
  });
  for (const [sort, ordering] of [['popular', '-added'], ['top', '-rating'], ['critic', '-metacritic']]) {
    assert.equal(gameQuery({ ...options, section: 'popular', sort }, now).ordering, ordering);
  }
});

test('appends pages without duplicates and preserves provider order across ties', () => {
  const first = { providerId: 100, rawgRating: 4.2 };
  const second = { providerId: 20, rawgRating: 4.2 };
  assert.deepEqual(mergePages([first], [second, first, { ...second }, { providerId: 5 }]), [
    first, second, { providerId: 5 },
  ]);
});

test('cache keys isolate queries and details, retain expired data for fallback and bound writes', async () => {
  const disk = new Map([['shelfvault.expo.library.v1', 'owned data']]);
  const storage = { getItem: key => disk.get(key), setItem: (key, data) => disk.set(key, data) };
  let now = 1000;
  const cache = createCache(storage, { maxEntries: 2, maxChars: 350, now: () => now });
  await Promise.all([
    cache.put('/games?platforms=7&page=1', ['Switch'], 500),
    cache.put('/games/100', { title: 'Game' }, 1000),
  ]);
  now = 1600;
  const stale = await cache.get('/games?platforms=7&page=1');
  assert.ok(stale.expires < now);
  assert.deepEqual(stale.data, ['Switch']);
  assert.equal(await cache.get('/games?platforms=7&page=2'), null);
  await cache.put('/games?platforms=4&page=1', ['PC'], 500);
  await cache.put('too big', 'x'.repeat(400), 500);
  assert.equal(await cache.get('/games?platforms=7&page=1'), null);
  const restarted = createCache(storage, { now: () => now });
  assert.deepEqual((await restarted.get('/games/100')).data, { title: 'Game' });
  assert.equal(disk.get('shelfvault.expo.library.v1'), 'owned data');
  assert.ok(disk.get(CACHE_KEY).length <= 350);
  now += 15 * 24 * 60 * 60 * 1000;
  assert.equal(await restarted.get('/games/100'), null);
});

test('proxy authenticates, allowlists upstream calls, hides credentials and forwards quota status', async t => {
  const key = 'test-upstream-key';
  const token = 'test-development-proxy-token';
  const hits = [];
  const server = createProxy({
    key, token,
    fetchUpstream: async url => {
      hits.push(url);
      if (url.pathname === '/api/games/100') return Response.json(fixture);
      if (url.pathname === '/api/platforms') return Response.json({ results: [switchPlatform], next: null });
      if (url.searchParams.get('page') === '3') {
        return Response.json({ error: key }, { status: 429, headers: { 'Retry-After': '5' } });
      }
      return Response.json({ results: [fixture], next: 'https://api.rawg.io/api/games?key=' + key });
    },
  });
  t.after(() => server.close());
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port;
  const get = path => fetch(base + path, { headers: { Authorization: 'Bearer ' + token } });
  assert.equal((await fetch(base + '/games')).status, 401);
  assert.equal((await get('/games?key=override')).status, 400);
  assert.equal((await get('/games?ordering=-rating&ordering=-added')).status, 400);
  assert.equal((await get('/games/100/screenshots')).status, 400);
  assert.equal(hits.length, 0);
  const result = await (await get('/games?search=game&platforms=7&ordering=-rating&page=2')).json();
  assert.equal(result.hasMore, true);
  assert.equal(result.results[0].providerId, 100);
  assert.ok(!JSON.stringify(result).includes(key));
  assert.equal(hits[0].origin, 'https://api.rawg.io');
  assert.equal(hits[0].searchParams.get('key'), key);
  assert.equal(hits[0].searchParams.get('page'), '2');
  assert.equal(hits[0].searchParams.get('platforms'), '7');
  assert.equal((await (await get('/games/100')).json()).description, 'Play & explore 🎮');
  assert.deepEqual((await (await get('/platforms?page=1')).json()).results, [switchPlatform]);
  const limited = await get('/games?page=3');
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('retry-after'), '5');
  assert.ok(!(await limited.text()).includes(key));
  assert.equal((await get('/games')).status, 429);
  assert.equal(hits.length, 4);
});

const explicit = { ...fixture, id: 101, name: 'Fixture After Hours', tags: [{ slug: 'hentai' }] };
const mainstream = { ...fixture, esrb_rating: { slug: 'mature' }, tags: [{ slug: 'romance' }] };

test('distinguishes explicit metadata from ordinary mature themes and scopes intentional lookup', () => {
  assert.equal(classifyExplicit(explicit), true);
  assert.equal(classifyExplicit(mainstream), false);
  assert.equal(classifyExplicit({ esrb_rating: { slug: 'adults-only' }, genres: [{ name: 'Action' }] }), false);
  assert.equal(classifyExplicit({ description_raw: 'Contains graphic sexual scenes.' }), true);
  const game = normalizeGame(explicit);
  assert.equal(discoveryIntent('adult romance'), 'safe');
  assert.equal(permitsGame(game, explicit.name, discoveryIntent(explicit.name)), false);
  assert.equal(permitsGame(game, explicit.name, discoveryIntent(explicit.name, true)), true);
  assert.equal(permitsGame(game, 'Other Game', 'exact'), false);
  assert.equal(permitsGame(game, 'hentai games', discoveryIntent('hentai games')), true);
  assert.equal(permitsGame(game, 'adult romance', 'explicit'), false);
  const entry = { ...game, id: 'saved', platform: 'PC', notes: 'keep' };
  const library = { games: [entry], shelves: [] };
  const restored = readSavedRecords(JSON.stringify(library), JSON.stringify([entry]), () => assert.fail());
  assert.deepEqual(restored.library.games, [entry]);
  assert.deepEqual(restored.wishlist, [entry]);
});

test('proxy filters all browsing orders and pages while keeping exact-title lookups separate', async t => {
  const token = 'test-content-development-token';
  const server = createProxy({
    key: 'fixture', token,
    fetchUpstream: async url => {
      assert.equal(url.searchParams.has('intent'), false);
      if (url.searchParams.get('search') === explicit.name) {
        assert.equal(url.searchParams.get('search_exact'), 'true');
      }
      return Response.json({ results: [explicit, mainstream], next: 'fixture-next' });
    },
  });
  t.after(() => server.close());
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port;
  const get = async path => (await fetch(base + path, { headers: { Authorization: 'Bearer ' + token } })).json();
  for (const query of [
    'ordering=-added', 'ordering=-rating', 'ordering=-metacritic', 'platforms=7',
    'ordering=-released&dates=2024-01-01,2025-01-01', 'ordering=released&dates=2025-01-01,2026-01-01',
    'search=ordinary', 'search=romance&intent=explicit', 'page=2&intent=safe',
  ]) {
    const page = await get('/games?' + query);
    assert.deepEqual(page.results.map(item => item.providerId), [100]);
    assert.equal(page.hasMore, true);
  }
  const exact = await get('/games?intent=exact&search=' + encodeURIComponent(explicit.name));
  assert.deepEqual(exact.results.map(item => [item.providerId, item.explicitContent]), [[101, true]]);
  const category = await get('/games?intent=explicit&search=hentai');
  assert.equal(category.results[0].explicitContent, true);
  const disk = new Map();
  const cache = createCache({ getItem: key => disk.get(key), setItem: (key, value) => disk.set(key, value) });
  await cache.put('intent=safe&page=1', await get('/games?intent=safe'), 500);
  await cache.put('intent=exact&page=1', exact, 500);
  assert.deepEqual((await cache.get('intent=safe&page=1')).data.results.map(item => item.providerId), [100]);
});

test('cover lookup requires an unambiguous title and platform, and returns only front art', async () => {
  const result = {
    data: { games: [{ id: 15, game_title: fixture.name, platform: 9 }] },
    include: { boxart: {
      base_url: { original: 'https://cdn.thegamesdb.net/images/original/' },
      data: { 15: [
        { type: 'boxart', side: 'back', filename: 'boxart/back/15.jpg' },
        { type: 'boxart', side: 'front', filename: 'boxart/front/15.jpg' },
      ] },
    } },
  };
  assert.deepEqual(selectFrontCover(result, fixture.name, 10), {});
  assert.deepEqual(selectFrontCover({ ...result, pages: { next: 'more' } }, fixture.name, 9), {});
  assert.deepEqual(selectFrontCover({
    ...result, data: { games: [...result.data.games, { ...result.data.games[0], id: 16 }] },
  }, fixture.name, 9), {});
  const urls = [];
  const lookup = createCoverLookup({
    key: 'fixture-cover-key', fetchArtwork: async url => {
      urls.push(url);
      return Response.json(url.pathname.endsWith('/Platforms')
        ? { data: { platforms: { 9: { id: 9, name: 'Sony Playstation 4' } } } } : result);
    },
  });
  const cover = await lookup(fixture.name, 'PlayStation 4');
  assert.deepEqual(cover, {
    coverArtUrl: 'https://cdn.thegamesdb.net/images/original/boxart/front/15.jpg',
    coverArtSource: 'thegamesdb',
  });
  assert.equal(urls[1].searchParams.get('filter[platform]'), '9');
  assert.ok(!JSON.stringify(cover).includes('fixture-cover-key'));
  assert.equal(await createCoverLookup({})(fixture.name, 'PlayStation 4'), null);
});
