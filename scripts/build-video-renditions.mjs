#!/usr/bin/env node
/**
 * build-video-renditions.mjs — Journey Engine V3 動画レンディション生成(ビルド時のみ)
 *
 * マスター動画から Journey Intro 用の H.264 faststart 無音 縦mp4 と poster.webp を生成する。
 * ランタイム(engine)は startAt/playSeconds で再生区間を制御するため、ここでは尺トリムしない。
 *
 * ■ 現行の tier 方針（2026-07-31 確定 / 高DPI端末での拡大表示による甘さ対策で540pは廃止）
 *   mobile  = 720p  (viewport ≤640)
 *   tablet  = 1080p (viewport ≤1024)
 *   desktop = 1080p (それ以上)
 *   → 生成する実ファイルは 720 と 1080 の2本。tablet/desktop は同じ 1080 を共有。
 *   共通: CRF20 / preset slow / bt709色タグ明示 / faststart / 無音
 *
 * 使い方:
 *   node scripts/build-video-renditions.mjs \
 *     --in "C:/path/to/master.MP4" --slug travel-17 --poster-at 3.5
 *
 * オプション:
 *   --in <path>        マスター動画(必須)
 *   --slug <name>      出力先 assets/video/<slug>/ (必須)
 *   --poster-at <sec>  poster を切り出す秒数(既定 0)。通常は config の startAt と揃える
 *   --name <base>      出力ベース名(既定 arrival) → arrival-720.mp4 等
 *   --crf <n>          既定 20（全tier共通）
 *   --preset <p>       既定 slow
 *   --ffmpeg <path>    ffmpeg 実行ファイル(未指定なら ffmpeg-static → $FFMPEG の順に解決)
 *   --dry              コマンドを表示するだけで実行しない
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* ---- 引数 ---- */
function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return (v === undefined || v.startsWith('--')) ? true : v;
}
const IN = arg('in');
const SLUG = arg('slug');
const POSTER_AT = parseFloat(arg('poster-at', '0')) || 0;
const BASE = arg('name', 'arrival');
const CRF = String(arg('crf', '20'));
const PRESET = arg('preset', 'slow');
const DRY = !!arg('dry', false);

if (!IN || !SLUG) {
  console.error('必須: --in <master> --slug <name>  (例: --in master.MP4 --slug travel-17 --poster-at 3.5)');
  process.exit(1);
}
if (!existsSync(IN)) { console.error('マスターが見つかりません: ' + IN); process.exit(1); }

/* ---- ffmpeg 解決 ---- */
let FFMPEG = arg('ffmpeg');
if (!FFMPEG || FFMPEG === true) {
  try { FFMPEG = require('ffmpeg-static'); } catch { /* noop */ }
  FFMPEG = process.env.FFMPEG || FFMPEG;
}
if (!FFMPEG) {
  console.error('ffmpeg が見つかりません。`npm i -D ffmpeg-static` するか --ffmpeg <path> / $FFMPEG を指定してください。');
  process.exit(1);
}

/* ---- tier 方針(縦・9:16) ---- */
const RENDITIONS = [
  { tier: 'mobile',  width: 720,  maxWidth: 640 },
  { tier: 'tablet',  width: 1080, maxWidth: 1024 },
  { tier: 'desktop', width: 1080, maxWidth: null },
];
const WIDTHS = [...new Set(RENDITIONS.map(r => r.width))]; // 実生成する一意な幅 = [720, 1080]

const OUTDIR = path.join(ROOT, 'assets', 'video', SLUG);
if (!DRY) mkdirSync(OUTDIR, { recursive: true });

function run(label, args) {
  console.log('\n▶ ' + label + '\n  ' + FFMPEG + ' ' + args.join(' '));
  if (DRY) return;
  const r = spawnSync(FFMPEG, args, { stdio: ['ignore', 'ignore', 'inherit'] });
  if (r.status !== 0) { console.error('  ✗ ffmpeg 失敗 (' + label + ')'); process.exit(r.status || 1); }
}
const human = (b) => (b / 1024 / 1024).toFixed(2) + ' MB';

console.log('master : ' + IN);
console.log('outdir : ' + OUTDIR);
console.log('ffmpeg : ' + FFMPEG);
console.log('設定   : CRF ' + CRF + ' / preset ' + PRESET + ' / bt709色タグ / faststart / 無音');
console.log('poster@: ' + POSTER_AT + 's');

/* ---- レンディション(720 / 1080) ---- */
const made = [];
for (const w of WIDTHS) {
  const out = path.join(OUTDIR, BASE + '-' + w + '.mp4');
  run(w + 'w (crf ' + CRF + ' ' + PRESET + ')', [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-i', IN,
    '-map', '0:v:0',
    '-vf', 'scale=' + w + ':-2',
    '-c:v', 'libx264', '-crf', CRF, '-preset', PRESET, '-pix_fmt', 'yuv420p',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-an', '-movflags', '+faststart',
    out,
  ]);
  made.push({ width: w, out, file: BASE + '-' + w + '.mp4' });
}

/* ---- poster (webp・再生開始フレーム / 黒画面回避) ---- */
const posterOut = path.join(OUTDIR, BASE + '-poster.webp');
run('poster ' + BASE + '-poster.webp @' + POSTER_AT + 's', [
  '-y', '-hide_banner', '-loglevel', 'error',
  '-ss', String(POSTER_AT), '-i', IN, '-frames:v', '1',
  '-vf', 'scale=720:-2', '-c:v', 'libwebp', '-quality', '82',
  posterOut,
]);

/* ---- レポート & config スニペット ---- */
if (!DRY) {
  console.log('\n=== 生成結果 (assets/video/' + SLUG + '/) ===');
  for (const m of made) console.log('  ' + (m.width + 'p').padEnd(7) + m.file.padEnd(18) + human(statSync(m.out).size));
  console.log('  ' + 'poster'.padEnd(7) + (BASE + '-poster.webp').padEnd(18) + human(statSync(posterOut).size));

  const rel = 'assets/video/' + SLUG + '/';
  const sources = RENDITIONS.map(r => {
    const o = { src: rel + BASE + '-' + r.width + '.mp4' };
    if (r.maxWidth != null) o.maxWidth = r.maxWidth;
    o.tier = r.tier;
    return o;
  });
  console.log('\n=== config スニペット (travel-*.html の video に貼付) ===');
  console.log(JSON.stringify({
    src: rel + BASE + '-720.mp4',
    sources,
    poster: rel + BASE + '-poster.webp',
  }, null, 2));
}
console.log('\n✓ done');
