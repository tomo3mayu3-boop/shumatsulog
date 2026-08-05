/**
 * HTML renderers for the multi-category generator (yurulog / carwash / cooking).
 * Node only. Produces staging HTML + listing-card + sitemap fragments that
 * match the existing site's structure. Emits the UNLOCKED cooking nav.
 *
 * travel is NOT rendered here — it keeps its own tools/travel/generate.js path.
 */

'use strict';

const { escapeHtml, escapeAttr } = require('../travel/escape');

const SITE = 'https://shumatsulog.com';
const GTAG =
  '<!-- Google tag (gtag.js) -->\n' +
  '<script async src="https://www.googletagmanager.com/gtag/js?id=G-Q5ZM4M1DXH"></script>';
const PICTURE_SIZES =
  '(max-width: 640px) 100vw, (max-width: 1024px) 60vw, 780px';

// --- small helpers ---------------------------------------------------------
function fmtPostDate(d) {
  var p = String(d).split('-');
  return p.length === 3 ? p.join('.') : String(d);
}

// Plain text for <meta>/JSON-LD contexts: drop <br> markup.
function plain(s) {
  return String(s || '').replace(/<br\s*\/?>/gi, ' ').trim();
}

function imgFile(data, img) {
  if (img && img.file) return img.file;
  return data.imageFolder + '-' + (img ? img.index : 1) + '.webp';
}

function imgPath(cat, data, file) {
  return cat.imageBase + '/' + data.imageFolder + '/' + file;
}

function absImg(cat, data, file) {
  return SITE + '/' + imgPath(cat, data, file);
}

function ldJson(obj) {
  return (
    '<script type="application/ld+json">\n' +
    JSON.stringify(obj) +
    '\n</script>'
  );
}

// --- shared chrome (nav / sidebar / footer) --------------------------------
function navHtml(activeKey) {
  function link(href, key, label) {
    var cur = key === activeKey ? ' aria-current="page"' : '';
    return '    <a href="' + href + '"' + cur + '>' + label + '</a>';
  }
  return [
    '  <nav id="main-nav">',
    link('index.html', null, 'ホーム'),
    link('carwash.html', 'carwash', '洗車'),
    link('cooking.html', 'cooking', '料理'),
    link('travel.html', 'travel', '旅行'),
    link('yurulog.html', 'yurulog', 'ゆるログ'),
    '  </nav>',
  ].join('\n');
}

function headerHtml(cat, activeKey) {
  return [
    '<header>',
    '  <h1>' + cat.headerH1 + '</h1>',
    '  <button class="nav-toggle" aria-label="メニューを開く">☰</button>',
    navHtml(activeKey),
    '</header>',
  ].join('\n');
}

function categoryBox(activeKey) {
  function li(href, key, label) {
    var cur = key === activeKey ? ' aria-current="page"' : '';
    return '        <li><a href="' + href + '"' + cur + '>' + label + '</a></li>';
  }
  return [
    '    <div class="sidebar-box">',
    '      <h3>📂 カテゴリ</h3>',
    '      <ul>',
    li('carwash.html', 'carwash', '🚗 洗車'),
    li('cooking.html', 'cooking', '🍳 料理'),
    li('travel.html', 'travel', '✈️ 旅行'),
    li('yurulog.html', 'yurulog', '🗒️ ゆるログ'),
    '      </ul>',
    '    </div>',
  ].join('\n');
}

function snsBox() {
  return [
    '    <div class="sidebar-box">',
    '      <h3>🔗 SNS</h3>',
    '      <ul class="sns-list">',
    '        <li><a href="https://x.com/potato_weekend" target="_blank" rel="noopener noreferrer">𝕏（Twitter）</a></li>',
    '      </ul>',
    '    </div>',
  ].join('\n');
}

function footerHtml(data, cat) {
  var title = data.title + ' | ' + cat.titleSuffix;
  var canonical = cat.canonicalBase + data.id;
  var shareUrl =
    'https://twitter.com/intent/tweet?text=' +
    encodeURIComponent(title) +
    '&url=' +
    canonical;
  return [
    '<footer>',
    '  <p>© 2026 週末ログ</p>',
    '  <p>',
    '    <a href="https://x.com/potato_weekend" target="_blank" rel="noopener noreferrer">X（Twitter）</a>',
    '    ／',
    '    <a href="https://shumatsulog.com/" target="_blank" rel="noopener noreferrer">HP</a>',
    '  </p>',
    '  <p style="text-align:center;margin:0 0 8px;"><a href="' +
      shareUrl +
      '" target="_blank" rel="noopener noreferrer" class="share-x">𝕏 この記事をシェア</a></p>',
    '</footer>',
  ].join('\n');
}

