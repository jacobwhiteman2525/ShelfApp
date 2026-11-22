/** @typedef {{id: number, name: string}} GamePlatform */
/**
 * @typedef {Object} GameMetadata
 * @property {'rawg'} provider
 * @property {number} providerId
 * @property {string} title
 * @property {GamePlatform[]} platforms
 * @property {number} [platformId]
 * @property {string} [platform]
 * @property {string} [coverUrl]
 * @property {string} [description]
 * @property {string} [releaseDate]
 * @property {string} [genre]
 * @property {string} [developer]
 * @property {string} [publisher]
 * @property {string} [contentRating]
 * @property {number} [metacriticScore]
 * @property {number} [rawgRating]
 * @property {number} [rawgRatingsCount]
 */

const string = value => typeof value === 'string' ? value.trim() : '';
const normalizeGameText = value => string(value).normalize('NFKC')
  .replace(/\s+/g, ' ').replace(/[\u2018\u2019]/g, "'").toLowerCase();
const platformName = value => {
  const name = normalizeGameText(value);
  return name === 'gamecube' ? 'nintendo gamecube' : name;
};

function sameGame(a, b) {
  if (a.provider && a.provider === b.provider && a.providerId && b.providerId) {
    if (a.providerId !== b.providerId) return false;
    if (a.platformId && b.platformId) return a.platformId === b.platformId;
  }
  const platform = platformName(a.platform);
  return Boolean(platform && platform === platformName(b.platform) &&
    normalizeGameText(a.title) && normalizeGameText(a.title) === normalizeGameText(b.title));
}

const selectPlatform = (game, platform) => ({
  ...game, platform: platform.name, platformId: platform.id,
});

function availablePlatforms(game, tracked) {
  return game.platforms.filter(platform =>
    !tracked.some(item => sameGame(item, selectPlatform(game, platform))));
}

function mergePages(previous, next) {
  const seen = new Set(previous.map(game => game.providerId));
  return [...previous, ...next.filter(game => {
    if (seen.has(game.providerId)) return false;
    seen.add(game.providerId);
    return true;
  })];
}

const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function plainDescription(raw, html) {
  if (string(raw)) return string(raw);
  return string(html)
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#[xX][0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
      if (entity[0] !== '#') return entities[entity.toLowerCase()] ?? match;
      const point = /^#x/i.test(entity) ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : '';
    })
    .replace(/\s+/g, ' ').trim();
}

function normalizePlatform(value) {
  const name = string(value?.name);
  return Number.isInteger(value?.id) && value.id > 0 && name
    ? { id: value.id, name } : null;
}

const names = values => Array.isArray(values)
  ? values.map(value => string(value?.name)).filter(Boolean).join(', ') : '';

/** @returns {GameMetadata|null} */
function normalizeGame(value) {
  const title = string(value?.name);
  if (!title || !Number.isInteger(value.id) || value.id < 1) return null;
  const platforms = Array.isArray(value.platforms)
    ? value.platforms.map(entry => normalizePlatform(entry?.platform)).filter(Boolean) : [];
  const game = {
    provider: 'rawg', providerId: value.id, title,
    platforms: [...new Map(platforms.map(platform => [platform.id, platform])).values()],
  };
  const cover = string(value.background_image);
  const fields = {
    coverUrl: /^https:\/\/media\.rawg\.io\//i.test(cover) ? cover : '',
    description: plainDescription(value.description_raw, value.description),
    releaseDate: /^\d{4}-\d{2}-\d{2}$/.test(value.released) && !value.tba ? value.released : '',
    genre: names(value.genres),
    developer: names(value.developers),
    publisher: names(value.publishers),
    contentRating: string(value.esrb_rating?.name),
  };
  for (const [key, field] of Object.entries(fields)) {
    if (field) game[key] = field;
  }
  if (Number.isFinite(value.metacritic) && value.metacritic >= 0 && value.metacritic <= 100) {
    game.metacriticScore = value.metacritic;
  }
  if (Number.isInteger(value.ratings_count) && value.ratings_count >= 0) {
    game.rawgRatingsCount = value.ratings_count;
  }
  if (game.rawgRatingsCount > 0 && Number.isFinite(value.rating) && value.rating > 0 && value.rating <= 5) {
    game.rawgRating = value.rating;
  }
  return game;
}

const metadataFields = [
  'coverUrl', 'description', 'releaseDate', 'genre', 'developer', 'publisher',
  'contentRating', 'metacriticScore', 'rawgRating', 'rawgRatingsCount',
];

function fillMetadata(existing, incoming) {
  const result = { ...existing };
  for (const key of metadataFields) {
    if ((result[key] == null || result[key] === '') && incoming?.[key] != null) {
      result[key] = incoming[key];
    }
  }
  return result;
}

function linkMetadata(existing, candidate, platform) {
  return {
    ...fillMetadata(existing, candidate),
    provider: candidate.provider, providerId: candidate.providerId, platformId: platform.id,
  };
}

const matchingPlatforms = (candidate, game) => candidate.platforms.filter(platform =>
  platformName(platform.name) === platformName(game.platform));

module.exports = {
  normalizeGameText, sameGame, selectPlatform, availablePlatforms, mergePages,
  normalizeGame, normalizePlatform, fillMetadata, linkMetadata, matchingPlatforms,
};
