const { matchingPlatforms, normalizeGameText } = require('./model');

function titleKey(value) {
  return normalizeGameText(typeof value === 'string' ? value.replace(/[™®]/g, '') : '')
    .replace(/\b(\d+)\s*(?:\+|&|and)\s*(\d+)\b/g, '$1 + $2')
    .replace(/[,:;!?().’'‐‑–—-]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Nintendo uses both names for the same Switch compilation.
const pikminBundle = ['Pikmin 1+2', 'Pikmin 1+2 Bundle', 'ピクミン1+2'];
const pikminBundleKeys = new Set([...pikminBundle, 'Pikmin 1 & 2'].map(titleKey));

function equivalentTitles(game) {
  return ['nintendo switch', 'switch'].includes(titleKey(game.platform)) &&
    pikminBundleKeys.has(titleKey(game.title))
    ? [...new Set([game.title, ...pikminBundle])]
    : [game.title];
}

function matchOptions(games, saved) {
  const options = new Map();
  for (const candidate of games) {
    for (const platform of matchingPlatforms(candidate, saved)) {
      options.set(candidate.providerId + ':' + platform.id, { candidate, platform });
    }
  }
  return [...options.values()];
}

async function findSavedMatch(saved, search, active = () => true) {
  if (!titleKey(saved.title) || !titleKey(saved.platform)) return { kind: 'none' };
  const titles = equivalentTitles(saved);
  const keys = new Set(titles.map(titleKey));
  const candidates = [];
  let incomplete = false;
  let warning;
  try {
    for (const title of titles.slice(0, 3)) {
      if (!active()) return { kind: 'none' };
      if (title.length > 120) return { kind: 'none' };
      const response = await search(title, { intent: 'exact' }, 1);
      candidates.push(...response.data.results);
      incomplete ||= response.data.hasMore;
      warning ||= response.warning;
      if (warning) break;
    }
    if (active() && !warning && !candidates.some(candidate => matchingPlatforms(candidate, saved).length &&
        keys.has(titleKey(candidate.title)))) {
      const response = await search(saved.title, {}, 1);
      candidates.push(...response.data.results);
      incomplete ||= response.data.hasMore;
      warning = response.warning;
    }
  } catch (error) {
    warning = error.message;
  }
  const options = matchOptions(candidates.filter(candidate => keys.has(titleKey(candidate.title))), saved);
  if (!options.length) return warning ? { kind: 'unavailable', warning } : { kind: 'none' };
  const [{ candidate }] = options;
  const dateConflict = typeof saved.releaseDate === 'string' && candidate.releaseDate &&
    saved.releaseDate.slice(0, 4) !== candidate.releaseDate.slice(0, 4);
  const editionConfirmed = !saved.edition || titleKey(candidate.title).includes(titleKey(saved.edition));
  if (options.length === 1 && !warning && !incomplete && !dateConflict && editionConfirmed) {
    return { kind: 'match', options };
  }
  return { kind: 'confirm', options, warning };
}

module.exports = { findSavedMatch, matchOptions };
