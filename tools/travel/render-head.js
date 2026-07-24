/**
 * Render head placeholders for travel article.html template.
 */

'use strict';

const { escapeHtml } = require('./escape');
const { buildSrcset, PICTURE_SIZES } = require('./render-picture');

const SITE = 'https://shumatsulog.com';
const SITE_NAME = '週末ログ';

/**
 * Build full page title with site suffix.
 * @param {string} title
 * @returns {string}
 */
function buildTitleFull(title) {
  return title + ' | ' + SITE_NAME;
}

/**
 * Render hero h2 content (allow trusted <br> in title).
 * @param {string} title
 * @returns {string}
 */
function renderHeroH2(title) {
  if (title.indexOf('<br>') !== -1) {
    return title;
  }
  return escapeHtml(title);
}

/**
 * Build preload link for first photo (avif).
 * @param {{ imageFolder: string, imagePrefix: string, photos: object[] }} build
 * @returns {string}
 */
function buildPreloadLink(build) {
  var firstPhoto = build.photos[0];
  var basePath =
    'images/travel/' +
    build.imageFolder +
    '/' +
    build.imagePrefix +
    firstPhoto.index;
  var srcset = buildSrcset(build, firstPhoto, 'avif');

  return (
    '<link rel="preload" as="image" href="' +
    basePath +
    '.avif" imagesrcset="' +
    srcset +
    '" imagesizes="' +
    PICTURE_SIZES +
    '" fetchpriority="high">'
  );
}

/**
 * Build Article JSON-LD (single line).
 * @param {Record<string, unknown>} data
 * @param {{ seo: { description: string }, ogImage: { filename: string }, imageFolder: string }} build
 * @param {string} titleFull
 * @param {string} canonicalUrl
 * @returns {string}
 */
function buildJsonLdArticle(data, build, titleFull, canonicalUrl) {
  var ogImageUrl =
    SITE +
    '/images/travel/' +
    build.imageFolder +
    '/' +
    build.ogImage.filename;

  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: titleFull,
    description: build.seo.description,
    image: ogImageUrl,
    url: canonicalUrl,
    datePublished: data.date,
    publisher: {
      '@type': 'Person',
      name: SITE_NAME,
    },
  });
}

/**
 * Build BreadcrumbList JSON-LD (single line).
 * @param {string} title
 * @param {string} canonicalUrl
 * @returns {string}
 */
function buildJsonLdBreadcrumb(title, canonicalUrl) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'ホーム',
        item: SITE + '/',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: '旅行',
        item: SITE + '/travel',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: title,
        item: canonicalUrl,
      },
    ],
  });
}

/**
 * Generate placeholder map for article.html head and hero.
 * @param {Record<string, unknown>} data
 * @param {Record<string, unknown>} build
 * @returns {Record<string, string>}
 */
function renderHeadPlaceholders(data, build) {
  var title = String(data.title);
  var titleFull = buildTitleFull(title);
  var titleFullEscaped = escapeHtml(titleFull);
  var description = escapeHtml(build.seo.description);
  var canonicalUrl = SITE + '/travel-' + data.id;
  var ogImageUrl =
    SITE +
    '/images/travel/' +
    build.imageFolder +
    '/' +
    build.ogImage.filename;
  var articleClass =
    'travel-article travel-article-' + build.orientation;

  return {
    TITLE_FULL: titleFullEscaped,
    DESCRIPTION: description,
    OG_IMAGE_URL: ogImageUrl,
    OG_IMAGE_WIDTH: String(build.ogImage.width),
    OG_IMAGE_HEIGHT: String(build.ogImage.height),
    CANONICAL_URL: canonicalUrl,
    PRELOAD_LINK: buildPreloadLink(build),
    JSON_LD_ARTICLE: buildJsonLdArticle(data, build, titleFull, canonicalUrl),
    JSON_LD_BREADCRUMB: buildJsonLdBreadcrumb(title, canonicalUrl),
    ARTICLE_CLASS: articleClass,
    HERO_H2: renderHeroH2(title),
    HERO_SUBTITLE: escapeHtml(data.heroSubtitle),
    LOCATION_TAG: escapeHtml(data.locationTag),
    SHARE_TEXT_ENCODED: encodeURIComponent(titleFull),
    SHARE_URL_ENCODED: encodeURIComponent(canonicalUrl),
  };
}

/**
 * @param {Record<string, unknown>} data
 * @param {Record<string, unknown>} build
 * @param {Record<string, unknown>} [options]
 * @returns {Record<string, string>}
 */
function renderHead(data, build, options) {
  return renderHeadPlaceholders(data, build);
}

module.exports = {
  SITE: SITE,
  PICTURE_SIZES: PICTURE_SIZES,
  renderHead: renderHead,
  renderHeadPlaceholders: renderHeadPlaceholders,
};
