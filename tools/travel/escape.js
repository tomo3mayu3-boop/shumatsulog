/**
 * HTML and attribute escaping for travel article generation.
 * Node + browser (TravelEscape on window).
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TravelEscape = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /**
   * Escape text for HTML text nodes.
   * @param {unknown} value
   * @returns {string}
   */
  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Escape text for HTML attribute values.
   * @param {unknown} value
   * @returns {string}
   */
  function escapeAttr(value) {
    return escapeHtml(value);
  }

  return {
    escapeHtml: escapeHtml,
    escapeAttr: escapeAttr,
  };
});
