const { normalizeGameText } = require('./model');

const frontImagePattern = /^https:\/\/cdn\.thegamesdb\.net\/images\/(?:[\w-]+\/)*boxart\/front\/[\w.-]+\.(?:png|jpe?g|webp)$/i;

function frontCoverUrl(cover, title, platform) {
  return title && platform && cover?.coverArtKind === 'physical-front' && cover.coverArtSource === 'thegamesdb' &&
    cover.coverArtTitle === title && cover.coverArtPlatform === platform &&
    frontImagePattern.test(cover.coverArtUrl) ? cover.coverArtUrl : undefined;
}

function coverLookupTitle(game) {
  const title = game.title;
  const edition = typeof game.edition === 'string' ? game.edition.trim() : '';
  if (!title || !edition || normalizeGameText(title).endsWith(normalizeGameText(edition))) return title;
  return title + ' ' + edition;
}

function fitsPortraitSlot({ width, height } = {}) {
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && width <= height;
}

module.exports = { frontCoverUrl, coverLookupTitle, fitsPortraitSlot };
