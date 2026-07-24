/**
 * Validate draft travel JSON before save.
 * Returns { valid, errors[], warnings[] }
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TravelValidate = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var DATE_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

  /**
   * @param {unknown} value
   * @returns {boolean}
   */
  function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
  }

  /**
   * @param {unknown} value
   * @returns {number|null}
   */
  function toInt(value) {
    if (typeof value === 'number' && Number.isInteger(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim() !== '') {
      var n = Number(value);
      if (Number.isInteger(n)) {
        return n;
      }
    }
    return null;
  }

  /**
   * @param {string} dateStr
   * @returns {boolean}
   */
  function isValidDate(dateStr) {
    if (!DATE_RE.test(dateStr)) {
      return false;
    }
    var parts = dateStr.split('-').map(Number);
    var d = new Date(parts[0], parts[1] - 1, parts[2]);
    return (
      d.getFullYear() === parts[0] &&
      d.getMonth() === parts[1] - 1 &&
      d.getDate() === parts[2]
    );
  }

  /**
   * Validate form fields or full draft object.
   * Accepts partial form input { id, title, date, locationTag, heroSubtitle, body, listingDescription }
   * or a complete draft JSON object.
   *
   * @param {Record<string, unknown>} data
   * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
   */
  function validateDraft(data) {
    var errors = [];
    var warnings = [];

    if (!data || typeof data !== 'object') {
      return { valid: false, errors: ['入力データがありません。'], warnings: [] };
    }

    var id = toInt(data.id);
    if (id === null || id < 1) {
      errors.push('記事IDは1以上の整数で入力してください。');
    } else if (id <= 15) {
      warnings.push(
        '記事ID ' +
          id +
          ' は既存記事と重複する可能性があります（travel-1 〜 travel-15）。'
      );
    }

    var title = typeof data.title === 'string' ? data.title.trim() : '';
    if (!title) {
      errors.push('タイトルを入力してください。');
    } else if (title.length > 80) {
      errors.push('タイトルは80文字以内で入力してください。');
    }

    var date = typeof data.date === 'string' ? data.date.trim() : '';
    if (!date) {
      errors.push('日付を入力してください。');
    } else if (!isValidDate(date)) {
      errors.push('日付は YYYY-MM-DD 形式で入力してください。');
    }

    var locationTag =
      typeof data.locationTag === 'string' ? data.locationTag.trim() : '';
    if (!locationTag) {
      errors.push('場所タグを入力してください。');
    }

    var heroSubtitle =
      typeof data.heroSubtitle === 'string' ? data.heroSubtitle.trim() : '';
    if (!heroSubtitle) {
      errors.push('ヒーロー副題を入力してください。');
    } else if (heroSubtitle.length > 200) {
      errors.push('ヒーロー副題は200文字以内で入力してください。');
    }

    var listingDescription =
      typeof data.listingDescription === 'string'
        ? data.listingDescription.trim()
        : '';
    if (!listingDescription) {
      errors.push('一覧説明文を入力してください。');
    } else if (listingDescription.length > 300) {
      errors.push('一覧説明文は300文字以内で入力してください。');
    }

    var bodyRaw = '';
    if (typeof data.body === 'string') {
      bodyRaw = data.body.trim();
    } else if (
      data.body &&
      typeof data.body === 'object' &&
      typeof data.body.raw === 'string'
    ) {
      bodyRaw = data.body.raw.trim();
    }

    if (!bodyRaw) {
      errors.push('本文を入力してください。');
    } else if (
      data.body &&
      typeof data.body === 'object' &&
      Array.isArray(data.body.sections)
    ) {
      data.body.sections.forEach(function (section, index) {
        if (
          !section ||
          !Array.isArray(section.paragraphs) ||
          section.paragraphs.length === 0
        ) {
          warnings.push('セクション ' + (index + 1) + ' に段落がありません。');
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors: errors,
      warnings: warnings,
    };
  }

  return {
    validateDraft: validateDraft,
  };
});
