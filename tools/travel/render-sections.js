/**
 * Render body sections for travel articles.
 */

'use strict';

/**
 * Render paragraph HTML for a photo section (one <p> per paragraph).
 * @param {string[]} paragraphs
 * @returns {string}
 */
function renderPhotoParagraphs(paragraphs) {
  return paragraphs
    .map(function (content) {
      return '        <p>\n          ' + content + '\n        </p>';
    })
    .join('\n');
}

/**
 * Render paragraph HTML for a text section (single <p> with <br><br> joins).
 * @param {string[]} paragraphs
 * @returns {string}
 */
function renderTextParagraphs(paragraphs) {
  var joined = paragraphs.join('<br><br>');
  return '        <p>\n          ' + joined + '\n        </p>';
}

/**
 * Render all body sections (photo + text). Does not include back-link section.
 * @param {{ sections: Array<{ type: string, paragraphs: string[] }> }} body
 * @param {{ photos: object[] }} build
 * @param {Function} renderPictureFn
 * @returns {string}
 */
function renderSections(body, build, renderPictureFn) {
  var photoIndex = 0;
  var parts = [];

  body.sections.forEach(function (section) {
    if (section.type === 'photo') {
      var photo = build.photos[photoIndex];
      photoIndex += 1;
      var pictureHtml = renderPictureFn(photo, build, {
        isFirst: photoIndex === 1,
      });
      parts.push(
        '      <section>\n' +
          '        ' +
          pictureHtml.split('\n').join('\n        ') +
          '\n' +
          renderPhotoParagraphs(section.paragraphs) +
          '\n      </section>'
      );
    } else if (section.type === 'text') {
      parts.push(
        '      <section>\n' + renderTextParagraphs(section.paragraphs) + '\n      </section>'
      );
    }
  });

  return parts.join('\n\n');
}

module.exports = {
  renderSections: renderSections,
};
