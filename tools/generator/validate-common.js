/**
 * Shared, category-aware validation for the multi-category pipeline.
 * Node + browser (window.ValidateCommon).
 *
 * Contract:
 *   - category "travel": delegates to the ORIGINAL travel validators, so
 *     EXISTING travel draft/ready JSON validates exactly as before. This file
 *     never re-implements travel rules.
 *   - categories yurulog / carwash / cooking: config-driven checks.
 *
 * Returns { valid, errors[], warnings[] }.
 *
 * Note: slug/number COLLISION against existing HTML needs the filesystem and is
 * enforced by tools/generator/generate.js (Node). The browser form cannot read
 * the repo, so collision is caught at generate time (same as legacy travel).
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('./category-config'),
      require('../travel/parse-body'),
      require('../travel/validate'),
      require('../travel/validate-ready')
    );
  } else {
    root.ValidateCommon = factory(
      root.CategoryConfig,
      root.TravelParse,
      root.TravelValidate,
      root.TravelValidateReady
    );
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (
  CategoryConfig,
  ParseBodyCommon,
  TravelValidate,
  TravelValidateReady
) {
  'use strict';

  var DATE_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

  function isNonEmptyString(v) {
    return typeof v === 'string' && v.trim().length > 0;
  }

  function toInt(v) {
    if (typeof v === 'number' && Number.isInteger(v)) return v;
    if (typeof v === 'string' && v.trim() !== '') {
      var n = Number(v);
      if (Number.isInteger(n)) return n;
    }
    return null;
  }

  function isValidDate(s) {
    if (!DATE_RE.test(s)) return false;
    var p = s.split('-').map(Number);
    var d = new Date(p[0], p[1] - 1, p[2]);
    return (
      d.getFullYear() === p[0] &&
      d.getMonth() === p[1] - 1 &&
      d.getDate() === p[2]
    );
  }

  function getFieldValue(data, key) {
    if (key === 'body') {
      if (typeof data.body === 'string') return data.body;
      if (data.body && typeof data.body === 'object') return data.body.raw || '';
      return '';
    }
    if (
      ['catchCopy', 'dishName', 'servings', 'cookTime', 'washDate',
       'vehicle', 'place', 'mapQuery', 'work', 'summary', 'plating',
       'taste', 'arrange', 'nutrition', 'notes'].indexOf(key) !== -1 ||
      ['tools', 'ingredients', 'seasonings', 'steps', 'cookTools'].indexOf(key) !== -1
    ) {
      return data.categoryData ? data.categoryData[key] : undefined;
    }
    return data[key];
  }

  function fieldIsEmpty(field, value) {
    if (field.type === 'list' || field.type === 'imagelist') {
      return !Array.isArray(value) || value.length === 0;
    }
    if (field.type === 'number') {
      return toInt(value) === null;
    }
    return !isNonEmptyString(value);
  }

  /**
   * Count photo sections in a parsed body (article layout only).
   */
  function countPhotoSections(body) {
    if (!body || typeof body !== 'object' || !Array.isArray(body.sections)) {
      // allow raw string bodies by parsing
      if (body && typeof body === 'object' && typeof body.raw === 'string') {
        body = ParseBodyCommon.parseBody(body.raw);
      } else {
        return 0;
      }
    }
    return body.sections.filter(function (s) {
      return s && s.type === 'photo';
    }).length;
  }

  /**
   * Core config-driven validation for non-travel categories.
   * @param {object} data
   * @param {'draft'|'ready'} mode
   */
  function validateGeneric(data, mode) {
    var errors = [];
    var warnings = [];
    var cat = CategoryConfig.getCategory(data.category);

    // id
    var id = toInt(data.id);
    if (id === null || id < 1) {
      errors.push('記事番号は1以上の整数で入力してください。');
    }

    // slug must match {prefix}-{id}
    if (id !== null && id >= 1) {
      var expected = cat.slugPrefix + '-' + id;
      if (data.slug !== expected) {
        errors.push(
          'slug は ' + expected + ' である必要があります（現在: ' +
            String(data.slug) + '）。'
        );
      }
    }

    // date
    var date = isNonEmptyString(data.date) ? data.date.trim() : '';
    if (!date) {
      errors.push('公開日を入力してください。');
    } else if (!isValidDate(date)) {
      errors.push('公開日は YYYY-MM-DD 形式の実在する日付で入力してください。');
    }

    // required fields (draft-level) and readyRequired (ready-level)
    var fields = CategoryConfig.fieldsFor(data.category);
    fields.forEach(function (field) {
      if (field.key === 'id' || field.key === 'date') return; // handled above
      var value = getFieldValue(data, field.key);
      var empty = fieldIsEmpty(field, value);
      var needed =
        field.required || (mode === 'ready' && field.readyRequired);
      if (needed && empty) {
        errors.push(field.label + 'を入力してください。');
      }
      if (field.maxlength && isNonEmptyString(value) &&
          value.trim().length > field.maxlength) {
        errors.push(field.label + 'は' + field.maxlength + '文字以内で入力してください。');
      }
    });

    // image count vs image info (article layout with body photos)
    if (cat.bodyPhotos) {
      var photoCount = countPhotoSections(data.body);
      var images = Array.isArray(data.images) ? data.images : [];
      if (images.length > 0 && images.length !== photoCount) {
        errors.push(
          '写真セクション数（' + photoCount + '）と画像情報の数（' +
            images.length + '）が一致しません。'
        );
      }
      if (mode === 'ready' && photoCount > 0 && images.length !== photoCount) {
        errors.push(
          'ready には写真セクション数（' + photoCount +
            '）と同数の画像情報（alt等）が必要です。'
        );
      }
    }

    // each image must have alt (warning at draft, error at ready)
    if (Array.isArray(data.images)) {
      data.images.forEach(function (img, i) {
        if (!img || !isNonEmptyString(img.alt)) {
          var msg = '画像情報[' + (i + 1) + '] の alt が未入力です。';
          if (mode === 'ready') errors.push(msg);
          else warnings.push(msg);
        }
      });
    }

    return { valid: errors.length === 0, errors: errors, warnings: warnings };
  }

  /**
   * Validate any draft/ready object across categories.
   * @param {object} data
   * @param {{ mode?: 'draft'|'ready' }} [options]
   */
  function validateAny(data, options) {
    options = options || {};
    if (!data || typeof data !== 'object') {
      return { valid: false, errors: ['入力データがありません。'], warnings: [] };
    }

    var cat = CategoryConfig.getCategory(data.category);
    if (!cat) {
      return {
        valid: false,
        errors: [
          '存在しないカテゴリです: ' + String(data.category) +
            '（有効: ' + CategoryConfig.ORDER.join(', ') + '）',
        ],
        warnings: [],
      };
    }

    // Determine mode: explicit option overrides, else from data.status.
    var mode =
      options.mode || (data.status === 'ready' ? 'ready' : 'draft');

    // travel → legacy validators (guarantees existing travel JSON compat)
    if (cat.legacy) {
      if (mode === 'ready') {
        return TravelValidateReady.validateReady(data);
      }
      return TravelValidate.validateDraft(data);
    }

    return validateGeneric(data, mode);
  }

  return {
    validateAny: validateAny,
    validateGeneric: validateGeneric,
    countPhotoSections: countPhotoSections,
  };
});
