const { normalizeGameText } = require('../discovery/model');

const aliases = {
  gamecube: 'nintendo gamecube',
  wii: 'nintendo wii',
  'wii u': 'nintendo wii u',
  'xbox series s/x': 'microsoft xbox series x',
  'xbox series x': 'microsoft xbox series x',
};

function platformName(value) {
  const name = normalizeGameText(value).replace(/^(sony|microsoft) /, '');
  return aliases[name]?.replace(/^microsoft /, '') || name;
}

function selectFrontCover(payload, title, platformId) {
  const games = payload?.data?.games;
  if (!Array.isArray(games) || payload?.pages?.next) return {};
  const matching = games.filter(game => Number(game.platform) === platformId &&
    normalizeGameText(game.game_title) === normalizeGameText(title));
  if (matching.length !== 1) return {};
  const boxart = payload.include?.boxart;
  const images = boxart?.data?.[matching[0].id];
  const front = Array.isArray(images) && images.find(image =>
    image.type === 'boxart' && image.side === 'front' &&
    /^boxart\/front\/[\w.-]+\.(?:png|jpe?g|webp)$/i.test(image.filename));
  const base = boxart?.base_url?.original;
  if (front && /^https:\/\/cdn\.thegamesdb\.net\/images\/[\w/-]*\/$/i.test(base)) {
    return { coverArtUrl: new URL(front.filename, base).href, coverArtSource: 'thegamesdb' };
  }
  return {};
}

function createCoverLookup({ key, fetchArtwork = fetch }) {
  let platforms;
  let pausedUntil = 0;
  async function read(path, params = {}) {
    const url = new URL('/v1/' + path, 'https://api.thegamesdb.net');
    url.search = new URLSearchParams({ apikey: key, ...params });
    const response = await fetchArtwork(url, { redirect: 'error', signal: AbortSignal.timeout(3200) });
    if ([403, 429].includes(response.status)) pausedUntil = Date.now() + 60_000;
    if (!response.ok) throw Error('Cover lookup unavailable');
    return response.json();
  }

  return async (title, platform) => {
    if (!key || Date.now() < pausedUntil) return null;
    platforms ||= read('Platforms').then(payload => Object.values(payload.data.platforms))
      .catch(error => { platforms = undefined; throw error; });
    const names = (await platforms).filter(item => platformName(item.name) === platformName(platform));
    if (names.length !== 1 || !Number.isSafeInteger(Number(names[0].id))) return {};
    const id = Number(names[0].id);
    const payload = await read('Games/ByGameName', {
      name: title, include: 'boxart', 'filter[platform]': String(id),
    });
    return selectFrontCover(payload, title, id);
  };
}

module.exports = { createCoverLookup, selectFrontCover };
