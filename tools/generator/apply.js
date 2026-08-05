#!/usr/bin/env node
/**
 * Apply a staged yurulog / carwash / cooking article to the site.
 * Mirrors tools/travel/apply.js safety model. Run ONLY after human review
 * of staging/{slug}.html.
 *
 * Usage:
 *   node tools/generator/apply.js drafts/cooking-1.json --dry-run
 *   node tools/generator/apply.js drafts/cooking-1.json
 *   node tools/generator/apply.js drafts/cooking-1.json --force
 *
 * Steps:
 *   1. validate ready JSON
 *   2. require staging/{slug}.html (generate.js first)
 *   3. refuse if root {slug}.html exists (--force overrides)
 *   4. copy staging → root {slug}.html
 *   5. prepend listing card into {listingFile} after the hero <section>
 *      (skips if href="{slug}.html" already present)
 *   6. insert sitemap <url> before </urlset> (skips if loc already present)
 *   7. bump tools/generator/next-ids.json for the category
 *
 * Never deletes/moves existing files or reorders sitemap URLs.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const CC = require('./category-config');
const { validateAny } = require('./validate-common');
const { renderListingCard, renderSitemapEntry } = require('./renderers');

const REPO_ROOT = path.resolve(__dirname, '../..');
const STAGING = path.join(REPO_ROOT, 'staging');
const NEXT_IDS = path.join(__dirname, 'next-ids.json');

function fail(msg) { console.error('Error: ' + msg); process.exit(1); }

function parseArgs(argv) {
  var a = { jsonPath: null, dryRun: false, force: false };
  for (var i = 2; i < argv.length; i++) {
    var x = argv[i];
    if (x === '--dry-run') a.dryRun = true;
    else if (x === '--force') a.force = true;
    else if (x.indexOf('-') === 0) fail('unknown option ' + x);
    else if (!a.jsonPath) a.jsonPath = path.resolve(x);
    else fail('unexpected argument ' + x);
  }
  if (!a.jsonPath) fail('Usage: node tools/generator/apply.js <json> [--dry-run] [--force]');
  return a;
}

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { fail('cannot read/parse JSON: ' + p + ' (' + e.message + ')'); }
}

function insertListingCard(listingPath, cardHtml, slug, force, plan) {
  var html = fs.readFileSync(listingPath, 'utf8');
  if (html.indexOf('href="' + slug + '.html"') !== -1) {
    plan.push('  [skip] ' + path.basename(listingPath) + ' に ' + slug + ' のカードは既に存在');
    return html;
  }
  var heroIdx = html.indexOf('<section class="hero">');
  if (heroIdx === -1) fail(path.basename(listingPath) + ' に hero セクションが見つかりません。');
  var closeIdx = html.indexOf('</section>', heroIdx);
  if (closeIdx === -1) fail(path.basename(listingPath) + ' の hero 終了タグが見つかりません。');
  var insertAt = closeIdx + '</section>'.length;
  var updated =
    html.slice(0, insertAt) + '\n\n' + cardHtml + html.slice(insertAt);
  plan.push('  [update] ' + path.basename(listingPath) + ' の先頭（hero直後）にカードを追加');
  return updated;
}

function insertSitemap(sitemapPath, entry, loc, plan) {
  var xml = fs.readFileSync(sitemapPath, 'utf8');
  if (xml.indexOf('<loc>' + loc + '</loc>') !== -1) {
    plan.push('  [skip] sitemap.xml に ' + loc + ' は既に存在');
    return xml;
  }
  var closeIdx = xml.lastIndexOf('</urlset>');
  if (closeIdx === -1) fail('sitemap.xml に </urlset> が見つかりません。');
  var updated = xml.slice(0, closeIdx) + entry + '\n' + xml.slice(closeIdx);
  plan.push('  [update] sitemap.xml に ' + loc + ' を追加');
  return updated;
}

function bumpNextId(category, id, plan) {
  var data = {};
  try { data = JSON.parse(fs.readFileSync(NEXT_IDS, 'utf8')); } catch (e) {}
  var cur = typeof data[category] === 'number' ? data[category] : 0;
  if (id >= cur) {
    data[category] = id + 1;
    plan.push('  [update] next-ids.json: ' + category + ' → ' + (id + 1));
    return JSON.stringify(data, null, 2) + '\n';
  }
  plan.push('  [skip] next-ids.json: ' + category + ' は ' + cur + ' のまま');
  return null;
}

function main() {
  var args = parseArgs(process.argv);
  var data = readJson(args.jsonPath);

  var cat = CC.getCategory(data.category);
  if (!cat) fail('unknown category: ' + String(data.category));
  if (cat.legacy) fail('travel は tools/travel/apply.js を使用してください。');

  var res = validateAny(data, { mode: 'ready' });
  if (data.status !== 'ready' || !res.valid) {
    console.error('検証エラー（ready でない/必須不足）:');
    if (data.status !== 'ready') console.error('  - status が ready ではありません: ' + data.status);
    res.errors.forEach(function (m) { console.error('  - ' + m); });
    process.exit(1);
  }

  var slug = data.slug;
  var stagingHtml = path.join(STAGING, slug + '.html');
  if (!fs.existsSync(stagingHtml)) {
    fail(stagingHtml + ' がありません。先に generate.js を実行してください。');
  }

  var rootHtml = path.join(REPO_ROOT, slug + '.html');
  if (fs.existsSync(rootHtml) && !args.force) {
    fail(slug + '.html は既に存在します（--force で上書き）。');
  }

  var listingPath = path.join(REPO_ROOT, cat.listingFile);
  if (!fs.existsSync(listingPath)) {
    fail(cat.listingFile + ' が見つかりません（一覧ページ）。');
  }
  var sitemapPath = path.join(REPO_ROOT, 'sitemap.xml');

  var plan = [];
  plan.push('  [copy] staging/' + slug + '.html → ' + slug + '.html');
  var newListing = insertListingCard(listingPath, renderListingCard(data, cat), slug, args.force, plan);
  var loc = cat.canonicalBase + data.id;
  var newSitemap = fs.existsSync(sitemapPath)
    ? insertSitemap(sitemapPath, renderSitemapEntry(data, cat), loc, plan)
    : null;
  var newNextIds = bumpNextId(data.category, data.id, plan);

  console.log('計画:');
  plan.forEach(function (l) { console.log(l); });

  if (args.dryRun) {
    console.log('\n--dry-run: ファイルは書き込みません。');
    return;
  }

  fs.copyFileSync(stagingHtml, rootHtml);
  fs.writeFileSync(listingPath, newListing, 'utf8');
  if (newSitemap) fs.writeFileSync(sitemapPath, newSitemap, 'utf8');
  if (newNextIds) fs.writeFileSync(NEXT_IDS, newNextIds, 'utf8');
  console.log('\n反映完了。git diff で確認してください。');
}

main();
