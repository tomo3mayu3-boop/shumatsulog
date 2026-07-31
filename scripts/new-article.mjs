#!/usr/bin/env node
/**
 * new-article.mjs — Journey Intro 新記事の config 雛形ジェネレータ（ビルド時のみ・エンジン非改変）
 *
 * 新記事は「①この雛形で config を出力 → ②記事HTMLに4点を貼付 → ③動画を書き出す」だけで開始できる。
 * 出力する config は travel-17 の確定プリセット（fx.heroZoom:false / heroCrossfadeMs:1000 / video.arrivalEase:false /
 * startAt 3.5・playSeconds 16.0 / vector-v2）をベースに、記事固有値（id・目的地・座標・動画slug）を埋めたもの。
 *
 * 使い方:
 *   node scripts/new-article.mjs --id travel-18 --jp 川平湾 --ro "Kabira Bay" --lat 24.454 --lon 124.145
 *
 * 主なオプション:
 *   --id <slug>        * 記事ID（例 travel-18）。video-slug 既定にも使用
 *   --jp <名>          * 目的地名(日本語)
 *   --ro <name>        * 目的地名(ローマ字)
 *   --lat <n> --lon <n> * 目的地の緯度・経度
 *   --video-slug <s>   動画ディレクトリ slug（既定 = --id）
 *   --map <name>       vector-v2(既定) | abstract-v1
 *   --start <s>        video.startAt（既定 3.5）
 *   --play <s>         video.playSeconds＝Hero接続点（既定 16.0）
 *   --vparam <n>       動画URLのキャッシュ更新用 ?v=（既定 1）
 *   --config-out <f>   config JSON をファイルにも書き出す（省略時は標準出力のみ）
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return (v === undefined || v.startsWith('--')) ? true : v;
}

const ID = arg('id');
const JP = arg('jp');
const RO = arg('ro');
const LAT = arg('lat') != null ? parseFloat(arg('lat')) : null;
const LON = arg('lon') != null ? parseFloat(arg('lon')) : null;
if (!ID || !JP || !RO || LAT == null || LON == null || isNaN(LAT) || isNaN(LON)) {
  console.error('必須: --id <slug> --jp <名> --ro <name> --lat <n> --lon <n>');
  console.error('例:  node scripts/new-article.mjs --id travel-18 --jp 川平湾 --ro "Kabira Bay" --lat 24.454 --lon 124.145');
  process.exit(1);
}
const VSLUG = arg('video-slug', ID);
const MAP = arg('map', 'vector-v2');
const START = parseFloat(arg('start', '3.5'));
const PLAY = parseFloat(arg('play', '16.0'));
const VP = arg('vparam', '1');
const CONFIG_OUT = arg('config-out');

/* 記事スクリプトの ?v= を travel-17 に合わせる（同一値に揃えるとキャッシュ運用が楽） */
let ENGINE_V = '1';
try {
  const t17 = readFileSync(path.join(ROOT, 'travel-17.html'), 'utf8');
  const m = t17.match(/journey-intro\.js\?v=(\w+)/);
  if (m) ENGINE_V = m[1];
} catch { /* noop */ }

const vdir = 'assets/video/' + VSLUG + '/';
const q = '?v=' + VP;

