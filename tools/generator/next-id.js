#!/usr/bin/env node
/**
 * Compute the next article id per category by scanning existing
 * {prefix}-{n}.html files in the repo root. "max + 1" (never fills gaps),
 * and never hard-coded.
 *
 * Usage:
 *   node tools/generator/next-id.js                 # print all categories
 *   node tools/generator/next-id.js yurulog         # print one category
 *   node tools/generator/next-id.js --write         # write tools/generator/next-ids.json
 *
 * The written next-ids.json is fetched by the iPhone form to pre-fill 記事番号.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const { CATEGORIES, ORDER } = require('./category-config');

const REPO_ROOT = path.resolve(__dirname, '../..');
const OUT_JSON = path.join(__dirname, 'next-ids.json');

/**
 * Scan repo root for {prefix}-{n}.html and return max id (0 if none).
 * Ignores non-article files like carwash-detail.js, carwash-game-v2.html.
 * @param {string} prefix
 * @returns {number}
 */
function maxIdFor(prefix) {
  var re = new RegExp('^' + prefix + '-([0-9]+)\\.html$');
  var files;
  try {
    files = fs.readdirSync(REPO_ROOT);
  } catch (err) {
    return 0;
  }
  var max = 0;
  files.forEach(function (name) {
    var m = re.exec(name);
    if (m) {
      var n = parseInt(m[1], 10);
      if (Number.isInteger(n) && n > max) {
        max = n;
      }
    }
  });
  return max;
}

/**
 * @returns {Record<string, number>} category -> nextId
 */
function computeNextIds() {
  var out = {};
  ORDER.forEach(function (key) {
    var cat = CATEGORIES[key];
    out[key] = maxIdFor(cat.slugPrefix) + 1;
  });
  return out;
}

function main() {
  var argv = process.argv.slice(2);
  var write = argv.indexOf('--write') !== -1;
  var only = argv.filter(function (a) {
    return a.indexOf('-') !== 0;
  })[0];

  var nextIds = computeNextIds();

  if (write) {
    fs.writeFileSync(OUT_JSON, JSON.stringify(nextIds, null, 2) + '\n', 'utf8');
    console.log('Wrote ' + OUT_JSON);
    console.log(JSON.stringify(nextIds, null, 2));
    return;
  }

  if (only) {
    if (!Object.prototype.hasOwnProperty.call(nextIds, only)) {
      console.error('Unknown category: ' + only);
      process.exit(1);
    }
    process.stdout.write(String(nextIds[only]) + '\n');
    return;
  }

  console.log(JSON.stringify(nextIds, null, 2));
}

if (require.main === module) {
  main();
}

module.exports = { maxIdFor: maxIdFor, computeNextIds: computeNextIds };