// --- images ----------------------------------------------------------------
function pictureOrImg(cat, data, img, isFirst) {
  var file = imgFile(data, img);
  var src = imgPath(cat, data, file);
  var alt = escapeAttr(img.alt || '');
  var loading = isFirst ? 'eager' : 'lazy';
  var fp = isFirst ? ' fetchpriority="high"' : '';

  var hasSrcset =
    img.width && img.height && Array.isArray(img.variants) && img.variants.length;

  if (hasSrcset) {
    var baseNoExt = file.replace(/\.(webp|jpe?g|png|avif)$/i, '');
    var dir = cat.imageBase + '/' + data.imageFolder + '/';
    var variants = img.variants.slice().sort(function (a, b) { return a - b; });
    function srcset(fmt) {
      return variants
        .map(function (w) {
          if (w === img.width) return dir + baseNoExt + '.' + fmt + ' ' + w + 'w';
          return dir + baseNoExt + '-' + w + '.' + fmt + ' ' + w + 'w';
        })
        .join(', ');
    }
    return [
      '<picture>',
      '  <source type="image/avif" srcset="' + srcset('avif') + '" sizes="' + PICTURE_SIZES + '">',
      '  <source type="image/webp" srcset="' + srcset('webp') + '" sizes="' + PICTURE_SIZES + '">',
      '  <img src="' + dir + baseNoExt + '.webp" alt="' + alt + '" class="viewer-photo" loading="' +
        loading + '"' + fp + ' width="' + img.width + '" height="' + img.height + '">',
      '</picture>',
    ].join('\n');
  }

  var dims = img.width && img.height ? ' width="' + img.width + '" height="' + img.height + '"' : '';
  return '<img src="' + src + '" alt="' + alt + '" class="viewer-photo" loading="' +
    loading + '"' + fp + dims + '>';
}

function indentBlock(block, spaces) {
  var pad = new Array(spaces + 1).join(' ');
  return block
    .split('\n')
    .map(function (l) { return l.length ? pad + l : l; })
    .join('\n');
}

// --- head ------------------------------------------------------------------
function preloadLink(cat, data) {
  var images = data.images || [];
  var first = images[0];
  if (!first || !first.width || !Array.isArray(first.variants) || !first.variants.length) {
    return null;
  }
  var file = imgFile(data, first);
  var baseNoExt = file.replace(/\.(webp|jpe?g|png|avif)$/i, '');
  var dir = cat.imageBase + '/' + data.imageFolder + '/';
  var variants = first.variants.slice().sort(function (a, b) { return a - b; });
  var srcset = variants
    .map(function (w) {
      if (w === first.width) return dir + baseNoExt + '.avif ' + w + 'w';
      return dir + baseNoExt + '-' + w + '.avif ' + w + 'w';
    })
    .join(', ');
  return (
    '<link rel="preload" as="image" href="' + dir + baseNoExt + '.avif" imagesrcset="' +
    srcset + '" imagesizes="' + PICTURE_SIZES + '" fetchpriority="high">'
  );
}

function recipeJsonLd(data, cat) {
  var cd = data.categoryData || {};
  var ing = cd.ingredients || [];
  var steps = cd.steps || [];
  var sea = cd.seasonings || [];
  if (!ing.length || !steps.length) return null; // no fabricated Recipe data
  var obj = {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: cd.dishName || data.title,
    image: absImg(cat, data, data.thumbnail),
    author: { '@type': 'Person', name: '週末ログ' },
    datePublished: data.date,
    description: plain(data.listingDescription || ''),
    recipeIngredient: ing.concat(sea),
    recipeInstructions: steps.map(function (s) {
      return { '@type': 'HowToStep', text: s };
    }),
  };
  if (cd.servings) obj.recipeYield = cd.servings;
  return ldJson(obj);
}

