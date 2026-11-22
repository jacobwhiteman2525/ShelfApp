const assert = require('node:assert/strict');
const test = require('node:test');
const { once } = require('node:events');
const {
  normalizeGame, sameGame, availablePlatforms, mergePages, linkMetadata, selectPlatform,
} = require('../discovery/model');
const { gameQuery } = require('../discovery/queries');
const { createCache, CACHE_KEY } = require('../discovery/cache');
const { readSavedRecords, collectGame, linkSavedGame, enrichSavedGame } = require('../collectionRecords');
const { findSavedMatch } = require('../discovery/savedMatch');
const { createProxy } = require('../server/rawg-proxy');
const { classifyExplicit, discoveryIntent, permitsGame } = require('../discovery/contentPolicy');
const { createCoverLookup, selectFrontCover } = require('../server/cover-art');
const { coverLookupTitle, fitsPortraitSlot, frontCoverUrl } = require('../discovery/coverPolicy');
const { createArtworkStore } = require('../discovery/artworkStore');

const switchPlatform = { id: 7, name: 'Nintendo Switch' };
const pcPlatform = { id: 4, name: 'PC' };

test('saved lookup accepts one platform-matched title, punctuation, and a verified bundle alias', async () => {
  const saved = { title: 'Pikmin 1+2', platform: 'Nintendo Switch' };
  const candidate = { providerId: 10, title: 'Pikmin™ 1 & 2 Bundle', platforms: [switchPlatform] };
  const search = async title => ({ data: { results: title.includes('Bundle') ? [candidate] : [], hasMore: false } });
  assert.deepEqual(await findSavedMatch(saved, search), {
    kind: 'match', options: [{ candidate, platform: switchPlatform }],
  });
  const regional = { ...candidate, title: 'ピクミン１＋２' };
  assert.equal((await findSavedMatch(saved, async () => ({
    data: { results: [regional], hasMore: false },
  }))).kind, 'match');
});

test('saved lookup requires confirmation for multiple candidates, incomplete results, or edition conflicts', async () => {
  const saved = { title: 'Example: Remastered', platform: 'Switch' };
  const candidate = { providerId: 10, title: 'Example – Remastered', platforms: [switchPlatform] };
  const find = (results, hasMore = false, entry = saved) =>
    findSavedMatch(entry, async () => ({ data: { results, hasMore } }));
  assert.equal((await find([candidate, { ...candidate, providerId: 11 }])).kind, 'confirm');
  assert.equal((await find([candidate], true)).kind, 'confirm');
  assert.equal((await find([candidate], false, { ...saved, edition: 'Collector’s Edition' })).kind, 'confirm');
  assert.equal((await find([{ ...candidate, platforms: [pcPlatform] }])).kind, 'none');
  assert.equal((await find([{ ...candidate, title: 'Example' }])).kind, 'none');
  assert.equal((await find([])).kind, 'none');
});

test('saved lookup handles offline and stops scheduling requests after the detail closes', async () => {
  const saved = { title: 'Pikmin 1+2', platform: 'Nintendo Switch' };
  assert.deepEqual(await findSavedMatch(saved, async () => { throw Error('Offline'); }), {
    kind: 'unavailable', warning: 'Offline',
  });
  const candidate = { providerId: 10, title: saved.title, platforms: [switchPlatform] };
  assert.equal((await findSavedMatch(saved, async () => ({
    warning: 'Offline', data: { results: [candidate], hasMore: false },
  }))).kind, 'confirm');
  let active = true;
  let calls = 0;
  await findSavedMatch(saved, async () => {
    calls += 1;
    active = false;
    return { data: { results: [] } };
  }, () => active);
  assert.equal(calls, 1);
});

