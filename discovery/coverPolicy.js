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
  const words = value => ' ' + normalizeGameText(value).replace(/[^\p{L}\p{N}]+/gu, ' ').trim() + ' ';
  if (!title || !edition || words(title).includes(words(edition))) return title;
  return title + ' ' + edition;
}

function fitsPortraitSlot({ width, height } = {}) {
  // The slot is portrait. A verified physical front can be wide and is contained, not cropped.
  return Number.isFinite(width) && Number.isFinite(height) &&
    Math.min(width, height) >= 64 && Math.max(width, height) <= 12_000 &&
    width / height >= 0.35 && width / height <= 2.4;
}

module.exports = { frontCoverUrl, coverLookupTitle, fitsPortraitSlot };