/* travel-17 確定プリセット + 記事固有値 */
const config = {
  version: 1,
  id: ID,
  route: {
    map: MAP,
    /* 航路は flight viewBox 300×300 の抽象座標。既定は travel-17 の実績パス（経由地名と終端の向きを調整） */
    path: 'M258 44 Q249 68 244 92 Q236 118 222 140 Q190 152 150 150',
    waypoints: [
      { jp: '東京', ro: 'Tokyo', node: [258, 44] },
      { jp: '沖縄', ro: 'Okinawa', node: [244, 92] },
      { jp: '宮古島', ro: 'Miyakojima', node: [222, 140] }
    ],
    introLabel: { jp: '世界', ro: 'The World' }
    /* descent 省略 = 既定(日本→南西諸島→宮古)。別地域は CONFIG.md §7 参照 */
  },
  destination: { jp: JP, ro: RO, lat: LAT, lon: LON },
  video: {
    src: vdir + 'arrival-720.mp4' + q,
    sources: [
      { src: vdir + 'arrival-720.mp4' + q, maxWidth: 640, tier: 'mobile' },
      { src: vdir + 'arrival-1080.mp4' + q, maxWidth: 1024, tier: 'tablet' },
      { src: vdir + 'arrival-1080.mp4' + q, tier: 'desktop' }
    ],
    poster: vdir + 'arrival-poster.webp' + q,
    startAt: START, playSeconds: PLAY, arrivalEase: false
  },
  fx: { heroZoom: false },
  timing: { heroCrossfadeMs: 1000 },
  skip: { button: true, label: 'スキップ', oncePerSession: true }
};

const json = JSON.stringify(config, null, 2);

/* 別地域チェック（vector-v2 の降下は宮古・八重山データのみ） */
const outOfRegion = (MAP === 'vector-v2') && (LAT < 22 || LAT > 27 || LON < 122 || LON > 128);

console.log('=== ① config（記事HTMLの <script type="application/json" id="journey-intro-config"> に貼付）===\n');
console.log(json);

console.log('\n=== ② 記事HTMLに差し込む4点 ===\n');
console.log('<!-- head -->');
console.log('<link rel="stylesheet" href="assets/journey/journey-intro.css">\n');
console.log('<!-- Hero画像に ji-hero を付与（フェード着地先＝先読み対象） -->');
console.log('<img src="images/travel/' + VSLUG + '/hero.webp" class="viewer-photo ji-hero" width="1600" height="2844" alt="' + JP + '">\n');
console.log('<!-- body末尾: 上の①config を貼った <script id="journey-intro-config"> と、共有スクリプト -->');
console.log('<script src="assets/journey/map-data/journey-map.v1.js?v=' + ENGINE_V + '" defer></script>');
console.log('<script src="assets/journey/journey-intro.js?v=' + ENGINE_V + '" defer></script>');

console.log('\n=== ③ 動画の書き出し（マスター動画から720/1080/poster生成）===\n');
console.log('node scripts/build-video-renditions.mjs --in "<マスター動画>" --slug ' + VSLUG + ' --poster-at ' + START);
console.log('  → 出力された sources/poster スニペットと①の video が一致することを確認（?v= は差替え時に更新）');

console.log('\n=== ④ チェックリスト ===');
console.log('  [ ] 記事HTMLに ①config と ②4点 を貼付');
console.log('  [ ] Hero <img> に class="ji-hero"');
console.log('  [ ] route.path / waypoints を目的地に合わせて調整（既定は travel-17 のパス）');
console.log('  [ ] 動画を ' + vdir + ' に生成（③）');
console.log('  [ ] DevTools コンソールに [JourneyIntro] config 検証 の警告が出ないこと（0件が正常）');
if (outOfRegion) {
  console.log('\n⚠ 注意: 目的地(' + LAT + ',' + LON + ') は宮古・八重山エリア外です。');
  console.log('  vector-v2 の降下海岸線は宮古周辺データのため形が一致しません。');
  console.log('  → 当面は route.map:"abstract-v1"（地域非依存）を推奨、または CONFIG.md §7 に従い地域データを追加。');
}

if (CONFIG_OUT) {
  const outPath = path.isAbsolute(CONFIG_OUT) ? CONFIG_OUT : path.join(ROOT, CONFIG_OUT);
  if (existsSync(outPath)) { console.error('\n✗ 既存ファイルを上書きしません: ' + outPath); process.exit(1); }
  writeFileSync(outPath, json + '\n', 'utf8');
  console.log('\n✓ config を書き出しました: ' + outPath);
}
console.log('\n✓ done（エンジン・既存記事は無変更。この出力を貼るだけで新記事の Journey が動きます）');