test('saved links prevent duplicates and persist enrichment without altering personal data', () => {
  const record = { id: 'mine', title: 'My title', platform: 'Nintendo Switch', notes: 'keep', description: 'Personal' };
  const candidate = { provider: 'rawg', providerId: 10, title: 'Canonical', platforms: [switchPlatform] };
  const games = [record];
  assert.equal(linkSavedGame(games, [{ ...record, title: candidate.title }], record.id, candidate, switchPlatform), games);
  const linked = linkSavedGame(games, [], record.id, candidate, switchPlatform);
  assert.equal(linkSavedGame(linked, [], record.id, candidate, switchPlatform), linked);
  assert.equal(enrichSavedGame(linked, record.id, { ...candidate, providerId: 11 }), linked);
  const enriched = enrichSavedGame(linked, record.id, { ...candidate, description: 'Provider', rawgRating: 4 });
  const shelves = [{ id: 'shelf', name: 'My shelf', ids: [record.id] }];
  const stored = readSavedRecords(JSON.stringify({ games: enriched, shelves, sort: 'custom' }),
    JSON.stringify(enriched), () => assert.fail());
  assert.deepEqual(stored.library.shelves, shelves);
  assert.equal(stored.library.sort, 'custom');
  assert.deepEqual(stored.library.games[0], { ...record, provider: 'rawg', providerId: 10, platformId: 7, rawgRating: 4 });
  assert.deepEqual(stored.wishlist, enriched);
});
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
  assert.equal(selectFrontCover(result, fixture.name, 10).status, 'platform_mismatch');
  assert.equal(selectFrontCover({ ...result, pages: { next: 'more' } }, fixture.name, 9).status, 'ambiguous_match');
  assert.deepEqual(selectFrontCover({
    ...result, data: { games: [...result.data.games, { ...result.data.games[0], id: 16 }] },
  }, fixture.name, 9), { status: 'ambiguous_match' });
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
    coverArtSource: 'thegamesdb', coverArtKind: 'physical-front',
    coverArtTitle: fixture.name, coverArtPlatform: 'PlayStation 4',
    status: 'resolved', providerGameId: 15, providerPlatformId: 9, providerStatus: 200,
  });
  assert.equal(frontCoverUrl(cover, fixture.name, 'Nintendo Switch'), undefined);
  assert.equal(urls[1].searchParams.get('filter[platform]'), '9');
  assert.ok(!JSON.stringify(cover).includes('fixture-cover-key'));
  assert.equal((await createCoverLookup({})(fixture.name, 'PlayStation 4')).status, 'provider_not_configured');
});

test('physical slots reject promotional, legacy, and unverified assets and contain genuine wide fronts', () => {
  const title = 'Banjo-Kazooie';
  const platform = 'Nintendo 64';
  const rawgImage = 'https://media.rawg.io/media/screenshot.jpg';
  const cover = {
    coverArtKind: 'physical-front', coverArtSource: 'thegamesdb',
    coverArtTitle: title, coverArtPlatform: platform,
    coverArtUrl: 'https://cdn.thegamesdb.net/images/original/boxart/front/fixture.jpg',
  };
  assert.equal(frontCoverUrl({ coverUrl: rawgImage, backgroundImageUrl: rawgImage }, title, platform), undefined);
  assert.equal(frontCoverUrl({ coverArtUrl: cover.coverArtUrl }, title, platform), undefined);
  assert.equal(frontCoverUrl({ ...cover, coverArtUrl: rawgImage }, title, platform), undefined);
  assert.equal(frontCoverUrl({ ...cover, coverArtUrl: cover.coverArtUrl.replace('boxart/front', 'screenshots') },
    title, platform), undefined);
  assert.equal(frontCoverUrl(cover, title, 'Xbox 360'), undefined);
  assert.equal(frontCoverUrl(cover, title, platform), cover.coverArtUrl);
  assert.equal(fitsPortraitSlot({ width: 1600, height: 900 }), true);
  assert.equal(fitsPortraitSlot({ width: 1600, height: 100 }), false);
  assert.equal(fitsPortraitSlot({ width: 600, height: 600 }), true);
  assert.equal(fitsPortraitSlot({ width: 600, height: 900 }), true);
  assert.equal(fitsPortraitSlot({ width: 0, height: 900 }), false);
  assert.equal(coverLookupTitle({ title: 'Pikmin 1+2', edition: 'Collector’s Edition' }), 'Pikmin 1+2 Collector’s Edition');
});

test('TheGamesDB cover lookup rejects screenshots and indistinguishable regional records', () => {
  const title = 'Pikmin 1+2';
  const row = { id: 100, game_title: title, platform: 7 };
  const payload = {
    data: { games: [row] },
    include: { boxart: {
      base_url: { original: 'https://cdn.thegamesdb.net/images/original/' },
      data: { 100: [{ side: 'front', type: 'screenshot', filename: 'boxart/front/fixture.jpg' }] },
    } },
  };
  assert.equal(selectFrontCover(payload, title, 7, 'Nintendo Switch').status, 'no_front_cover');
  payload.include.boxart.data[100][0].type = 'boxart';
  assert.equal(selectFrontCover(payload, title, 7, 'Nintendo Switch').coverArtPlatform, 'Nintendo Switch');
  payload.data.games.push({ ...row, id: 101, region_id: 2 });
  assert.equal(selectFrontCover(payload, title, 7, 'Nintendo Switch').status, 'ambiguous_match');
});

