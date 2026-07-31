#!/usr/bin/env node
/**
 * build-video-renditions.mjs — Journey Engine V3 動画レンディション生成(ビルド時のみ)
 *
 * マスター動画から 540 / 720 / 1080 幅(縦)の H.264 faststart 無音 mp4 と、
 * Hero接続前(=動画再生開始 startAt 付近)の poster.webp を生成する。
 * ランタイム(engine)は startAt/playSeconds で再生区間を制御するため、ここでは尺トリムしない。
 *
 * 使い方:
 *   node scripts/build-video-renditions.mjs \
 *     --in "C:/path/to/master.MP4" --slug travel-17 --poster-at 3.5
 *
 * オプション:
 *   --in <path>        マスター動画(必須)
 *   --slug <name>      出力先 assets/video/<slug>/ (必須)
 *   --poster-at <sec>  poster を切り出す秒数(既定 0)。通常は config の startAt と揃える
 *   --name <base>      出力ベース名(既定 arrival) → arrival-540.mp4 等
 *   --ffmpeg <path>    ffmpeg 実行ファイル(未指定なら ffmpeg-static → $FFMPEG の順に解決)
 *   --dry              コマンドを表示するだけで実行しない
 *
 * ffmpeg は devDependency の ffmpeg-static を想定(build-map-data.mjs と同方式)。
 * 未インストール時は --ffmpeg か環境変数 FFMPEG で実行ファイルを渡す。
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

/* ---- レンディション定義(縦・9:16) ---- */
const TIERS = [
  { tier: 'mobile',  width: 540,  crf: 26 },
  { tier: 'tablet',  width: 720,  crf: 24 }, // 現行 journey-arrival-v2.mp4 と同条件
  { tier: 'desktop', width: 1080, crf: 22 },
];

const OUTDIR = path.join(ROOT, 'assets', 'video', SLUG);
if (!DRY) mkdirSync(OUTDIR, { recursive: true });

function run(label, args) {
  console.log('\n▶ ' + label + '\n  ' + FFMPEG + ' ' + args.join(' '));
  if (DRY) return;
  const r = spawnSync(FFMPEG, args, { stdio: ['ignore', 'ignore', 'inherit'] });
  if (r.status !== 0) { console.error('  ✗ ffmpeg 失敗 (' + label + ')'); process.exit(r.status || 1); }
}
function human(bytes) {
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

console.log('master : ' + IN);
console.log('outdir : ' + OUTDIR);
console.log('ffmpeg : ' + FFMPEG);
console.log('poster@: ' + POSTER_AT + 's');

const results = [];
for (const t of TIERS) {
  const out = path.join(OUTDIR, BASE + '-' + t.width + '.mp4');
  run(t.tier + ' ' + t.width + 'w (crf ' + t.crf + ')', [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-i', IN,
    '-map', '0:v:0',
    '-vf', 'scale=' + t.width + ':-2',
    '-c:v', 'libx264', '-crf', String(t.crf), '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
    '-an', '-movflags', '+faststart',
    out,
  ]);
  results.push({ ...t, out, file: BASE + '-' + t.width + '.mp4' });
}

/* ---- poster (webp・Hero接続前フレーム) ---- */
const posterOut = path.join(OUTDIR, BASE + '-poster.webp');
run('poster ' + BASE + '-poster.webp @' + POSTER_AT + 's', [
  '-y', '-hide_banner', '-loglevel', 'error',
  '-i', IN, '-ss', String(POSTER_AT), '-frames:v', '1',
  '-vf', 'scale=720:-2', '-c:v', 'libwebp', '-quality', '82',
  posterOut,
]);

/* ---- サイズレポート ---- */
if (!DRY) {
  console.log('\n=== 生成結果 (assets/video/' + SLUG + '/) ===');
  for (const r of results) {
    console.log('  ' + r.tier.padEnd(8) + r.file.padEnd(18) + human(statSync(r.out).size));
  }
  console.log('  ' + 'poster'.padEnd(8) + (BASE + '-poster.webp').padEnd(18) + human(statSync(posterOut).size));

  /* config へ貼れる sources/poster スニペット */
  const rel = 'assets/video/' + SLUG + '/';
  console.log('\n=== config スニペット (travel-*.html の video に貼付) ===');
  console.log(JSON.stringify({
    src: rel + BASE + '-720.mp4',
    sources: [
      { src: rel + BASE + '-540.mp4', maxWidth: 640, tier: 'mobile' },
      { src: rel + BASE + '-720.mp4', maxWidth: 1024, tier: 'tablet' },
      { src: rel + BASE + '-1080.mp4', tier: 'desktop' },
    ],
    poster: rel + BASE + '-poster.webp',
  }, null, 2));
}
console.log('\n✓ done');
