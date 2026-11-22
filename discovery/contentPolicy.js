const normalize = value => String(value || '').normalize('NFKC').toLowerCase()
  .replace(/[’‘]/g, "'").replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();

const explicitCategories = new Set([
  'hentai', 'porn', 'pornographic', 'pornography', 'explicit sexual content',
  'explicit sex', 'sex simulator', 'adult only sexual content',
]);
const explicitTitle = /\b(?:hentai|pornographic|pornography|porn game|sex simulator)\b/i;

function classifyExplicit(game) {
  const categories = [game.tags, game.genres].flatMap(items =>
    Array.isArray(items) ? items.flatMap(item => [item?.slug, item?.name].map(normalize)) : []);
  if (categories.some(category => explicitCategories.has(category))) return true;
  const rating = normalize(game.esrb_rating?.slug || game.esrb_rating?.name);
  if (['adults only', 'adults only 18+', 'ao'].includes(rating) &&
      categories.some(category => ['sexual content', 'strong sexual content'].includes(category))) return true;
  return explicitTitle.test(normalize(game.name)) ||
    /\b(?:contains|features) (?:graphic|explicit) sexual (?:content|scenes|activity)\b/i
      .test(game.description_raw || game.description || '');
}

function discoveryIntent(search, exact = false) {
  if (!normalize(search)) return 'safe';
  if (exact) return 'exact';
  const category = normalize(search).replace(/ games?$/, '');
  return explicitCategories.has(category) ? 'explicit' : 'safe';
}

function permitsGame(game, search, intent = 'safe') {
  if (intent === 'exact') return normalize(game.title) === normalize(search);
  if (!game.explicitContent) return true;
  return intent === 'explicit' && discoveryIntent(search) === 'explicit';
}

module.exports = { classifyExplicit, discoveryIntent, permitsGame };