test('cover matching keeps editions, ports and compilations distinct and allows known alternate titles', () => {
  const rows = [
    [1, 'Tomb Raider', 9, ['Tomb Raider: Definitive Edition']],
    [2, 'TOMB RAIDER – Definitive Edition', 9, []],
    [3, 'Astral Chain', 7, []],
    [4, 'Astro Bot', 12, []],
    [5, 'Grand Theft Auto V', 9, []],
    [6, 'Grand Theft Auto V', 12, []],
    [7, 'Banjo Kazooie', 3, []],
    [8, 'Pikmin 2', 7, ['Pikmin 1+2']],
    [9, 'The Witcher 3: Wild Hunt Complete Edition', 9, ['The Witcher 3: Wild Hunt']],
  ];
  const payload = {
    data: { games: rows.map(([id, game_title, platform, alternates]) => ({ id, game_title, platform, alternates })) },
    include: { boxart: {
      base_url: { original: 'https://cdn.thegamesdb.net/images/original' },
      data: Object.fromEntries(rows.map(([id]) => [id,
        [{ type: 'boxart', side: 'front', filename: `boxart/front/${id}.jpg` }]])),
    } },
  };
  for (const [title, platformId, platform, gameId] of [
    ['Tomb Raider: Definitive Edition', 9, 'PlayStation 4', 2],
    ['Astral Chain', 7, 'Nintendo Switch', 3],
    ['Astro Bot', 12, 'PlayStation 5', 4],
    ['GTA 5', 9, 'PlayStation 4', 5],
    ['Grand Theft Auto V', 12, 'PlayStation 5', 6],
    ['Banjo-Kazooie', 3, 'Nintendo 64', 7],
  ]) {
    const cover = selectFrontCover(payload, title, platformId, platform);
    assert.equal(cover.providerGameId, gameId);
    assert.ok(frontCoverUrl(cover, title, platform));
  }
  assert.equal(selectFrontCover(payload, 'Pikmin 1+2', 7, 'Nintendo Switch').status, 'no_matching_game');
  assert.equal(selectFrontCover(payload, 'The Witcher 3: Wild Hunt', 9, 'PlayStation 4').status, 'no_matching_game');
  payload.include.boxart.base_url.original = 'https://untrusted.example/images/original/';
  assert.equal(selectFrontCover(payload, 'Astro Bot', 12, 'PlayStation 5').status, 'image_url_rejected');
});

test('provider failures and exhausted quota are reported separately from missing covers', async () => {
  let calls = 0;
  const quota = createCoverLookup({
    key: 'fixture', fetchArtwork: async () => {
      calls++;
      return Response.json({ remaining_monthly_allowance: 0 }, { status: 403 });
    },
  });
  assert.equal((await quota('Astral Chain', 'Switch')).status, 'rate_limited');
  assert.equal((await quota('Astro Bot', 'PS5')).providerStatus, 403);
  assert.equal(calls, 1);
  const denied = createCoverLookup({
    key: 'fixture', fetchArtwork: async () => Response.json({}, { status: 403 }),
  });
  assert.equal((await denied('Astral Chain', 'Nintendo Switch')).status, 'provider_denied');
});

test('cover cache shares requests, expires misses, rejects old URLs, and recovers after provider configuration changes', async () => {
  let time = 0;
  let calls = 0;
  const disk = new Map();
  const cache = createCache({ getItem: key => disk.get(key), setItem: (key, value) => disk.set(key, value) }, {
    now: () => time, key: 'covers',
  });
  const title = 'Astral Chain';
  const platform = 'Nintendo Switch';
  const good = {
    status: 'resolved', coverArtKind: 'physical-front', coverArtSource: 'thegamesdb',
    coverArtTitle: title, coverArtPlatform: platform,
    coverArtUrl: 'https://cdn.thegamesdb.net/images/original/boxart/front/1.jpg',
  };
  let response = { status: 'no_front_cover' };
  const store = createArtworkStore(cache, async () => { calls++; return response; }, { now: () => time, spacing: 0 });
  await cache.put('physical-front:v2:art', { ...good, coverArtUrl: 'https://media.rawg.io/screen.jpg' }, 500);
  assert.equal(await store.cached('art', title, platform), null);
  const first = store.resolve('art', title, platform);
  assert.equal(store.resolve('art', title, platform), first);
  assert.equal((await first).status, 'no_front_cover');
  assert.equal((await store.resolve('art', title, platform)).cachedNegative, true);
  assert.equal(calls, 1);
  time += 300_001;
  response = { status: 'provider_not_configured', retryAfterMs: 2000 };
  assert.equal((await store.resolve('art', title, platform)).status, 'provider_not_configured');
  response = good;
  assert.equal((await store.resolve('art', title, platform)).status, 'provider_not_configured');
  time += 2001;
  assert.equal((await store.resolve('art', title, platform)).coverArtUrl, good.coverArtUrl);
  assert.equal((await store.cached('art', title, platform)).data.coverArtUrl, good.coverArtUrl);
  assert.equal(calls, 3);
});
