/**
 * Render travel.html listing <section> for a single article.
 */

'use strict';

const { escapeHtml } = require('./escape');
const { renderPicture } = require('./render-picture');

/**
 * Format ISO date (YYYY-MM-DD) as listing post-date (YYYY.MM.DD).
 * @param {string} dateStr
 * @returns {string}
 */
function formatPostDate(dateStr) {
  var parts = String(dateStr).split('-');
  if (parts.length !== 3) {
    return dateStr;
  }
  return parts[0] + '.' + parts[1] + '.' + parts[2];
}

/**
 * Render one article listing block matching travel.html article-row format.
 * @param {{ id: number, title: string, date: string, heroSubtitle: string }} data
 * @param {{ photos: object[], imageFolder: string, imagePrefix: string }} build
 * @returns {string}
 */
function renderListingSection(data, build) {
  var photo = build.photos[0];
  var pictureHtml = renderPicture(photo, build, {
    imgClass: 'photo',
    loading: 'lazy',
  });

  var href = 'travel-' + data.id + '.html';
  var postDate = formatPostDate(data.date);
  var title = escapeHtml(data.title);
  var subtitle = data.heroSubtitle;

  return (
    '<section>\n' +
    '  <div class="article-row">\n' +
    '    ' +
    pictureHtml.split('\n').join('\n    ') +
    '\n' +
    '    <div class="article-text">\n' +
    '      <p class="post-date">' +
    postDate +
    '</p>\n' +
    '      <h3>' +
    title +
    '</h3>\n' +
    '      <p>\n' +
    '        ' +
    subtitle +
    '\n' +
    '      </p>\n' +
    '      <a href="' +
    href +
    '" class="btn">のぞく</a>\n' +
    '    </div>\n' +
    '  </div>\n' +
    '</section>'
  );
}

module.exports = {
  formatPostDate: formatPostDate,
  renderListingSection: renderListingSection,
};
