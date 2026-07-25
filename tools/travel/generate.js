#!/usr/bin/env node
/**
 * Generate travel article HTML from ready JSON (Sprint 2c / 3a).
 *
 * Usage:
 *   node tools/travel/generate.js <path-to-json>
 *   node tools/travel/generate.js <path-to-json> --dry-run
 *   node tools/travel/generate.js <path-to-json> --out staging/
 */

'use strict';

const fs = require('fs');
const path = require('path');

const { validateReady } = require('./validate-ready');
const { renderHeadPlaceholders } = require('./render-head');
const { renderPicture } = require('./render-picture');
const { renderSections } = require('./render-sections');
const { renderSidebar } = require('./render-sidebar');

const REPO_ROOT = path.resolve(__dirname, '../..');
const TEMPLATE_PATH = path.join(__dirname, 'templates', 'article.html');
const DEFAULT_OUT_DIR = path.join(REPO_ROOT, 'staging');

/**
 * @param {string[]} argv
 * @returns {{ jsonPath: string, dryRun: boolean, outDir: string }}
 */
function parseArgs(argv) {
  var args = { jsonPath: null, dryRun: false, outDir: DEFAULT_OUT_DIR };

  for (var i = 2; i < argv.length; i++) {
    var arg = argv[i];

    if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--out') {
      i += 1;
      if (i >= argv.length) {
        console.error('Error: --out requires a directory path.');
        process.exit(1);
      }
      args.outDir = path.resolve(argv[i]);
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
      'Usage: node tools/travel/generate.js <path-to-json> [--dry-run] [--out staging/]'
    );
    process.exit(1);
  }

  return args;
}

/**
 * @param {string} template
 * @param {Record<string, string>} placeholders
 * @returns {string}
 */
function applyPlaceholders(template, placeholders) {
  var result = template;
  Object.keys(placeholders).forEach(function (key) {
    var token = '{{' + key + '}}';
    result = result.split(token).join(placeholders[key]);
  });
  return result;
}

var PLACEHOLDER_RE = /\{\{[A-Z_]+\}\}/g;

/**
 * @param {string} html
 * @returns {string[]}
 */
function findRemainingPlaceholders(html) {
  var matches = html.match(PLACEHOLDER_RE);
  if (!matches) {
    return [];
  }
  var seen = {};
  return matches.filter(function (token) {
    if (seen[token]) {
      return false;
    }
    seen[token] = true;
    return true;
  });
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
  var rootHtmlPath = path.join(REPO_ROOT, slug + '.html');
  var outHtmlPath = path.join(args.outDir, slug + '.html');

  if (fs.existsSync(rootHtmlPath)) {
    console.error(
      'Error: ' + rootHtmlPath + ' already exists (slug collision).'
    );
    process.exit(1);
  }

  if (fs.existsSync(outHtmlPath)) {
    console.error(
      'Error: ' + outHtmlPath + ' already exists (no overwrite in Sprint 2c).'
    );
    process.exit(1);
  }

  var template;
  try {
    template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  } catch (err) {
    console.error('Error: cannot read template: ' + TEMPLATE_PATH);
    process.exit(1);
  }

  var build = data.build;
  var placeholders = Object.assign({}, renderHeadPlaceholders(data, build), {
    BODY_SECTIONS: renderSections(data.body, build, renderPicture),
    SIDEBAR_PLACES: renderSidebar(build),
  });

  var html = applyPlaceholders(template, placeholders);

  var remaining = findRemainingPlaceholders(html);
  if (remaining.length > 0) {
    console.error(
      'Error: unreplaced placeholders remain: ' + remaining.join(', ')
    );
    process.exit(1);
  }

  if (args.dryRun) {
    process.stdout.write(html);
    console.error('Dry run OK: would write to ' + outHtmlPath);
    return;
  }

  fs.mkdirSync(args.outDir, { recursive: true });
  fs.writeFileSync(outHtmlPath, html, 'utf8');
  console.log('Generated: ' + outHtmlPath);
}

main();
