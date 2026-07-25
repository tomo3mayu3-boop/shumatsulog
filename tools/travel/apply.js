#!/usr/bin/env node
/**
 * Apply staged travel article to the site (Sprint 3b).
 *
 * Usage:
 *   node tools/travel/apply.js <path-to-ready-json>
 *   node tools/travel/apply.js <path-to-ready-json> --dry-run
 *   node tools/travel/apply.js <path-to-ready-json> --force
 */

'use strict';

const fs = require('fs');
const path = require('path');

const { validateReady } = require('./validate-ready');
const { renderListingSection } = require('./render-listing');

const REPO_ROOT = path.resolve(__dirname, '../..');
const TRAVEL_HTML_PATH = path.join(REPO_ROOT, 'travel.html');
const SITEMAP_PATH = path.join(REPO_ROOT, 'sitemap.xml');
const NEXT_ID_PATH = path.join(__dirname, 'next-id.json');
const STAGING_DIR = path.join(REPO_ROOT, 'staging');

/**
 * @param {string[]} argv
 * @returns {{ jsonPath: string, dryRun: boolean, force: boolean }}
 */
function parseArgs(argv) {
  var args = { jsonPath: null, dryRun: false, force: false };

  for (var i = 2; i < argv.length; i++) {
    var arg = argv[i];

    if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--force') {
      args.force = true;
    } else if (arg.indexOf('-') === 0) {
      console.error('Error: unknown option ' + arg);
      process.exit(1);
    } else if (!args.jsonPath) {
      args.jsonPath = path.resolve(arg);
    } else {
      console.error('Error: unexpected argument ' + arg);
      process.exit(1);
    }
  }

  if (!args.jsonPath) {
    console.error(
      'Usage: node tools/travel/apply.js <path-to-ready-json> [--dry-run] [--force]'
    );
    process.exit(1);
  }

  return args;
}

/**
 * @param {string} travelHtml
 * @param {number} id
 * @returns {boolean}
 */
function listingContainsId(travelHtml, id) {
  return travelHtml.indexOf('href="travel-' + id + '.html"') !== -1;
}

/**
 * @param {string} travelHtml
 * @param {string} listingSection
 * @returns {string}
 */
function insertListingSection(travelHtml, listingSection) {
  var heroMatch = travelHtml.match(/<section class="hero">[\s\S]*?<\/section>/);
  if (!heroMatch || heroMatch.index === undefined) {
    throw new Error('Could not find hero section in travel.html');
  }

  var insertAt = heroMatch.index + heroMatch[0].length;
  return (
    travelHtml.slice(0, insertAt) +
    '\n\n' +
    listingSection +
    travelHtml.slice(insertAt)
  );
}

/**
 * @param {string} sitemapXml
 * @param {number} id
 * @returns {boolean}
 */
function sitemapContainsId(sitemapXml, id) {
  return (
    sitemapXml.indexOf(
      '<loc>https://shumatsulog.com/travel-' + id + '</loc>'
    ) !== -1
  );
}

/**
 * @param {string} sitemapXml
 * @param {number} id
 * @param {string} date ISO date YYYY-MM-DD
 * @returns {string}
 */
function insertSitemapEntry(sitemapXml, id, date) {
  var entry =
    '  <url>\n' +
    '    <loc>https://shumatsulog.com/travel-' +
    id +
    '</loc>\n' +
    '    <lastmod>' +
    date +
    '</lastmod>\n' +
    '    <priority>0.6</priority>\n' +
    '  </url>\n';

  var anchor = '<loc>https://shumatsulog.com/travel-15</loc>';
  var anchorIndex = sitemapXml.indexOf(anchor);
  if (anchorIndex === -1) {
    throw new Error('Could not find travel-15 entry in sitemap.xml');
  }

  var urlEnd = sitemapXml.indexOf('</url>', anchorIndex);
  if (urlEnd === -1) {
    throw new Error('Malformed sitemap.xml near travel-15 entry');
  }
  urlEnd += '</url>'.length;

  return sitemapXml.slice(0, urlEnd) + '\n' + entry + sitemapXml.slice(urlEnd);
}

/**
 * @param {number} id
 * @param {boolean} force
 * @returns {{ nextId: number, changed: boolean }}
 */
