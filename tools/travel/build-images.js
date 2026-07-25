#!/usr/bin/env node
/**
 * Build travel article images from a source folder (Phase 1 iPhone pipeline).
 *
 * Reads raw photos (as attached from iPhone), and for each photo produces
 * AVIF + WebP at the requested variant widths plus a full size, writes them to
 * `images/travel/{folder}/`, generates a 1200x630 OG JPEG, and emits a build
 * fragment JSON (imageFolder / imagePrefix / orientation / photos[] / ogImage)
 * for the assembly step to merge into the ready JSON.
 *
 * It does NOT write prose, alt text, SEO, or sidebar — those are authored by
 * Claude in the assembly step. `alt` is emitted empty for Claude to fill.
 *
 * Privacy: sharp strips ALL input metadata by default (no withMetadata call),
 * so GPS / capture time / device model in the source EXIF are removed from every
 * output. EXIF orientation is baked in via .rotate() before it is dropped.
 *
 * Usage:
 *   node tools/travel/build-images.js --src <dir> --folder <name>
 *   node tools/travel/build-images.js --src drafts/incoming/sui --folder sui --prefix sui-
 *   node tools/travel/build-images.js --src <dir> --folder <name> --variants 400,800
 *   node tools/travel/build-images.js --src <dir> --folder <name> --dry-run
 *   node tools/travel/build-images.js --src <dir> --folder <name> --out-json drafts/travel-17.build.json
 */

'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const REPO_ROOT = path.resolve(__dirname, '../..');

const DEFAULT_VARIANTS = [400, 800];
const MAX_FULL_WIDTH = 1600;
const AVIF_QUALITY = 50;
const WEBP_QUALITY = 82;
const OG_QUALITY = 80;
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const SRC_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.tif', '.tiff'];

/**
 * @param {string[]} argv
 * @returns {{ src: string, folder: string, prefix: string, variants: number[], maxFull: number, dryRun: boolean, force: boolean, outJson: string|null }}
 */
function parseArgs(argv) {
  var args = {
    src: null,
    folder: null,
    prefix: null,
    variants: DEFAULT_VARIANTS.slice(),
    maxFull: MAX_FULL_WIDTH,
    ogIndex: 1,
    dryRun: false,
    force: false,
    outJson: null,
  };

  for (var i = 2; i < argv.length; i++) {
    var arg = argv[i];
    if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--force') {
      args.force = true;
    } else if (arg === '--src') {
      args.src = requireValue(argv, ++i, '--src');
    } else if (arg === '--folder') {
      args.folder = requireValue(argv, ++i, '--folder');
    } else if (arg === '--prefix') {
      args.prefix = requireValue(argv, ++i, '--prefix');
    } else if (arg === '--out-json') {
      args.outJson = requireValue(argv, ++i, '--out-json');
    } else if (arg === '--variants') {
      var raw = requireValue(argv, ++i, '--variants');
      args.variants = raw
        .split(',')
        .map(function (s) { return parseInt(s.trim(), 10); })
        .filter(function (n) { return Number.isFinite(n) && n > 0; });
    } else if (arg === '--max-full') {
      args.maxFull = parseInt(requireValue(argv, ++i, '--max-full'), 10);
    } else if (arg === '--og-index') {
      args.ogIndex = parseInt(requireValue(argv, ++i, '--og-index'), 10);
    } else {
      fail('unknown option ' + arg);
    }
  }

  if (!args.src || !args.folder) {
    fail('Usage: node tools/travel/build-images.js --src <dir> --folder <name> [--prefix p-] [--variants 400,800] [--og-index 1] [--dry-run] [--force] [--out-json path]');
  }
  if (args.prefix === null) {
    args.prefix = args.folder + '-';
  }
  return args;
}

function requireValue(argv, index, name) {
  if (index >= argv.length) {
    fail(name + ' requires a value');
  }
  return argv[index];
}

function fail(message) {
  console.error('Error: ' + message);
  process.exit(1);
}

/**
 * List candidate source image files, sorted by filename (index order).
 * @param {string} dir
 * @returns {string[]}
 */
function listSourceImages(dir) {
  var entries = fs.readdirSync(dir);
  var files = entries.filter(function (name) {
    var ext = path.extname(name).toLowerCase();
    return SRC_EXTS.indexOf(ext) !== -1;
  });
  files.sort(function (a, b) {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  });
  return files.map(function (name) { return path.join(dir, name); });
}

/**
 * Produce one encoded output buffer at a target width.
 * @param {Buffer} inputBuf
 * @param {'avif'|'webp'|'jpeg'} format
 * @param {number|null} width  null = full (capped by maxFull)
 * @param {number} maxFull
 * @returns {Promise<{ data: Buffer, info: { width: number, height: number } }>}
 */
function encode(inputBuf, format, width, maxFull) {
  var pipeline = sharp(inputBuf).rotate();
  if (width === null) {
    pipeline = pipeline.resize({ width: maxFull, withoutEnlargement: true });
  } else {
    pipeline = pipeline.resize({ width: width, withoutEnlargement: true });
  }
  if (format === 'avif') {
    pipeline = pipeline.avif({ quality: AVIF_QUALITY });
  } else if (format === 'webp') {
    pipeline = pipeline.webp({ quality: WEBP_QUALITY });
  } else {
    pipeline = pipeline.jpeg({ quality: OG_QUALITY });
  }
  return pipeline.toBuffer({ resolveWithObject: true });
}

/**
 * Cover-crop OG image (1200x630 JPEG) from the hero photo.
 * @param {Buffer} inputBuf
 * @returns {Promise<Buffer>}
 */
