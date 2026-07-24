/**
 * Parse travel article body text into structured sections.
 *
 * Rules:
 * - Sections split on a line that is exactly "---"
 * - Paragraphs within a section are separated by blank lines
 * - Empty sections are trimmed
 * - Last section type "text", all others "photo"
 * - Single section only → type "photo"
 * - <br> tags are preserved in paragraph text
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TravelParse = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /**
   * Split raw body into non-empty section strings.
   * @param {string} raw
   * @returns {string[]}
   */
  function splitSections(raw) {
    if (typeof raw !== 'string') {
      return [];
    }

    return raw
      .split(/\r?\n/)
      .reduce(function (sections, line) {
        if (line === '---') {
          sections.push([]);
        } else {
          if (sections.length === 0) {
            sections.push([]);
          }
          sections[sections.length - 1].push(line);
        }
        return sections;
      }, [])
      .map(function (lines) {
        return lines.join('\n').trim();
      })
      .filter(function (text) {
        return text.length > 0;
      });
  }

  /**
   * Split section text into paragraphs (blank-line separated).
   * @param {string} sectionText
   * @returns {string[]}
   */
  function splitParagraphs(sectionText) {
    var paragraphs = [];
    var current = [];

    sectionText.split(/\r?\n/).forEach(function (line) {
      if (line.trim() === '') {
        if (current.length > 0) {
          paragraphs.push(current.join('\n'));
          current = [];
        }
      } else {
        current.push(line);
      }
    });

    if (current.length > 0) {
      paragraphs.push(current.join('\n'));
    }

    return paragraphs.filter(function (p) {
      return p.trim().length > 0;
    });
  }

  /**
   * Assign section type based on position and count.
   * @param {number} index
   * @param {number} total
   * @returns {'photo'|'text'}
   */
  function sectionType(index, total) {
    if (total === 1) {
      return 'photo';
    }
    if (index === total - 1) {
      return 'text';
    }
    return 'photo';
  }

  /**
   * Parse body text into { raw, sections }.
   * @param {string} raw
   * @returns {{ raw: string, sections: Array<{ type: string, paragraphs: string[] }> }}
   */
  function parseBody(raw) {
    var rawText = typeof raw === 'string' ? raw : '';
    var sectionTexts = splitSections(rawText);

    var sections = sectionTexts.map(function (text, index) {
      return {
        type: sectionType(index, sectionTexts.length),
        paragraphs: splitParagraphs(text),
      };
    });

    return {
      raw: rawText,
      sections: sections,
    };
  }

  return {
    parseBody: parseBody,
    splitSections: splitSections,
    splitParagraphs: splitParagraphs,
  };
});
