#!/usr/bin/env node
/**
 * Generate staging HTML + listing-card + sitemap fragments for a
 * yurulog / carwash / cooking article from a ready JSON.
 *
 * travel keeps its own pipeline: use tools/travel/generate.js for travel.
 *
 * Usage:
 *   node tools/generator/generate.js drafts/cooking-1.json
 *   node tools/generator/generate.js drafts/cooking-1.json --dry-run
 *   node tools/generator/generate.js drafts/cooking-1.json --out staging/
 *
 * Safety (mirrors travel/generate.js):
 *   - status must be "ready" and pass validateAny(ready)
 *   - refuses if root {slug}.html already exists (slug/number collision)
 *   - refuses if staging file already exists (no silent overwrite)
 *   - writes ONLY to staging/ (never touches production files)
 */

'use strict';

const fs = require('fs');
const path = require('path');

const CC = require('./category-config');
const { validateAny } = require('./validate-common');
const {
  renderArticleHtml,
  renderListingCard,
  renderSitemapEntry,
} = require('./renderers');

const REPO_ROOT = path.resolve(__dirname, '../..');
const DEFAULT_OUT = path.join(REPO_ROOT, 'staging');

function parseArgs(argv) {
  var args = { jsonPath: null, dryRun: false, outDir: DEFAULT_OUT, force: false };
  for (var i = 2; i < argv.length; i++) {
    var a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--force') args.force = true;
    else if (a === '--out') {
      i += 1;
      if (i >= argv.length) fail('--out requires a directory path.');
      args.outDir = path.resolve(argv[i]);
    } else if (a.indexOf('-') === 0) fail('unknown option ' + a);
    else if (!args.jsonPath) args.jsonPath = path.resolve(a);
    else fail('unexpected argument ' + a);
  }
  if (!args.jsonPath) {
    fail('Usage: node tools/generator/generate.js <json> [--dry-run] [--out dir] [--force]');
  }
  return args;
}

function fail(msg) {
  console.error('Error: ' + msg);
  process.exit(1);
}

function main() {
  var args = parseArgs(process.argv);

  var raw;
  try {
    raw = fs.readFileSync(args.jsonPath, 'utf8');
  } catch (e) {
    fail('cannot read JSON file: ' + args.jsonPath);
  }

  var data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    fail('invalid JSON: ' + e.message);
  }

  var cat = CC.getCategory(data.category);
  if (!cat) fail('unknown category: ' + String(data.category));
  if (cat.legacy) {
    fail('travel は tools/travel/generate.js を使用してください（このツールは yurulog/carwash/cooking 用）。');
  }

  // must be ready + valid
  var result = validateAny(data, { mode: 'ready' });
  if (data.status !== 'ready') {
    result.errors.unshift('status は "ready" である必要があります（現在: ' + String(data.status) + '）。');
    result.valid = false;
  }
  if (!result.valid) {
    console.error('検証エラー:');
    result.errors.forEach(function (m) { console.error('  - ' + m); });
    process.exit(1);
  }
  result.warnings.forEach(function (m) { console.warn('警告: ' + m); });

  var slug = data.slug;
  var rootHtml = path.join(REPO_ROOT, slug + '.html');
  if (fs.existsSync(rootHtml)) {
    fail(slug + '.html は既に存在します（slug/記事番号の衝突）。');
  }

  var outHtml = path.join(args.outDir, slug + '.html');
  var outCard = path.join(args.outDir, slug + '.card.html');
  var outMap = path.join(args.outDir, slug + '.sitemap.xml');
  if (!args.force && fs.existsSync(outHtml)) {
    fail(outHtml + ' は既に存在します（--force で上書き）。');
  }

  var html = renderArticleHtml(data, cat);
  var card = renderListingCard(data, cat);
  var sitemap = renderSitemapEntry(data, cat);

  if (args.dryRun) {
    process.stdout.write(html);
    console.error('\nDry run OK: would write ' + outHtml);
    console.error('  + ' + outCard + ' (一覧カード断片)');
    console.error('  + ' + outMap + ' (sitemap断片)');
    return;
  }

  fs.mkdirSync(args.outDir, { recursive: true });
  fs.writeFileSync(outHtml, html, 'utf8');
  fs.writeFileSync(outCard, card + '\n', 'utf8');
  fs.writeFileSync(outMap, sitemap + '\n', 'utf8');
  console.log('Generated:');
  console.log('  ' + outHtml);
  console.log('  ' + outCard);
  console.log('  ' + outMap);
  console.log('\n次のステップ: staging を確認 → 問題なければ apply.js で本番反映（人間確認後）。');
}

main();