function headHtml(data, cat) {
  var title = escapeHtml(data.title + ' | ' + cat.titleSuffix);
  var descText = plain(data.listingDescription || '');
  var desc = escapeHtml(descText);
  var ogImg = absImg(cat, data, data.thumbnail);
  var canonical = cat.canonicalBase + data.id;

  var article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: data.title + ' | ' + cat.titleSuffix,
    description: descText,
    image: ogImg,
    url: canonical,
    datePublished: data.date,
    publisher: { '@type': 'Person', name: '週末ログ' },
  };
  var breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'ホーム', item: SITE + '/' },
      { '@type': 'ListItem', position: 2, name: cat.breadcrumbName, item: cat.listingBase },
      { '@type': 'ListItem', position: 3, name: data.title, item: canonical },
    ],
  };

  var lines = [
    '<!DOCTYPE html>',
    '<html lang="ja">',
    '<head>',
    GTAG,
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    '<title>' + title + '</title>',
    '<meta name="description" content="' + desc + '">',
    '<meta property="og:title" content="' + title + '">',
    '<meta property="og:description" content="' + desc + '">',
    '<meta property="og:image" content="' + ogImg + '">',
    '<meta property="og:url" content="' + canonical + '">',
    '<meta property="og:type" content="article">',
    '<meta property="og:site_name" content="週末ログ">',
    '<link rel="icon" href="favicon.svg" type="image/svg+xml">',
  ];
  var preload = preloadLink(cat, data);
  if (preload) lines.push(preload);
  lines.push('<link rel="stylesheet" href="style.css">');
  lines.push('<link rel="canonical" href="' + canonical + '">');
  lines.push('<meta name="color-scheme" content="light dark">');
  lines.push(ldJson(article));
  lines.push('<meta name="twitter:card" content="summary_large_image">');
  lines.push('<meta name="twitter:site" content="@potato_weekend">');
  lines.push('<meta name="theme-color" content="#222222">');
  lines.push('<link rel="manifest" href="manifest.json">');
  lines.push(ldJson(breadcrumb));
  if (cat.key === 'cooking') {
    var recipe = recipeJsonLd(data, cat);
    if (recipe) lines.push(recipe);
  }
  lines.push('</head>');
  return lines.join('\n');
}

// --- article layout (yurulog / cooking) ------------------------------------
function paragraphs(list) {
  return (list || []).map(function (p) { return '        <p>' + p + '</p>'; });
}

function articleBody(data, cat) {
  var secs = (data.body && data.body.sections) || [];
  var images = data.images || [];
  var photoIdx = 0;
  var blocks = [];

  secs.forEach(function (sec) {
    var out = ['      <section>'];
    if (sec.type === 'photo') {
      var img = images[photoIdx];
      photoIdx += 1;
      if (img) {
        out.push(indentBlock(pictureOrImg(cat, data, img, photoIdx === 1), 8));
        if (img.caption) out.push('        <p class="caption">' + img.caption + '</p>');
      }
    }
    paragraphs(sec.paragraphs).forEach(function (p) { out.push(p); });
    out.push('      </section>');
    blocks.push(out.join('\n'));
  });

  // cooking-only extras + recipe block
  if (cat.key === 'cooking') {
    var recipe = recipeSection(data);
    if (recipe) blocks.push(recipe);
    cookingExtras(data).forEach(function (b) { blocks.push(b); });
  }

  // closing back link
  blocks.push(
    [
      '      <section>',
      '        <p><a href="' + cat.listingFile + '" class="btn">← ' + cat.navLabel + 'に戻る</a></p>',
      '      </section>',
    ].join('\n')
  );

  return blocks.join('\n\n');
}

function recipeSection(data) {
  var cd = data.categoryData || {};
  var ing = cd.ingredients || [];
  var sea = cd.seasonings || [];
  var steps = cd.steps || [];
  if (!ing.length && !steps.length) return '';
  var out = ['      <section class="recipe">'];
  var meta = [];
  if (cd.servings) meta.push('👥 ' + cd.servings);
  if (cd.cookTime) meta.push('⏱ ' + cd.cookTime);
  if (meta.length) out.push('        <p class="recipe-meta">' + meta.join(' ／ ') + '</p>');
  if (ing.length || sea.length) {
    out.push('        <h3>材料</h3>');
    out.push('        <ul>');
    ing.concat(sea).forEach(function (i) { out.push('          <li>' + i + '</li>'); });
    out.push('        </ul>');
  }
  if (steps.length) {
    out.push('        <h3>作り方</h3>');
    out.push('        <ol>');
    steps.forEach(function (s) { out.push('          <li>' + s + '</li>'); });
    out.push('        </ol>');
  }
  out.push('      </section>');
  return out.join('\n');
}