function encodeOg(inputBuf) {
  return sharp(inputBuf)
    .rotate()
    .resize(OG_WIDTH, OG_HEIGHT, { fit: 'cover' })
    .jpeg({ quality: OG_QUALITY })
    .toBuffer();
}

function writeFileMaybe(targetPath, buffer, dryRun) {
  if (dryRun) {
    return;
  }
  fs.writeFileSync(targetPath, buffer);
}

async function main() {
  var args = parseArgs(process.argv);

  var srcDir = path.resolve(args.src);
  if (!fs.existsSync(srcDir) || !fs.statSync(srcDir).isDirectory()) {
    fail('source directory not found: ' + srcDir);
  }

  var sources = listSourceImages(srcDir);
  if (sources.length === 0) {
    fail('no source images (' + SRC_EXTS.join(', ') + ') in ' + srcDir);
  }

  var targetDir = path.join(REPO_ROOT, 'images', 'travel', args.folder);
  var relTargetDir = 'images/travel/' + args.folder;

  // Collision guard (unless --force / --dry-run).
  if (fs.existsSync(targetDir) && !args.force && !args.dryRun) {
    var existing = fs.readdirSync(targetDir).filter(function (n) {
      return n.indexOf(args.prefix) === 0;
    });
    if (existing.length > 0) {
      fail(relTargetDir + ' already has files with prefix "' + args.prefix + '". Use --force to overwrite.');
    }
  }

  if (!args.dryRun) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  var smallerVariants = args.variants.slice().sort(function (a, b) { return a - b; });
  var photos = [];
  var writtenCount = 0;

  console.error('Source: ' + srcDir + ' (' + sources.length + ' image(s))');
  console.error('Target: ' + relTargetDir + '  prefix="' + args.prefix + '"');

  for (var i = 0; i < sources.length; i++) {
    var index = i + 1;
    var inputBuf;
    try {
      inputBuf = fs.readFileSync(sources[i]);
    } catch (err) {
      fail('cannot read ' + sources[i]);
    }

    var fullWebp;
    try {
      fullWebp = await encode(inputBuf, 'webp', null, args.maxFull);
    } catch (err) {
      fail('cannot decode ' + path.basename(sources[i]) + ' (' + err.message + '). ' +
        'If this is a HEIC file, re-share it as JPEG/PNG.');
    }

    var fullWidth = fullWebp.info.width;
    var fullHeight = fullWebp.info.height;
    var base = path.join(targetDir, args.prefix + index);

    // Full size (no width suffix).
    var fullAvif = await encode(inputBuf, 'avif', null, args.maxFull);
    writeFileMaybe(base + '.webp', fullWebp.data, args.dryRun);
    writeFileMaybe(base + '.avif', fullAvif.data, args.dryRun);
    writtenCount += 2;

    // Smaller variants strictly narrower than the full width.
    var appliedVariants = [];
    for (var v = 0; v < smallerVariants.length; v++) {
      var w = smallerVariants[v];
      if (w >= fullWidth) {
        continue;
      }
      var vAvif = await encode(inputBuf, 'avif', w, args.maxFull);
      var vWebp = await encode(inputBuf, 'webp', w, args.maxFull);
      writeFileMaybe(base + '-' + w + '.webp', vWebp.data, args.dryRun);
      writeFileMaybe(base + '-' + w + '.avif', vAvif.data, args.dryRun);
      writtenCount += 2;
      appliedVariants.push(w);
    }

    var variantsArray = appliedVariants.concat([fullWidth]);
    photos.push({
      index: index,
      alt: '',
      width: fullWidth,
      height: fullHeight,
      variants: variantsArray,
    });

    console.error(
      '  [' + index + '] ' + path.basename(sources[i]) +
      ' → ' + fullWidth + 'x' + fullHeight +
      ' variants=' + variantsArray.join('/')
    );
  }

  // OG image (JPEG 1200x630, no WebP — X can't render WebP OG cards).
  // Defaults to the hero photo; use --og-index to pick a landscape shot.
  if (args.ogIndex < 1 || args.ogIndex > sources.length) {
    fail('--og-index ' + args.ogIndex + ' out of range (1-' + sources.length + ')');
  }
  var ogFilename = args.prefix + 'og.jpg';
  var ogBuf = await encodeOg(fs.readFileSync(sources[args.ogIndex - 1]));
  writeFileMaybe(path.join(targetDir, ogFilename), ogBuf, args.dryRun);
  writtenCount += 1;
  if (args.ogIndex !== 1) {
    console.error('  OG source: photo ' + args.ogIndex);
  }

  var orientation = photos[0].width >= photos[0].height ? 'landscape' : 'portrait';

  var fragment = {
    imageFolder: args.folder,
    imagePrefix: args.prefix,
    orientation: orientation,
    photos: photos,
    ogImage: { filename: ogFilename, width: OG_WIDTH, height: OG_HEIGHT },
  };

  var fragmentJson = JSON.stringify(fragment, null, 2) + '\n';

  if (args.outJson) {
    if (!args.dryRun) {
      fs.writeFileSync(path.resolve(args.outJson), fragmentJson, 'utf8');
      console.error('Build fragment written: ' + args.outJson);
    } else {
      console.error('Dry run — would write build fragment to: ' + args.outJson);
    }
  }

  // Fragment always goes to stdout so the assembly step can capture it.
  process.stdout.write(fragmentJson);

  console.error(
    (args.dryRun ? 'Dry run OK: would write ' : 'Wrote ') +
    writtenCount + ' file(s) to ' + relTargetDir +
    ' (' + photos.length + ' photo(s), OG ' + ogFilename + ')'
  );
}

main().catch(function (err) {
  console.error('Error: ' + (err && err.message ? err.message : err));
  process.exit(1);
});
