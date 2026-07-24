/**
 * Render <picture> blocks for travel articles.
 * Node module (Sprint 2c will require this).
 */

'use strict';

const { escapeAttr } = require('./escape');

const PICTURE_SIZES =
  '(max-width: 640px) 100vw, (max-width: 1024px) 60vw, 780px';

/**
 * Build image base path without variant suffix.
 * @param {{ imageFolder: string, imagePrefix: string }} build
 * @param {{ index: number }} photo
 * @returns {string}
 */
function imageBasePath(build, photo) {
  return (
    'images/travel/' +
    build.imageFolder +
    '/' +
    build.imagePrefix +
    photo.index
  );
}

/**
 * Build srcset string for a photo and format.
 * @param {{ imageFolder: string, imagePrefix: string }} build
 * @param {{ index: number, width: number, variants: number[] }} photo
 * @param {'avif'|'webp'} format
 * @returns {string}
 */
function buildSrcset(build, photo, format) {
  var variants = photo.variants.slice().sort(function (a, b) {
    return a - b;
  });
  var maxWidth = photo.width;
  var entries = [];

  variants.forEach(function (variantWidth) {
    if (variantWidth === maxWidth) {
      entries.push(imageBasePath(build, photo) + '.' + format + ' ' + maxWidth + 'w');
    } else {
      entries.push(
        imageBasePath(build, photo) +
          '-' +
          variantWidth +
          '.' +
          format +
          ' ' +
          variantWidth +
          'w'
      );
    }
  });

  return entries.join(', ');
}

/**
 * Render a travel-15 format <picture> block.
 * @param {{ index: number, alt: string, width: number, height: number, variants: number[] }} photo
 * @param {{ imageFolder: string, imagePrefix: string }} build
 * @param {{ isFirst?: boolean }} [options]
 * @returns {string}
 */
function renderPicture(photo, build, options) {
  options = options || {};
  var isFirst = !!options.isFirst;
  var basePath = imageBasePath(build, photo);
  var avifSrcset = buildSrcset(build, photo, 'avif');
  var webpSrcset = buildSrcset(build, photo, 'webp');
  var alt = escapeAttr(photo.alt);
  var loading = isFirst ? 'eager' : 'lazy';
  var fetchpriority = isFirst ? ' fetchpriority="high"' : '';

  return (
    '<picture>\n' +
    '  <source type="image/avif" srcset="' +
    avifSrcset +
    '" sizes="' +
    PICTURE_SIZES +
    '">\n' +
    '  <source type="image/webp" srcset="' +
    webpSrcset +
    '" sizes="' +
    PICTURE_SIZES +
    '">\n' +
    '  <img src="' +
    basePath +
    '.webp" alt="' +
    alt +
    '" class="viewer-photo" loading="' +
    loading +
    '"' +
    fetchpriority +
    ' width="' +
    photo.width +
    '" height="' +
    photo.height +
    '">\n' +
    '</picture>'
  );
}

module.exports = {
  PICTURE_SIZES: PICTURE_SIZES,
  buildSrcset: buildSrcset,
  renderPicture: renderPicture,
};