function planNextIdUpdate(id, force) {
  var current = { nextId: 16 };
  if (fs.existsSync(NEXT_ID_PATH)) {
    current = JSON.parse(fs.readFileSync(NEXT_ID_PATH, 'utf8'));
  }

  if (id >= current.nextId) {
    return { nextId: id + 1, changed: true };
  }

  return { nextId: current.nextId, changed: false };
}

function main() {
  var args = parseArgs(process.argv);
  var raw;

  try {
    raw = fs.readFileSync(args.jsonPath, 'utf8');
  } catch (err) {
    console.error('Error: cannot read JSON file: ' + args.jsonPath);
    process.exit(1);
  }

  var data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    console.error('Error: invalid JSON: ' + err.message);
    process.exit(1);
  }

  var validation = validateReady(data);
  if (!validation.valid) {
    validation.errors.forEach(function (message) {
      console.error(message);
    });
    process.exit(1);
  }

  validation.warnings.forEach(function (message) {
    console.warn(message);
  });

  var id = data.id;
  var slug = 'travel-' + id;
  var stagingPath = path.join(STAGING_DIR, slug + '.html');
  var rootPath = path.join(REPO_ROOT, slug + '.html');

  if (!fs.existsSync(stagingPath)) {
    console.error('Error: staging file not found: ' + stagingPath);
    console.error('Run generate.js first.');
    process.exit(1);
  }

  if (fs.existsSync(rootPath) && !args.force) {
    console.error('Error: ' + rootPath + ' already exists. Use --force to overwrite.');
    process.exit(1);
  }

  var travelHtml = fs.readFileSync(TRAVEL_HTML_PATH, 'utf8');
  var sitemapXml = fs.readFileSync(SITEMAP_PATH, 'utf8');
  var listingSection = renderListingSection(data, data.build);

  var listingExists = listingContainsId(travelHtml, id);
  if (listingExists && !args.force) {
    console.error(
      'Error: travel.html already lists travel-' +
        id +
        '.html. Use --force to proceed.'
    );
    process.exit(1);
  }

  var sitemapExists = sitemapContainsId(sitemapXml, id);
  var nextIdPlan = planNextIdUpdate(id, args.force);

  var actions = [];
  actions.push(
    (fs.existsSync(rootPath) ? 'Overwrite' : 'Copy') +
      ' ' +
      stagingPath +
      ' → ' +
      rootPath
  );

  if (listingExists) {
    actions.push('Skip travel.html listing (already present)');
  } else {
    actions.push('Insert listing section into travel.html (after hero)');
  }

  if (sitemapExists) {
    actions.push('Skip sitemap.xml entry (already present)');
  } else {
    actions.push(
      'Insert sitemap entry for https://shumatsulog.com/travel-' +
        id +
        ' (lastmod=' +
        data.date +
        ')'
    );
  }

  if (nextIdPlan.changed) {
    actions.push('Update next-id.json: nextId → ' + nextIdPlan.nextId);
  } else {
    actions.push('Keep next-id.json unchanged (nextId=' + nextIdPlan.nextId + ')');
  }

  if (args.dryRun) {
    console.log('Dry run — planned actions:');
    actions.forEach(function (action) {
      console.log('  • ' + action);
    });
    return;
  }

  fs.copyFileSync(stagingPath, rootPath);

  if (!listingExists) {
    var updatedTravelHtml = insertListingSection(travelHtml, listingSection);
    fs.writeFileSync(TRAVEL_HTML_PATH, updatedTravelHtml, 'utf8');
  }

  if (!sitemapExists) {
    var updatedSitemap = insertSitemapEntry(sitemapXml, id, data.date);
    fs.writeFileSync(SITEMAP_PATH, updatedSitemap, 'utf8');
  }

  if (nextIdPlan.changed) {
    fs.writeFileSync(
      NEXT_ID_PATH,
      JSON.stringify({ nextId: nextIdPlan.nextId }, null, 2) + '\n',
      'utf8'
    );
  }

  console.log('Applied travel-' + id + ' successfully.');
  console.log('  • ' + rootPath);
  if (!listingExists) {
    console.log('  • travel.html listing updated');
  }
  if (!sitemapExists) {
    console.log('  • sitemap.xml updated');
  }
  if (nextIdPlan.changed) {
    console.log('  • next-id.json → ' + nextIdPlan.nextId);
  }
}

main();
