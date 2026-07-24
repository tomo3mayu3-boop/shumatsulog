/**
 * Render sidebar place boxes for travel articles.
 */

'use strict';

const { escapeHtml } = require('./escape');

var DEFAULT_ZOOM = 14;
var DEFAULT_IFRAME_HEIGHT = 220;

/**
 * Render a single place entry (label/detail paragraph + iframe).
 * @param {{ label: string, detail: string, mapQuery: string, zoom?: number, iframeHeight?: number }} place
 * @param {boolean} isLast
 * @returns {string}
 */
function renderPlaceEntry(place, isLast) {
  var zoom = place.zoom != null ? place.zoom : DEFAULT_ZOOM;
  var iframeHeight =
    place.iframeHeight != null ? place.iframeHeight : DEFAULT_IFRAME_HEIGHT;
  var marginBottom = isLast ? '8px' : '8px';
  var label = escapeHtml(place.label);
  var detail = escapeHtml(place.detail);
  var mapSrc =
    'https://maps.google.com/maps?q=' +
    encodeURIComponent(place.mapQuery) +
    '&output=embed&z=' +
    zoom;

  return (
    '      <p style="font-size:13px; margin-bottom:6px;">' +
    label +
    '<br>' +
    detail +
    '</p>\n' +
    '      <iframe title="Google マップ"\n' +
    '        src="' +
    mapSrc +
    '"\n' +
    '        width="100%"\n' +
    '        height="' +
    iframeHeight +
    '"\n' +
    '        style="border:0; border-radius:8px; margin-bottom:' +
    marginBottom +
    ';"\n' +
    '        allowfullscreen=""\n' +
    '        loading="lazy">\n' +
    '      </iframe>'
  );
}

/**
 * Render sidebar place box(es) for {{SIDEBAR_PLACES}}.
 * @param {{ sidebar: { places: object[] } }} build
 * @returns {string}
 */
function renderSidebar(build) {
  var places = build.sidebar.places;
  var entries = places
    .map(function (place, index) {
      return renderPlaceEntry(place, index === places.length - 1);
    })
    .join('\n');

  return (
    '    <div class="sidebar-box">\n' +
    '      <h3>📍 場所</h3>\n' +
    entries +
    '\n' +
    '    </div>'
  );
}

module.exports = {
  renderSidebar: renderSidebar,
};
