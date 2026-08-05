#!/usr/bin/env node
/**
 * Library-level test suite for the multi-category pipeline.
 * Run: node tools/generator/test.js
 * (CLI/staging/collision/sitemap checks live in test-cli.sh.)
 */

'use strict';

const path = require('path');
const CC = require('./category-config');
const { validateAny } = require('./validate-common');
const { computeNextIds } = require('./next-id');
const { renderArticleHtml, renderListingCard, renderSitemapEntry } = require('./renderers');
const legacyReady = require('../travel/validate-ready');

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log('  ok  - ' + name); }
  else { fail++; console.log('  FAIL- ' + name); }
}
function load(f) { return require(path.join(__dirname, 'fixtures', f)); }

console.log('\n[1] 既存 travel JSON が従来どおり検証を通る（互換）');
const travel17 = require('../../drafts/travel-17.json');
ok('travel-17.json は legacy validate-ready を通る', legacyReady.validateReady(travel17).valid);
ok('travel-17.json は validate-common 経由でも通る（travelは委譲）', validateAny(travel17).valid);
ok('travel の category 判定が legacy=true', CC.getCategory('travel').legacy === true);

console.log('\n[2] yurulog / carwash / cooking のテスト JSON が作成・検証できる');
const y = load('mock-yurulog-6.json');
const c = load('mock-cooking-1.json');
const w = load('mock-carwash-3.json');
ok('yurulog ready 検証OK', validateAny(y, { mode: 'ready' }).valid);
ok('cooking ready 検証OK', validateAny(c, { mode: 'ready' }).valid);
ok('carwash ready 検証OK', validateAny(w, { mode: 'ready' }).valid);

console.log('\n[3] カテゴリ別の必須バリデーションが働く');
ok('存在しないカテゴリを拒否', validateAny({ category: 'foo' }).errors.length > 0);
ok('cooking: dishName 未入力を draft でも拒否',
  validateAny({ ...c, categoryData: { ...c.categoryData, dishName: '' } }).errors.some(e => e.includes('料理名')));
ok('yurulog: ready で listing 系必須が不足を検出',
  validateAny({ ...y, listingTitle: '', listingDescription: '', imageFolder: '', thumbnail: '' }, { mode: 'ready' }).errors.length >= 4);
ok('不正な日付を拒否', validateAny({ ...y, date: '2026-13-40' }).errors.some(e => e.includes('公開日')));
ok('slug 不一致を拒否', validateAny({ ...y, slug: 'yurulog-99' }).errors.some(e => e.includes('slug')));
ok('画像枚数と画像情報の不一致を拒否',
  validateAny({ ...y, images: [{ index: 1, alt: 'a' }] }, { mode: 'ready' }).errors.some(e => e.includes('一致')));

console.log('\n[4] 記事番号がカテゴリ別に自動提案される（max+1・ハードコードなし）');
const ni = computeNextIds();
ok('travel=18 (travel-17まで)', ni.travel === 18);
ok('yurulog=6 (yurulog-5まで)', ni.yurulog === 6);
ok('carwash=3 (carwash-2まで)', ni.carwash === 3);
ok('cooking=1 (記事なし)', ni.cooking === 1);

console.log('\n[5] カテゴリ別の一覧カードが正しく生成される');
const yCard = renderListingCard(y, CC.getCategory('yurulog'));
const wCard = renderListingCard(w, CC.getCategory('carwash'));
ok('yurulog カードは post-date を含む', yCard.includes('post-date'));
ok('carwash カードは post-date を含まない（既存構造に合わせ）', !wCard.includes('post-date'));
ok('カードは正しい slug へリンク', yCard.includes('href="yurulog-6.html"') && wCard.includes('href="carwash-3.html"'));
ok('カードは のぞく ボタン', yCard.includes('>のぞく<'));

console.log('\n[6] 生成HTMLの主要要素');
const cHtml = renderArticleHtml(c, CC.getCategory('cooking'));
ok('cooking: canonical 拡張子なし', cHtml.includes('<link rel="canonical" href="https://shumatsulog.com/cooking-1">'));
ok('cooking: og:url 拡張子なし', cHtml.includes('property="og:url" content="https://shumatsulog.com/cooking-1"'));
ok('cooking: サイト内リンクは .html', cHtml.includes('href="cooking.html"'));
ok('cooking: Article JSON-LD', cHtml.includes('"@type":"Article"'));
ok('cooking: BreadcrumbList JSON-LD', cHtml.includes('"@type":"BreadcrumbList"'));
ok('cooking: 材料+工程ありで Recipe JSON-LD', cHtml.includes('"@type":"Recipe"'));
ok('cooking: 料理ナビが解除されている（span.category disabled なし）', !cHtml.includes('category disabled'));
const cNoRecipe = renderArticleHtml({ ...c, categoryData: { ...c.categoryData, ingredients: [], steps: [] } }, CC.getCategory('cooking'));
ok('cooking: 材料/工程なしでは Recipe を出さない（Articleのみ）', !cNoRecipe.includes('"@type":"Recipe"'));
const wHtml = renderArticleHtml(w, CC.getCategory('carwash'));
ok('carwash: gallery/Before-After 構造', wHtml.includes('class="gallery"') && wHtml.includes('ba-container'));
ok('carwash: carwash-detail.js を読み込む', wHtml.includes('carwash-detail.js'));

console.log('\n[7] sitemap エントリ');
const entry = renderSitemapEntry(c, CC.getCategory('cooking'));
ok('sitemap loc は拡張子なし', entry.includes('<loc>https://shumatsulog.com/cooking-1</loc>'));

console.log('\n結果: ' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail === 0 ? 0 : 1);
