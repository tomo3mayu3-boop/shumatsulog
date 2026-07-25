/**
 * Validate ready travel JSON before HTML generation.
 * Returns { valid, errors[], warnings[] }
 * Node + browser (TravelValidateReady on window).
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./validate.js'));
  } else {
    root.TravelValidateReady = factory(root.TravelValidate);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (TravelValidate) {
  'use strict';

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
   * Count photo sections in parsed body.
   * @param {unknown} body
   * @returns {number}
   */
  function countPhotoSections(body) {
    if (!body || typeof body !== 'object' || !Array.isArray(body.sections)) {
      return 0;
    }

    return body.sections.filter(function (section) {
      return section && section.type === 'photo';
    }).length;
  }

  /**
   * @param {unknown} build
   * @param {string[]} errors
   */
  function validateBuild(build, errors) {
    if (!build || typeof build !== 'object') {
      errors.push('build ブロックがありません。');
      return;
    }

    if (build.orientation !== 'landscape' && build.orientation !== 'portrait') {
      errors.push(
        'build.orientation は landscape または portrait を指定してください。'
      );
    }

    if (typeof build.imageFolder !== 'string' || !build.imageFolder.trim()) {
      errors.push('build.imageFolder を入力してください。');
    }

    if (typeof build.imagePrefix !== 'string' || !build.imagePrefix.trim()) {
      errors.push('build.imagePrefix を入力してください。');
    }

    if (
      !build.seo ||
      typeof build.seo !== 'object' ||
      typeof build.seo.description !== 'string' ||
      !build.seo.description.trim()
    ) {
      errors.push('build.seo.description を入力してください。');
    } else if (build.seo.description.trim().length > 300) {
      errors.push('build.seo.description は300文字以内で入力してください。');
    }

    if (!Array.isArray(build.photos) || build.photos.length === 0) {
      errors.push('build.photos に1件以上の写真メタデータを指定してください。');
    } else {
      build.photos.forEach(function (photo, index) {
        var label = 'build.photos[' + index + ']';

        if (!photo || typeof photo !== 'object') {
          errors.push(label + ' が不正です。');
          return;
        }

        var photoIndex = toInt(photo.index);
        if (photoIndex === null || photoIndex < 1) {
          errors.push(label + '.index は1以上の整数で指定してください。');
        }

        if (typeof photo.alt !== 'string' || !photo.alt.trim()) {
          errors.push(label + '.alt を入力してください。');
        }

        var width = toInt(photo.width);
        if (width === null || width < 1) {
          errors.push(label + '.width は1以上の整数で指定してください。');
        }

        var height = toInt(photo.height);
        if (height === null || height < 1) {
          errors.push(label + '.height は1以上の整数で指定してください。');
        }

        if (!Array.isArray(photo.variants) || photo.variants.length === 0) {
          errors.push(label + '.variants に1件以上の横幅を指定してください。');
        } else {
          photo.variants.forEach(function (variant, variantIndex) {
            var variantWidth = toInt(variant);
            if (variantWidth === null || variantWidth < 1) {
              errors.push(
                label +
                  '.variants[' +
                  variantIndex +
                  '] は1以上の整数で指定してください。'
              );
            }
          });
        }
      });
    }

    if (!build.ogImage || typeof build.ogImage !== 'object') {
      errors.push('build.ogImage を指定してください。');
    } else {
      if (
        typeof build.ogImage.filename !== 'string' ||
        !build.ogImage.filename.trim()
      ) {
        errors.push('build.ogImage.filename を入力してください。');
      }

      var ogWidth = toInt(build.ogImage.width);
      if (ogWidth !== 1200) {
        errors.push('build.ogImage.width は 1200 である必要があります。');
      }

      var ogHeight = toInt(build.ogImage.height);
      if (ogHeight !== 630) {
        errors.push('build.ogImage.height は 630 である必要があります。');
      }
    }

    if (
      !build.sidebar ||
      typeof build.sidebar !== 'object' ||
      !Array.isArray(build.sidebar.places) ||
      build.sidebar.places.length === 0
    ) {
      errors.push('build.sidebar.places に1件以上の場所を指定してください。');
    } else {
      build.sidebar.places.forEach(function (place, index) {
        var label = 'build.sidebar.places[' + index + ']';

        if (!place || typeof place !== 'object') {
          errors.push(label + ' が不正です。');
          return;
        }

        if (typeof place.label !== 'string' || !place.label.trim()) {
          errors.push(label + '.label を入力してください。');
        }

        if (typeof place.detail !== 'string' || !place.detail.trim()) {
          errors.push(label + '.detail を入力してください。');
        }

        if (typeof place.mapQuery !== 'string' || !place.mapQuery.trim()) {
          errors.push(label + '.mapQuery を入力してください。');
        }

        var zoom = toInt(place.zoom);
        if (zoom === null || zoom < 1 || zoom > 21) {
          errors.push(label + '.zoom は 1〜21 の整数で指定してください。');
        }

        var iframeHeight = toInt(place.iframeHeight);
        if (iframeHeight === null || iframeHeight < 100) {
          errors.push(
            label + '.iframeHeight は 100 以上の整数で指定してください。'
          );
        }
      });
    }
  }

  /**
   * Validate ready JSON for HTML generation.
   * @param {Record<string, unknown>} data
   * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
   */
  function validateReady(data) {
    var errors = [];
    var warnings = [];

    if (!data || typeof data !== 'object') {
      return { valid: false, errors: ['入力データがありません。'], warnings: [] };
    }

    if (data.status !== 'ready') {
      errors.push(
        'status は "ready" である必要があります（現在: ' +
          String(data.status) +
          '）。'
      );
    }

    if (data.build === null || data.build === undefined) {
      errors.push(
        'build ブロックが null または未設定です。ready 状態では build が必須です。'
      );
    }

    if (data.schemaVersion !== 1) {
      errors.push('schemaVersion は 1 である必要があります。');
    }

    if (data.category !== 'travel') {
      errors.push('category は "travel" である必要があります。');
    }

    var id = toInt(data.id);
    if (id !== null && id >= 1) {
      var expectedSlug = 'travel-' + id;
      if (typeof data.slug !== 'string' || data.slug !== expectedSlug) {
        errors.push(
          'slug は ' +
            expectedSlug +
            ' である必要があります（現在: ' +
            String(data.slug) +
            '）。'
        );
      }
    }

    var draftResult = TravelValidate.validateDraft(data);
    errors = errors.concat(draftResult.errors);
    warnings = warnings.concat(draftResult.warnings);

    if (data.build && typeof data.build === 'object') {
      validateBuild(data.build, errors);

      var photoSectionCount = countPhotoSections(data.body);
      var buildPhotoCount = Array.isArray(data.build.photos)
        ? data.build.photos.length
        : 0;

      if (photoSectionCount !== buildPhotoCount) {
        errors.push(
          'photo セクション数（' +
            photoSectionCount +
            '）と build.photos 数（' +
            buildPhotoCount +
            '）が一致しません。'
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors,
      warnings: warnings,
    };
  }

  return {
    validateReady: validateReady,
    countPhotoSections: countPhotoSections,
  };
});