function cookingExtras(data) {
  var cd = data.categoryData || {};
  var blocks = [];
  if (Array.isArray(cd.cookTools) && cd.cookTools.length) {
    var t = ['      <section>', '        <h3>使用した道具</h3>', '        <ul>'];
    cd.cookTools.forEach(function (i) { t.push('          <li>' + i + '</li>'); });
    t.push('        </ul>', '      </section>');
    blocks.push(t.join('\n'));
  }
  [
    ['plating', '盛り付け'],
    ['taste', '食べた感想'],
    ['arrange', 'アレンジ・代用品'],
    ['nutrition', '栄養メモ'],
    ['notes', '注意点'],
  ].forEach(function (pair) {
    var v = cd[pair[0]];
    if (typeof v === 'string' && v.trim()) {
      blocks.push(
        ['      <section>', '        <h3>' + pair[1] + '</h3>', '        <p>' + v + '</p>', '      </section>'].join('\n')
      );
    }
  });
  return blocks;
}

function articlePage(data, cat) {
  var heroLead = '';
  var cd = data.categoryData || {};
  if (cd.catchCopy) heroLead = cd.catchCopy;
  else if (data.body && data.body.sections && data.body.sections[0]) {
    heroLead = (data.body.sections[0].paragraphs || [])[0] || '';
  }
  var locLine = cat.locationLabel
    ? '        <p class="travel-location">' + cat.locationLabel + '</p>\n'
    : '';

  return [
    headHtml(data, cat),
    '<body>',
    '',
    headerHtml(cat, cat.key),
    '',
    '<main class="layout">',
    '  <div class="content">',
    '    <div class="travel-article">',
    '',
    '      <section class="hero">',
    '        <h2>' + escapeHtml(data.title) + '</h2>',
    '        <p>' + heroLead + '</p>',
    locLine + '      </section>',
    '',
    articleBody(data, cat),
    '',
    '    </div>',
    '  </div>',
    '',
    '  <aside class="sidebar">',
    snsBox(),
    categoryBox(cat.key),
    '  </aside>',
    '</main>',
    '',
    footerHtml(data, cat),
    '<script src="script.js"></script>',
    '<button id="back-to-top" aria-label="トップへ戻る" title="トップへ戻る">▲</button>',
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

// --- gallery layout (carwash) ----------------------------------------------
function galleryPage(data, cat) {
  var images = data.images || [];
  var cd = data.categoryData || {};

  var thumbs = images.map(function (img) {
    var file = imgFile(data, img);
    var label = escapeAttr(img.caption || img.alt || '');
    var dims = img.width && img.height ? ' width="' + img.width + '" height="' + img.height + '"' : '';
    return (
      '        <img src="' + imgPath(cat, data, file) + '" class="thumb" data-label="' +
      label + '" loading="lazy"' + dims + '>'
    );
  });

  var beforeImg = images[0];
  var afterImg = images[images.length - 1];
  var baSection = '';
  if (beforeImg && afterImg && images.length >= 2) {
    baSection = [
      '',
      '    <section>',
      '      <h3>Before / After</h3>',
      '      <p class="key-hint">← スライドして比較 →</p>',
      '      <div class="ba-container">',
      '        <div class="ba-before-wrap">',
      '          <img src="' + imgPath(cat, data, imgFile(data, beforeImg)) + '" class="ba-before" loading="lazy">',
      '        </div>',
      '        <img src="' + imgPath(cat, data, imgFile(data, afterImg)) + '" class="ba-after" loading="lazy">',
      '        <input type="range" min="0" max="100" value="50" class="ba-slider">',
      '        <div class="ba-handle"></div>',
      '      </div>',
      '    </section>',
    ].join('\n');
  }

  // narrative: body text sections + work + summary
  var narrative = [];
  ((data.body && data.body.sections) || []).forEach(function (sec) {
    var out = ['    <section>'];
    (sec.paragraphs || []).forEach(function (p) { out.push('      <p>' + p + '</p>'); });
    out.push('    </section>');
    narrative.push(out.join('\n'));
  });
  if (cd.work && cd.work.trim()) {
    narrative.push(['    <section>', '      <h3>作業内容</h3>', '      <p>' + cd.work + '</p>', '    </section>'].join('\n'));
  }
  if (cd.summary && cd.summary.trim()) {
    narrative.push(['    <section>', '      <h3>まとめ</h3>', '      <p>' + cd.summary + '</p>', '    </section>'].join('\n'));
  }

  // sidebar
  var sidebar = ['  <aside class="sidebar">'];
  if (Array.isArray(cd.tools) && cd.tools.length) {
    sidebar.push('    <div class="sidebar-box">');
    sidebar.push('      <h3>🧰 使ったもの</h3>');
    sidebar.push('      <ul>');
    cd.tools.forEach(function (t) { sidebar.push('        <li>' + t + '</li>'); });
    sidebar.push('      </ul>');
    sidebar.push('    </div>');
  }
  sidebar.push(categoryBox(cat.key));
  if (cd.mapQuery && cd.mapQuery.trim()) {
    sidebar.push('    <div class="sidebar-box">');
    sidebar.push('      <h3>📍 場所</h3>');
    if (cd.place) sidebar.push('      <p style="font-size:13px; margin-bottom:6px;">' + escapeHtml(cd.place) + '</p>');
    sidebar.push('      <iframe title="Google マップ"');
    sidebar.push('        src="https://maps.google.com/maps?q=' + encodeURIComponent(cd.mapQuery) + '&output=embed&z=15"');
    sidebar.push('        width="100%"');
    sidebar.push('        style="border:0; border-radius:8px; display:block;"');
    sidebar.push('        allowfullscreen=""');
    sidebar.push('        loading="lazy">');
    sidebar.push('      </iframe>');
    sidebar.push('    </div>');
  }
  sidebar.push('  </aside>');

  var heroLead = (cd.summary && cd.summary.split('\n')[0]) || data.listingDescription || '';

  return [
    headHtml(data, cat),
    '<body>',
    '',
    headerHtml(cat, cat.key),
    '',
    '<main class="layout">',
    '  <div class="content">',
    '',
    '    <section class="hero">',
    '      <h2>' + escapeHtml(data.title) + '</h2>',
    '      <p>' + heroLead + '</p>',
    '    </section>',
    '',
    '    <section>',
    '      <div class="gallery">',
    thumbs.join('\n'),
    '      </div>',
    '      <p class="key-hint">← → キーでも切り替えられます</p>',
    '      <div id="viewer" class="viewer">',
    '        <img id="mainImage" src="' +
      (beforeImg ? imgPath(cat, data, imgFile(data, beforeImg)) : '') +
      '" alt="' + escapeAttr(beforeImg ? beforeImg.alt || '' : '') + '" loading="lazy">',
    '        <div id="info" class="info"></div>',
    '        <div id="detail" class="detail"></div>',
    '      </div>',
    '    </section>',
    baSection,
    '',
    narrative.join('\n\n'),
    '',
    '    <section>',
    '      <p><a href="index.html">← ホームに戻る</a></p>',
    '    </section>',
    '',
    '  </div>',
    '',
    sidebar.join('\n'),
    '</main>',
    '',
    footerHtml(data, cat),
    '<script src="carwash-detail.js"></script>',
    '<script src="script.js"></script>',
    '<button id="back-to-top" aria-label="トップへ戻る" title="トップへ戻る">▲</button>',
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

// --- article HTML entry point ----------------------------------------------
function renderArticleHtml(data, cat) {
  if (cat.layout === 'gallery') return galleryPage(data, cat);
  return articlePage(data, cat);
}

// --- listing card ----------------------------------------------------------
function renderListingCard(data, cat) {
  var href = data.slug + '.html';
  var title = escapeHtml(data.listingTitle || data.title);
  var desc = data.listingDescription || '';
  var thumb = imgPath(cat, data, data.thumbnail);
  var out = ['      <section>', '        <div class="article-row">'];
  out.push(
    '          <img src="' + thumb + '" alt="' + escapeAttr(data.title) +
      '" class="photo" loading="lazy">'
  );
  out.push('          <div class="article-text">');
  if (cat.key !== 'carwash') {
    out.push('            <p class="post-date">' + fmtPostDate(data.date) + '</p>');
  }
  out.push('            <h3>' + title + '</h3>');
  out.push('            <p>' + desc + '</p>');
  out.push('            <a href="' + href + '" class="btn">のぞく</a>');
  out.push('          </div>', '        </div>', '      </section>');
  return out.join('\n');
}

// --- sitemap entry ---------------------------------------------------------
function renderSitemapEntry(data, cat) {
  return [
    '  <url>',
    '    <loc>' + cat.canonicalBase + data.id + '</loc>',
    '    <lastmod>' + data.date + '</lastmod>',
    '    <priority>0.6</priority>',
    '  </url>',
  ].join('\n');
}

module.exports = {
  renderArticleHtml: renderArticleHtml,
  renderListingCard: renderListingCard,
  renderSitemapEntry: renderSitemapEntry,
};
