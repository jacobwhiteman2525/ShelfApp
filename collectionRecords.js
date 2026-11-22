const { fillMetadata, normalizeGameText, sameGame } = require('./discovery/model');

function readSavedRecords(collection, wishlist, seed) {
  const library = collection === null ? seed() : JSON.parse(collection);
  const wanted = wishlist === null ? [] : JSON.parse(wishlist);
  if (!Array.isArray(library?.games) || !Array.isArray(library?.shelves) ||
      library.games.some(game => typeof game?.id !== 'string' || typeof game.title !== 'string') ||
      library.shelves.some(shelf => typeof shelf?.id !== 'string' ||
        typeof shelf.name !== 'string' || !Array.isArray(shelf.ids)) ||
      !Array.isArray(wanted) || wanted.some(game =>
        typeof game?.id !== 'string' || typeof game.title !== 'string')) {
    throw Error('Invalid saved ShelfVault data');
  }
  return { library, wishlist: wanted };
}

function savedGame(game) {
  const { platforms, availablePlatforms, ...record } = game;
  return record;
}

function collectGame(library, game, wish, newId, shelfId) {
  if (library.games.some(item => sameGame(item, game))) return library;

  const id = wish && !library.games.some(item => item.id === wish.id) ? wish.id : newId;
  const record = savedGame(wish ? fillMetadata(wish, game) : game);
  if (game.providerId && !record.providerId) {
    Object.assign(record, {
      provider: game.provider, providerId: game.providerId, platformId: game.platformId,
    });
  }
  const shelf = library.shelves.find(item =>
    normalizeGameText(item.name) === normalizeGameText(record.platform));
  return {
    ...library,
    games: [...library.games, { ...record, id, owned: true, notes: record.notes ?? '' }],
    shelves: shelf
      ? library.shelves.map(item => item.id === shelf.id ? { ...item, ids: [...item.ids, id] } : item)
      : [...library.shelves, { id: shelfId, name: record.platform, ids: [id] }],
  };
}

module.exports = { readSavedRecords, savedGame, collectGame };
