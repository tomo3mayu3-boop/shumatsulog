/*! Journey Intro Engine v1.2.0 | shumatsulog.com | 依存0
   v1.1.0: Phase2演出(トレイルグリント/着地リング/映画的マッチカット/粒状ノイズ+ビネット)
   v1.2.0: vector-v2 MapProvider(地球地図日本+Natural Earth実海岸線・出典自動表示・欠落時abstract-v1降格)
   v1.2.1: iOS動画自動再生の堅牢化(muted属性/地図中に先読み)
   v1.3.0-step1: V3 端末別 動画ソース選択(video.sources/端末クラス判定・sources無しはV2のsrc)。API・config後方互換 */
/* 設計書: _spec_journey_intro_engine.md
   記事側: <link journey-intro.css> + <script type="application/json" id="journey-intro-config">{…}</script> + <script src=journey-intro.js defer>
   公開API: JourneyIntro.start(cfg, opts) / registerMap(name, provider) / current
   決定論: instance.seek(ms) で任意時刻の状態を再現(開発ハーネス・テスト用) */
(function (global) {
  'use strict';

  var SCHEMA_VERSION = 1;

  /* ================= デフォルト設定(記事configでdeep-merge上書き) ================= */
  var DEFAULTS = {
    version: 1,
    id: null,
    route: {
      map: 'abstract-v1',
      path: 'M258 44 Q249 68 244 92 Q236 118 222 140 Q190 152 150 150',
      waypoints: [],
      introLabel: { jp: '世界', ro: 'The World' },
      /* 降下ステージ(vector-v2)。未指定=この既定=日本→南西諸島→宮古(現行と同一)。
         各stageは map-data の D.stages[stage] キー＝CSSアニメ ji-stage-<stage> に対応。
         anchor: [lat,lon] で焦点固定 / 'destination'(既定) で目的地に焦点 */
      descent: [
        { stage: 'japan',  anchor: [35.69, 139.69] },
        { stage: 'ryukyu', anchor: 'destination' },
        { stage: 'miyako', anchor: 'destination' }
      ]
    },
    destination: { jp: '', ro: '', lat: 0, lon: 0 },
    hero: '.ji-hero', /* 記事側Hero画像セレクタ(クロスフェード前に先読み/decode) */
    video: { src: null, poster: null, startAt: 0, playSeconds: null, easeOutMs: 900, easeOutRate: 0.30, arrivalEase: true, objectPosition: 'center', loadBudgetMs: 6000, saveDataFallback: 'hero' },
    audio: { src: null, volume: 0.5, fadeInMs: 1400 },
    /* Phase2 fx: すべて既定ON・configでOFF可(後方互換: 未指定=従来見た目+質感)
       v1.3.1 遷移スムーズ化: heroPreload/progressComplete/pauseAfterFade(既定ON)、heroZoomは比較用にOFF可 */
    fx: { trailGlint: true, glintLen: 0.07, pinRing: true, grain: true, vignette: true, heroZoom: true, heroPreload: true, progressComplete: true, pauseAfterFade: true,
      /* P3-2: 到着リップルの独立調整値（既定=洗練版。driveCeremony既存計算をパラメータ化・rAF処理は増やさない）。
         現行比較値: opacity .5 / echo .26 / scaleTo 2.23 / durMs 650 / offsetMs 300 / easePow 2 */
      ripple: { opacity: 0.46, opacityEcho: 0.20, scaleFrom: 0.38, scaleTo: 2.05, durMs: 720, offsetMs: 330, easePow: 2.4 } },
    timing: {
      phase1Ms: 13000, flightStartPct: 0.46, flightEndPct: 0.90,
      crossfadeMs: 900, heroCrossfadeMs: 240, /* v1.1: 映画的マッチカット(旧1000msはconfigで指定可) */
      heroPreloadLeadMs: 250, progressCompleteMs: 250, /* v1.3.1 遷移スムーズ化 */
      labelFadeMs: 380, labelPassDelayMs: 250,
      arrival: { holdMs: 380, pinMs: 600, labelStartMs: 560, labelMs: 560, coordStartMs: 640, coordMs: 1000, pauseMs: 1280 } /* 実機FB: 座標ロック後の余韻+1s(地図はCSS13s終了済で停止状態) */
    },
    skip: { button: true, label: 'スキップ', oncePerSession: true },
    brand: '週末ログ · Journey'
  };

  function merge(base, over) {
    var out = {};
    Object.keys(base).forEach(function (k) { out[k] = base[k]; });
    if (over) Object.keys(over).forEach(function (k) {
      var v = over[k];
      out[k] = (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]))
        ? merge(base[k], v) : v;
    });
    return out;
  }
  function clamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }
  function easeOut3(x) { x = clamp01(x); return 1 - Math.pow(1 - x, 3); }

  /* ================= V3 Step1: 端末別 動画ソース選択 =================
     - cfg.video.sources が無ければ cfg.video.src(=V2)をそのまま使用（後方互換）
     - ある場合は viewport幅(=デバイスクラス)を各source.maxWidthに突き合わせ「条件を満たす最小tier」を選択
       (mobile軽量を維持するため、DPRでtierを引き上げない。DPRは将来のdesktop 4K向け上げ幅に使用余地)
     - 回線(Save-Data/2G)による出し分けは Step2 で追加。ここでは端末別のみ。 */
  /* V3 Step3: iOS(iPhone/iPad/iPadOS)判定。iPadOS13+はMacを詐称するのでtouch数で補足 */
  function isIOS() {
    var n = global.navigator || {};
    var ua = n.userAgent || '';
    return /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && (n.maxTouchPoints || 0) > 1);
  }
  function pickVideoSource(v, vwOverride, iosOverride) {
    if (!v) return { src: null, tier: null, reason: 'no-video' };
    if (!v.sources || !v.sources.length) return { src: v.src || null, tier: 'v2-single', reason: 'no-sources' };
    var vw = vwOverride || global.innerWidth || 1024;
    var dpr = (global.devicePixelRatio || 1);
    var ios = (iosOverride != null) ? iosOverride : isIOS();
    var sorted = v.sources.slice().sort(function (a, b) {
      return (a.maxWidth == null ? Infinity : a.maxWidth) - (b.maxWidth == null ? Infinity : b.maxWidth);
    });
    var chosen = sorted[sorted.length - 1]; /* 既定=最上位(maxWidth無し) */
    for (var i = 0; i < sorted.length; i++) {
      if (sorted[i].maxWidth == null || vw <= sorted[i].maxWidth) { chosen = sorted[i]; break; }
    }
    /* V3 Step3: iOSは高解像度デコードが重い → 最上位(desktop=maxWidth無し)を避け、maxWidth有りの最上位(tablet相当)にcap */
    var didCap = false;
    if (ios && chosen.maxWidth == null) {
      var capped = null;
      for (var j = 0; j < sorted.length; j++) { if (sorted[j].maxWidth != null) capped = sorted[j]; }
      if (capped) { chosen = capped; didCap = true; }
    }
    return { src: chosen.src || v.src, tier: chosen.tier || null, reason: (didCap ? 'viewport-ios-cap' : 'viewport'), vw: vw, dpr: dpr, ios: ios };
  }

  /* ================= V3 Step2: 回線判定 & 最低tier =================
     navigator.connection(Chrome系)から Save-Data / effectiveType を読む。Safari等は非対応→unsupported。 */
  function readNetwork() {
    var n = global.navigator || {};
    var c = n.connection || n.mozConnection || n.webkitConnection;
    if (!c) return { supported: false, saveData: false, effectiveType: null };
    return { supported: true, saveData: !!c.saveData, effectiveType: c.effectiveType || null };
  }
  function isSlowNet(net) {
    return !!(net.saveData || net.effectiveType === '2g' || net.effectiveType === 'slow-2g');
  }
  function lowestSource(v) {
    if (!v || !v.sources || !v.sources.length) return null;
    return v.sources.slice().sort(function (a, b) {
      return (a.maxWidth == null ? Infinity : a.maxWidth) - (b.maxWidth == null ? Infinity : b.maxWidth);
    })[0];
  }
  /* 端末選択(chosen)＋回線から「動画を再生するか/最低tierに落とすか」を決定 */
  function planVideo(v, chosen, netOverride) {
    var net = netOverride || readNetwork();
    if (!chosen || !chosen.src) return { chosen: chosen, play: false, reason: 'no-src', net: net };
    /* 回線フォールバックはV3オプトイン(sources指定)時のみ。V2単一srcは従来どおり常に再生し挙動不変 */
    var v3 = !!(v.sources && v.sources.length);
    if (v3 && isSlowNet(net)) {
      var fb = v.saveDataFallback || 'hero';
      if (fb === 'lowest') {
        var low = lowestSource(v);
        if (low) return { chosen: { src: low.src || v.src, tier: low.tier || null, reason: 'slow-net-lowest' }, play: true, reason: 'slow-net-lowest', net: net };
      }
      return { chosen: chosen, play: false, reason: (net.saveData ? 'save-data' : net.effectiveType), net: net };
    }
    return { chosen: chosen, play: true, reason: 'ok', net: net };
  }

  /* ================= MapProvider レジストリ ================= */
  var providers = {};
  function registerMap(name, p) { providers[name] = p; }

  /* --- abstract-v1: 様式化グローブ(内蔵・依存0) --- */
  registerMap('abstract-v1', {
    attribution: null,
    mount: function (scenes) {
      var world = ''
        + '<svg viewBox="0 0 360 180" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">'
        + '<g stroke="rgba(224,238,242,.10)" stroke-width="0.6">'
        + '<line x1="0" y1="30" x2="360" y2="30"/><line x1="0" y1="60" x2="360" y2="60"/><line x1="0" y1="90" x2="360" y2="90"/><line x1="0" y1="120" x2="360" y2="120"/><line x1="0" y1="150" x2="360" y2="150"/>'
        + '<line x1="60" y1="0" x2="60" y2="180"/><line x1="120" y1="0" x2="120" y2="180"/><line x1="180" y1="0" x2="180" y2="180"/><line x1="240" y1="0" x2="240" y2="180"/><line x1="300" y1="0" x2="300" y2="180"/>'
        + '</g><g fill="rgba(206,228,231,.72)">'
        + '<path d="M55 30 L78 24 L100 26 L112 34 L105 44 L92 46 L96 56 L86 66 L78 64 L74 54 L64 50 L58 40 Z"/>'
        + '<path d="M92 66 L100 74 L110 86 L104 90 L96 80 L90 72 Z"/><path d="M120 16 L140 14 L148 24 L136 30 L122 26 Z"/>'
        + '<path d="M100 92 L116 90 L122 104 L116 122 L106 142 L98 152 L92 140 L100 122 L94 106 Z"/>'
        + '<path d="M170 40 L196 34 L208 40 L200 48 L186 50 L176 48 Z"/>'
        + '<path d="M176 58 L206 56 L214 72 L210 92 L198 116 L188 130 L180 116 L176 96 L172 76 Z"/>'
        + '<path d="M210 34 L250 26 L296 24 L322 36 L330 46 L314 52 L292 54 L268 56 L244 58 L222 54 L212 46 Z"/>'
        + '<path d="M244 58 L254 74 L246 84 L238 72 L240 62 Z"/><path d="M300 106 L326 104 L332 118 L316 128 L300 122 L296 112 Z"/>'
        + '<path d="M306 48 L312 44 L318 52 L314 60 L308 56 Z"/></g></svg>';
      var globe = document.createElement('div'); globe.className = 'ji-globe'; globe.setAttribute('data-anim', '');
      globe.innerHTML = '<div class="ji-strip" data-anim><div class="ji-world">' + world + '</div><div class="ji-world">' + world + '</div></div><div class="ji-globe-shade"></div>';
      var glow = document.createElement('div'); glow.className = 'ji-glow'; glow.setAttribute('data-anim', '');
      scenes.appendChild(globe); scenes.appendChild(glow);
    },
    destroy: function () {}
  });

  /* --- vector-v2: 実測ベクトル海岸線(地球地図日本+Natural Earth)。
         データは map-data/journey-map.v1.js が window.JOURNEY_MAP_DATA に定義。
         欠落/破損時は abstract-v1 に自動降格(記事は壊れない) --- */
  registerMap('vector-v2', {
    attribution: null,
    mount: function (scenes, cfg, inst) {
      this.attribution = null; /* 降格時に前回mountの出典が残らないよう毎回リセット */
      var D = global.JOURNEY_MAP_DATA;
      if (!D || !D.stages || !D.stages.world) { providers['abstract-v1'].mount(scenes, cfg, inst); return; }
      this.attribution = D.attribution || null;
      function svgFor(st, cls) {
        return '<svg viewBox="' + st.viewBox + '" preserveAspectRatio="xMidYMid meet"><g class="' + cls + '">'
          + st.paths.map(function (d) { return '<path d="' + d + '"/>'; }).join('') + '</g></svg>';
      }
      /* 地球儀: v1と同じ球体+帯スクロール機構に、実データの世界地図を流す */
      var globe = document.createElement('div'); globe.className = 'ji-globe'; globe.setAttribute('data-anim', '');
      var worldSvg = svgFor(D.stages.world, 'ji-land ji-land-globe');
      globe.innerHTML = '<div class="ji-strip" data-anim><div class="ji-world">' + worldSvg + '</div><div class="ji-world">' + worldSvg + '</div></div><div class="ji-globe-shade"></div>';
      scenes.appendChild(globe);
      /* 降下ステージ(config.route.descent 駆動)。anchor(緯度経度)が画面の焦点(50%,47%)に来るよう配置。
         未指定時は DEFAULTS.route.descent = 日本→南西諸島→宮古(現行と同一)。stage キーは D.stages[] と CSS ji-stage-<key> に対応 */
      function anchorPct(st, lat, lon) {
        var vb = st.viewBox.split(' ');
        var w = +vb[2], h = +vb[3], b = st.bbox;
        var k = Math.cos((b[1] + b[3]) / 2 * Math.PI / 180);
        var s = w / ((b[2] - b[0]) * k);
        return [((lon - b[0]) * k * s) / w * 100, ((b[3] - lat) * s) / h * 100];
      }
      var dl = cfg.destination.lat != null ? cfg.destination.lat : 24.79;
      var dn = cfg.destination.lon != null ? cfg.destination.lon : 125.28;
      var desc = cfg.route.descent || [];
      var lastIdx = desc.length - 1;
      desc.forEach(function (def, i) {
        var key = def.stage;
        var st = D.stages[key]; if (!st) return; /* 対応データが無いステージはスキップ(降格せず他ステージは描画) */
        var a = def.anchor;
        var lat = (a === 'destination' || a == null) ? dl : a[0];
        var lon = (a === 'destination' || a == null) ? dn : a[1];
        var p = anchorPct(st, lat, lon);
        var div = document.createElement('div');
        /* 段送りアニメは降下index(slot)＝地域名非依存。最終段のみ --last(保持＋明るいfill) */
        div.className = 'ji-stage ji-stage--i' + i + (i === lastIdx ? ' ji-stage--last' : '');
        div.setAttribute('data-anim', '');
        div.style.transform = 'translate(-' + p[0].toFixed(2) + '%,-' + p[1].toFixed(2) + '%)';
        div.innerHTML = svgFor(st, 'ji-land');
        scenes.appendChild(div);
      });
      var glow = document.createElement('div'); glow.className = 'ji-glow'; glow.setAttribute('data-anim', '');
      scenes.appendChild(glow);
    },
    destroy: function () { this.attribution = null; }
  });

  /* ================= DOM生成 ================= */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function buildDom(cfg) {
    var ov = document.createElement('div');
    ov.className = 'ji-overlay';
    var wpHtml = cfg.route.waypoints.map(function (w, i) {
      return '<div class="ji-label" data-wp="' + i + '"><span class="jp">' + esc(w.jp) + '</span><span class="ro">' + esc(w.ro) + '</span></div>';
    }).join('');
    var nodesHtml = cfg.route.waypoints.map(function (w) {
      return w.node ? '<circle class="ji-node" cx="' + (+w.node[0]) + '" cy="' + (+w.node[1]) + '" r="2.6"/>' : '';
    }).join('');
    ov.innerHTML =
      '<div class="ji-abstract" aria-hidden="true">'
      + '<div class="ji-atmo ji-atmo-space" data-anim></div>'
      + '<div class="ji-atmo ji-atmo-ocean" data-anim></div>'
      + '<div class="ji-stars" data-anim></div>'
      + '<div class="ji-scenes" data-anim></div>'
      + (cfg.fx.vignette ? '<div class="ji-vignette"></div>' : '')
      + (cfg.fx.grain ? '<div class="ji-grain"></div>' : '')
      + '<div class="ji-ui">'
      +   '<div class="ji-frame" data-anim><span></span><span></span><span></span><span></span></div>'
      +   '<svg class="ji-flight" viewBox="0 0 300 300" preserveAspectRatio="xMidYMid meet">'
      +     '<path class="ji-trail" pathLength="1" d="' + esc(cfg.route.path) + '"/>' + nodesHtml
      +     (cfg.fx.trailGlint ? '<path class="ji-trail-hl" pathLength="1" d="' + esc(cfg.route.path) + '"/>' : '')
      +     '<g class="ji-plane"><ellipse cx="1" cy="0" rx="15" ry="2.6"/>'
      +       '<path d="M4 1.5 L-9 14 L-5.5 14 L3 2.2 Z"/><path d="M4 -1.5 L-9 -14 L-5.5 -14 L3 -2.2 Z"/>'
      +       '<path d="M-9 1 L-14 6 L-11.5 6 L-8 1.6 Z"/><path d="M-9 -1 L-14 -6 L-11.5 -6 L-8 -1.6 Z"/></g>'
      +   '</svg>'
      +   '<div class="ji-reticle" data-anim><b></b></div>'
      +   '<div class="ji-labels">'
      +     '<div class="ji-label" data-intro><span class="jp">' + esc(cfg.route.introLabel.jp) + '</span><span class="ro">' + esc(cfg.route.introLabel.ro) + '</span></div>'
      +     wpHtml
      +   '</div>'
      +   '<div class="ji-progress"><i data-anim></i></div>'
      +   '<div class="ji-brand" data-anim>' + esc(cfg.brand) + '</div>'
      + '</div>'
      + '<div class="ji-arrival">'
      +   '<div class="a-label"><span class="a-jp">' + esc(cfg.destination.jp) + '</span><span class="a-ro">' + esc(cfg.destination.ro) + '</span></div>'
      +   (cfg.fx.pinRing ? '<i class="a-ring"></i><i class="a-ring"></i>' : '')
      +   '<div class="a-pin"><svg width="30" height="42" viewBox="0 0 30 42">'
      +     '<defs><linearGradient id="ji-pg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eafcff"/><stop offset="1" stop-color="#5fc4d0"/></linearGradient></defs>'
      +     '<path d="M15 41C15 41 27.5 24 27.5 14.5A12.5 12.5 0 1 0 2.5 14.5C2.5 24 15 41 15 41Z" fill="url(#ji-pg)"/>'
      +     '<circle cx="15" cy="14.5" r="4.6" fill="#0c3a44"/></svg></div>'
      +   '<div class="a-coord"></div>'
      + '</div>'
      + '</div>'
      + '<div class="ji-video" aria-hidden="true"><video playsinline webkit-playsinline muted preload="metadata"></video></div>';
    /* スキップ/出典は aria-hidden 領域の外(フォーカス可能) */
    if (cfg.skip.button) {
      var btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'ji-skip'; btn.textContent = cfg.skip.label;
      ov.appendChild(btn);
    }
    return ov;
  }

  /* ================= インスタンス ================= */
  function Instance(cfg, opts) {
    var self = this;
    this.cfg = cfg; this.opts = opts || {};
    this.state = { phase: 0 }; // 0=idle 1=map 2=video 3=done

    var T = cfg.timing;
    var P1 = T.phase1Ms;
    var FS = P1 * T.flightStartPct, FE = P1 * T.flightEndPct;
    var A = T.arrival;
    var RIP = cfg.fx.ripple || {}; /* P3-2: リップル調整値を構築時に1回だけローカル化(毎フレーム参照しない) */
    var ripOp = RIP.opacity != null ? RIP.opacity : 0.46, ripEcho = RIP.opacityEcho != null ? RIP.opacityEcho : 0.20;
    var ripFrom = RIP.scaleFrom != null ? RIP.scaleFrom : 0.38, ripTo = RIP.scaleTo != null ? RIP.scaleTo : 2.05;
    var ripDur = RIP.durMs != null ? RIP.durMs : 720, ripOff = RIP.offsetMs != null ? RIP.offsetMs : 330, ripPow = RIP.easePow != null ? RIP.easePow : 2.4;
    var CEREMONY = Math.max(A.holdMs + A.pinMs, A.labelStartMs + A.labelMs, A.coordStartMs + A.coordMs) + A.pauseMs;
    this.durations = { phase1: P1, flightStart: FS, flightEnd: FE, ceremony: CEREMONY, scrubMax: FE + CEREMONY };

    /* ---- DOM ---- */
    var ov = buildDom(cfg);
    document.body.insertBefore(ov, document.body.firstChild);
    ov.style.setProperty('--ji-p1', P1 + 'ms');
    /* Intro中は背後の記事をスクロールさせない(完了/スキップ/破棄で復元) */
    var prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    var scrollRestored = false;
    function restoreScroll() { if (!scrollRestored) { scrollRestored = true; document.documentElement.style.overflow = prevOverflow; } }
    var els = this.els = {
      overlay: ov,
      abstract: ov.querySelector('.ji-abstract'),
      scenes: ov.querySelector('.ji-scenes'),
      stars: ov.querySelector('.ji-stars'),
      trail: ov.querySelector('.ji-trail'),
      trailHl: ov.querySelector('.ji-trail-hl'),
      rings: [].slice.call(ov.querySelectorAll('.a-ring')),
      plane: ov.querySelector('.ji-plane'),
      introLabel: ov.querySelector('.ji-label[data-intro]'),
      wpLabels: [].slice.call(ov.querySelectorAll('.ji-label[data-wp]')),
      arrival: ov.querySelector('.ji-arrival'),
      aPin: ov.querySelector('.a-pin'),
      aLabel: ov.querySelector('.ji-arrival .a-label'),
      aCoord: ov.querySelector('.a-coord'),
      videoWrap: ov.querySelector('.ji-video'),
      video: ov.querySelector('.ji-video video'),
      progress: ov.querySelector('.ji-progress i'),
      skip: ov.querySelector('.ji-skip')
    };
    /* ---- 星(静的・軽量) ---- */
    (function () {
      var h = '';
      for (var i = 0; i < 52; i++) {
        h += '<i style="left:' + (Math.random() * 100).toFixed(1) + '%;top:' + (Math.random() * 72).toFixed(1)
          + '%;width:' + (Math.random() * 1.6 + 0.6).toFixed(1) + 'px;height:' + (Math.random() * 1.6 + 0.6).toFixed(1)
          + 'px;opacity:' + (Math.random() * 0.5 + 0.3).toFixed(2) + '"></i>';
      }
      els.stars.innerHTML = h;
    })();

    /* ---- MapProvider ---- */
    var provider = providers[cfg.route.map] || providers['abstract-v1'];
    provider.mount(els.scenes, cfg, this);
    if (provider.attribution) {
      var at = document.createElement('div'); at.className = 'ji-attrib'; at.textContent = provider.attribution;
      ov.appendChild(at);
    }
    /* シーク/再生の制御対象。プロバイダ生成要素(data-anim付与)も含むため mount 後に収集 */
    var anims = [].slice.call(els.abstract.querySelectorAll('[data-anim]'));
    this._provider = provider;

    /* ---- 動画 ---- */
    var vid = els.video;
    vid.muted = true; /* 音は audio フックで別管理(将来) */
    var chosen = pickVideoSource(cfg.video);   /* V3 Step1: 端末別に1本選択(sources無しはV2のsrc) */
    var plan = planVideo(cfg.video, chosen);   /* V3 Step2: 回線判定→再生可否/最低tier差替 */
    chosen = plan.chosen;
    self.chosenVideo = chosen;                 /* テスト/デバッグ用に公開 */
    self.videoPlan = plan;                     /* {play,reason,net}: enterVideoが参照 */
    if (chosen.src) vid.src = chosen.src;
    if (cfg.video.poster) vid.poster = cfg.video.poster; /* V3 Step2: iOS安定&黒画面回避の接続フレーム */
    vid.style.objectPosition = cfg.video.objectPosition || 'center';

    /* ---- フライト(パス追従・決定論) ---- */
    var pathLen = els.trail.getTotalLength ? els.trail.getTotalLength() : 0;
    function flightProg(t) { return 1 - Math.pow(1 - clamp01(t), 2.2); }
    function updateFlight(ms) {
      var t = (ms - FS) / (FE - FS);
      if (t <= 0) { els.trail.style.strokeDashoffset = '1'; els.plane.style.opacity = '0'; if (els.trailHl) els.trailHl.style.opacity = '0'; return; }
      if (t > 1) t = 1;
      var prog = flightProg(t);
      els.trail.style.strokeDashoffset = String(1 - prog);
      var d = prog * pathLen, p = els.trail.getPointAtLength(d);
      var da = Math.max(0, d - 0.8), db = Math.min(pathLen, d + 0.8);
      if (db - da < 0.1) { da = Math.max(0, pathLen - 0.8); db = pathLen; }
      var pa = els.trail.getPointAtLength(da), pb = els.trail.getPointAtLength(db);
      var ang = Math.atan2(pb.y - pa.y, pb.x - pa.x) * 180 / Math.PI; /* 前後2点接線→終点でも向き維持 */
      els.plane.style.transform = 'translate(' + p.x.toFixed(2) + 'px,' + p.y.toFixed(2) + 'px) rotate(' + ang.toFixed(2) + 'deg) scale(0.87)';
      var pOp = (t < 0.05 ? t / 0.05 : 1);
      els.plane.style.opacity = String(pOp);
      /* 機体直後を流れるハイライト(描画済みライン上の短い区間 [prog-L, prog]) */
      if (els.trailHl) {
        var L = cfg.fx.glintLen;
        els.trailHl.style.strokeDasharray = L + ' 1';
        els.trailHl.style.strokeDashoffset = String(L - prog);
        els.trailHl.style.opacity = String(pOp * 0.8);
      }
    }

    /* ---- ラベル窓の自動計算(経由地数は可変) ----
       ノードの弧長割合→イージング逆関数で「通過時刻」を導出し、通過に同期して表示 */
    function arcFrac(node) {
      if (!node || !pathLen) return 0;
      var best = 0, bestD = Infinity;
      for (var k = 0; k <= 100; k++) {
        var p = els.trail.getPointAtLength(pathLen * k / 100);
        var dx = p.x - node[0], dy = p.y - node[1], d2 = dx * dx + dy * dy;
        if (d2 < bestD) { bestD = d2; best = k / 100; }
      }
      return best;
    }
    function invEase(p) { return 1 - Math.pow(1 - clamp01(p), 1 / 2.2); }
    var labelWins = (function () {
      var wins = [{ el: els.introLabel, show: 0.25 * P1, hide: 0.42 * P1 }];
      var shows = cfg.route.waypoints.map(function (w) {
        return FS + invEase(arcFrac(w.node)) * (FE - FS) + T.labelPassDelayMs;
      });
      cfg.route.waypoints.forEach(function (w, i) {
        wins.push({ el: els.wpLabels[i], show: shows[i], hide: (i < shows.length - 1) ? shows[i + 1] - 150 : FE - 0.03 * P1 });
      });
      return wins;
    })();
    function updateLabels(ms) {
      var F = T.labelFadeMs;
      labelWins.forEach(function (w) {
        var oIn = easeOut3((ms - w.show) / F), oOut = easeOut3((w.hide - ms) / F);
        var op = Math.min(oIn, oOut);
        w.el.style.opacity = String(clamp01(op));
        w.el.style.transform = 'translateY(' + (10 * (1 - oIn) - 8 * (1 - oOut)) + 'px)';
      });
    }

    /* ---- 到着セレモニー(時間駆動・決定論) ---- */
    function updateCoordText(p) {
      p = clamp01(p);
      var e = easeOut3(p), D = cfg.destination;
      var lat = Math.floor(D.lat) + (D.lat - Math.floor(D.lat)) * e; /* 整数部固定で小数部をロールアップ */
      var lon = Math.floor(D.lon) + (D.lon - Math.floor(D.lon)) * e;
      if (p < 1) {
        var j = (1 - p) * 0.03;
        lat += (Math.random() - 0.5) * j; lon += (Math.random() - 0.5) * j;
        els.aCoord.classList.remove('locked');
      } else { lat = D.lat; lon = D.lon; els.aCoord.classList.add('locked'); }
      els.aCoord.textContent = lat.toFixed(4) + '° N   ' + lon.toFixed(4) + '° E';
    }
    function driveCeremony(c) {
      var planeFade = 1 - easeOut3((c - A.holdMs) / 380);
      els.plane.style.opacity = String(planeFade);
      if (els.trailHl) els.trailHl.style.opacity = String(planeFade * 0.8); /* グリントも機体と同時退場 */
      var pp = easeOut3((c - A.holdMs) / A.pinMs);
      els.aPin.style.opacity = String(easeOut3((c - A.holdMs) / (A.pinMs * 0.55)));
      els.aPin.style.transform = 'translate(-50%,' + (-140 + 40 * pp) + '%) scale(' + (0.85 + 0.15 * pp) + ')';
      var lp = easeOut3((c - A.labelStartMs) / A.labelMs);
      els.aLabel.style.opacity = String(easeOut3((c - A.labelStartMs) / (A.labelMs * 0.7)));
      els.aLabel.style.transform = 'translateY(' + (8 - 8 * lp) + 'px)';
      if (c >= A.coordStartMs) {
        updateCoordText(Math.min(1, (c - A.coordStartMs) / A.coordMs));
        els.aCoord.style.opacity = String(easeOut3((c - A.coordStartMs) / (A.coordMs * 0.5)));
      } else { els.aCoord.style.opacity = '0'; }
      /* ピン着地リング(1回目=明確・2回目=残響。Google Maps的な最小限)。P3-2: 強さ/速度/透明度は cfg.fx.ripple で調整(既存計算のパラメータ化=rAF処理増なし) */
      var land = A.holdMs + A.pinMs * 0.9;
      els.rings.forEach(function (r, idx) {
        var p = (c - (land + idx * ripOff)) / ripDur;
        if (p <= 0 || p >= 1) { r.style.opacity = '0'; return; }
        var e = 1 - Math.pow(1 - p, ripPow);
        r.style.opacity = String((1 - p) * (idx ? ripEcho : ripOp));
        r.style.transform = 'scale(' + (ripFrom + (ripTo - ripFrom) * e).toFixed(3) + ')';
      });
    }
    function resetCeremony() {
      els.aPin.style.opacity = ''; els.aPin.style.transform = '';
      els.aLabel.style.opacity = ''; els.aLabel.style.transform = '';
      els.aCoord.style.opacity = ''; els.aCoord.classList.remove('locked'); els.aCoord.textContent = '';
      els.rings.forEach(function (r) { r.style.opacity = ''; r.style.transform = ''; });
    }

    /* ---- タイムライン制御 ---- */
    var raf, rafV, t0, waapi = [];
    function cancelWaapi() { waapi.forEach(function (a) { try { a.cancel(); } catch (e) {} }); waapi = []; }
    function fade(el, from, to, dur, easing) {
      var a = el.animate([{ opacity: from }, { opacity: to }], { duration: dur, easing: easing || 'ease', fill: 'forwards' });
      waapi.push(a); return a;
    }
    /* v1.3.1 #1: Hero画像をクロスフェード前に先読み/decode(合成準備を済ませ、reveal時のジャンクを防ぐ) */
    var heroPreloaded = false;
    function preloadHero() {
      if (heroPreloaded) return; heroPreloaded = true;
      try {
        var img = document.querySelector(cfg.hero || '.ji-hero');
        if (!img) return;
        if (img.decode) { img.decode().catch(function () {}); }
        else if (!img.complete) { var i = new Image(); i.src = img.currentSrc || img.src; }
      } catch (e) {}
    }
    /* v1.3.1 #2: progressバーを100%まで満たしてから次のフェードへ移行 */
    function completeProgress(done) {
      var p = els.progress;
      /* P3-2fix: jiFill(CSS)が既に100%(scaleX(1))で保持済。WAAPI fill:forwards(iPhoneで最終フレーム未描画の懸念)に頼らず、
         インラインで scaleX(1) を確定＝100%を保証。progressCompleteMs の“間”を置いてから動画へ(既存タイミング不変・接続16.0s不変) */
      if (p) { try { p.style.animation = 'none'; p.style.transform = 'scaleX(1)'; } catch (e) {} }
      setTimeout(done, T.progressCompleteMs);
    }
    function tickShared(ms) {
      updateFlight(ms); updateLabels(ms);
      if (ms >= FE) driveCeremony(ms - FE); else resetCeremony();
      if (self.opts.onTick) self.opts.onTick(ms, self.state.phase);
    }
    function seek(ms) {
      cancelAnimationFrame(raf); cancelAnimationFrame(rafV);
      anims.forEach(function (el) { el.style.animationPlayState = 'paused'; el.style.animationDelay = (-Math.min(ms, P1) / 1000) + 's'; });
      tickShared(ms);
    }
    function live() {
      t0 = performance.now(); var cDone = false;
      (function tick(now) {
        try {
          var ms = now - t0;
          tickShared(ms);
          if (ms >= FE + CEREMONY && !cDone) { cDone = true; enterVideo(); return; }
          raf = requestAnimationFrame(tick);
        } catch (e) { abortToArticle(e); } /* 実行時例外でも記事本文へ確実に復帰 */
      })(t0);
    }
    function play() {
      self.state.phase = 1;
      cancelAnimationFrame(raf); cancelAnimationFrame(rafV); cancelWaapi();
      ov.style.opacity = ''; els.abstract.style.opacity = ''; els.videoWrap.style.opacity = ''; els.videoWrap.style.transform = '';
      heroPreloaded = false; if (els.progress) { els.progress.style.transform = ''; els.progress.style.animation = ''; } /* v1.3.1: 再生毎にリセット */
      resetCeremony(); els.plane.style.opacity = ''; if (els.trailHl) els.trailHl.style.opacity = '0';
      /* 地図フェーズ中に動画を先読み(iOS等で13s後の再生が間に合うように) */
      try { vid.preload = 'auto'; if (vid.load && vid.readyState < 2) vid.load(); } catch (e) {}
      try { vid.pause(); vid.currentTime = cfg.video.startAt || 0; vid.playbackRate = 1; } catch (e) {}
      anims.forEach(function (el) { el.style.animation = 'none'; });
      void els.abstract.offsetWidth;
      anims.forEach(function (el) { el.style.animation = ''; el.style.animationPlayState = 'running'; el.style.animationDelay = ''; });
      live();
      /* 全体ウォッチドッグ: 想定上限を大幅に超えても未完了なら記事本文へ強制復帰(サイレント停滞の保険)。
         通常完了/破棄で解除。上限は実尺(地図+動画+フェード)に十分な余裕(60s)を足し誤発火を防ぐ */
      var maxMs = self.durations.scrubMax + ((cfg.video.playSeconds != null ? cfg.video.playSeconds : 20) * 1000) + T.heroCrossfadeMs + 60000;
      clearTimeout(self._watchdog);
      self._watchdog = setTimeout(function () { abortToArticle(new Error('watchdog: intro did not complete in ' + maxMs + 'ms')); }, maxMs);
    }
    function enterVideo() {
      if (self.state.phase !== 1) return;
      /* V3 Step2: Save-Data/2G/動画ソース無し → 動画を出さず地図セレモニーからHeroへ直行 */
      if (!self.videoPlan || !self.videoPlan.play) {
        self.state.phase = 2;
        self._videoSkipped = (self.videoPlan && self.videoPlan.reason) || 'no-src';
        cancelAnimationFrame(raf);
        anims.forEach(function (el) { el.style.animationPlayState = 'paused'; });
        toHero(); /* オーバーレイ(到着セレモニー)→Heroをクロスフェード */
        return;
      }
      self.state.phase = 2;
      cancelAnimationFrame(raf);
      anims.forEach(function (el) { el.style.animationPlayState = 'paused'; });
      /* v1.3.1 #2: progressを100%まで満たしてから 地図→動画 クロスフェード */
      if (cfg.fx.progressComplete) completeProgress(startVideoCrossfade); else startVideoCrossfade();
    }
    function startVideoCrossfade() {
      if (self.state.phase !== 2) return;
      fade(els.abstract, 1, 0, T.crossfadeMs);
      fade(els.videoWrap, 0, 1, T.crossfadeMs);
      vid.playbackRate = 1;
      try { vid.preload = 'auto'; vid.currentTime = cfg.video.startAt || 0; } catch (e) {}
      vid.onended = function () { if (self.state.phase === 2) toHero(); };
      vid.onerror = function () { if (self.state.phase === 2) toHero(); }; /* V3 Step2: デコード/取得失敗→必ずHero */
      /* V3 Step3: canplay gating — 準備完了まで再生開始を遅延。iOSの早すぎるplay()拒否/黒画面を回避(準備中はposter表示) */
      var launched = false;
      function launchPlay() {
        if (launched || self.state.phase !== 2) return;
        launched = true; vid.oncanplay = null;
        var pp = vid.play();
        if (pp && pp.catch) pp.catch(function () { if (self.state.phase === 2) toHero(); }); /* autoplay拒否/低電力→即Hero */
      }
      if (vid.readyState >= 2) launchPlay();       /* 先読み済み(通常/V2)=即再生で挙動不変 */
      else vid.oncanplay = launchPlay;             /* 未準備なら準備後に再生。来なければ下の予算でHeroへ */
      /* V3 Step2: 読み込み予算(loadBudgetMs)。超過しても再生位置が進んでいなければ(=停滞/未準備)Heroへ */
      var budget = (cfg.video.loadBudgetMs != null ? cfg.video.loadBudgetMs : 6000);
      clearTimeout(self._budget);
      self._budget = setTimeout(function () {
        if (self.state.phase === 2 && vid.currentTime <= (cfg.video.startAt || 0) + 0.05) toHero();
      }, budget);
      watchVideo();
    }
    function watchVideo() {
      var ended = false;
      cancelAnimationFrame(rafV);
      (function loop() {
       try {
        var dur = (cfg.video.playSeconds != null ? cfg.video.playSeconds : (vid.duration || 8));
        var ct = vid.currentTime;
        /* 到着減速(playbackRate ランプ)。arrivalEase:false で完全無効化=最後まで1.0固定(iOSカクつき切り分け用) */
        if (cfg.video.arrivalEase !== false) {
          var easeAt = Math.max(0, dur - cfg.video.easeOutMs / 1000);
          if (ct >= easeAt) {
            var ep = Math.min(1, (ct - easeAt) / Math.max(0.001, dur - easeAt));
            vid.playbackRate = 1 - (1 - cfg.video.easeOutRate) * ep;
          }
        }
        if (self.opts.onTick) self.opts.onTick(ct * 1000, 2);
        /* v1.3.1 #1: Hero Crossfade開始の約 heroPreloadLeadMs 前にHeroを先読み/decode */
        if (cfg.fx.heroPreload && !heroPreloaded && ct >= dur - (T.heroPreloadLeadMs / 1000)) preloadHero();
        if (!ended && (ct >= dur - 0.05 || vid.ended)) {
          ended = true;
          /* v1.3.1 #4: pauseAfterFade時はここでpauseせず、フェード終了後にpause(フェード中も動画が動き続ける) */
          if (!cfg.fx.pauseAfterFade) { try { vid.pause(); } catch (e) {} }
          toHero(); return;
        }
        rafV = requestAnimationFrame(loop);
       } catch (e) { abortToArticle(e); } /* 動画ループの例外でも記事本文へ確実に復帰 */
      })();
    }
    /* 最終フェイルセーフ: 例外/スタール時にオーバーレイ除去＋スクロール復元＝記事本文へ必ず到達 */
    function abortToArticle(err) {
      if (self.state.phase === 3) return; /* 既に完了/破棄済 */
      self.state.phase = 3;
      try { console.error('[JourneyIntro] 実行時エラー — 記事本文へ復帰します', err); } catch (e) {}
      try { cancelAnimationFrame(raf); } catch (e) {}
      try { cancelAnimationFrame(rafV); } catch (e) {}
      try { clearTimeout(self._budget); } catch (e) {}
      try { clearTimeout(self._watchdog); } catch (e) {}
      try { cancelWaapi(); } catch (e) {}
      try { vid.pause(); } catch (e) {}
      try { restoreScroll(); } catch (e) {}
      try { if (ov && ov.parentNode) ov.parentNode.removeChild(ov); } catch (e) {}
      if (JI.current === self) JI.current = null;
      try { if (self.opts.onComplete) self.opts.onComplete(); } catch (e) {}
    }
    function toHero() {
      if (self.state.phase === 3) return;
      self.state.phase = 3;
      cancelAnimationFrame(rafV);
      clearTimeout(self._budget); /* V3 Step2: 読込予算ウォッチドッグの後発火を防止 */
      clearTimeout(self._watchdog); /* Phase2 Step3: 正常接続時は全体ウォッチドッグ解除 */
      try { vid.oncanplay = null; } catch (e) {} /* V3 Step3: 保留中のcanplay再生を無効化 */
      if (cfg.fx.heroPreload) preloadHero(); /* v1.3.1 #1: 保険(skip/失敗/直行など先読み前に来た場合) */
      /* 映画的マッチカット: 短いフェード + 動画のごく僅かな前進(scale)で「切り替わった」感を出す */
      fade(ov, 1, 0, T.heroCrossfadeMs, 'cubic-bezier(.4,0,.2,1)');
      if (cfg.fx.heroZoom) {
        var z = els.videoWrap.animate(
          [{ transform: 'scale(1)' }, { transform: 'scale(1.035)' }],
          { duration: T.heroCrossfadeMs + 140, easing: 'cubic-bezier(.33,0,.2,1)', fill: 'forwards' });
        waapi.push(z);
      }
      markSeen(cfg);
      setTimeout(function () {
        /* v1.3.1 #4: フェード終了後に動画をpause(フェード中は動き続ける) */
        if (cfg.fx.pauseAfterFade) { try { vid.pause(); } catch (e) {} }
        ov.style.pointerEvents = 'none';
        restoreScroll();
        if (self.opts.onComplete) self.opts.onComplete();
      }, T.heroCrossfadeMs + 60);
    }
    function skipNow() {
      cancelAnimationFrame(raf); cancelAnimationFrame(rafV);
      try { vid.pause(); } catch (e) {}
      toHero();
    }

    if (els.skip) els.skip.addEventListener('click', skipNow);

    /* ---- 公開 ---- */
    this.play = play; this.seek = seek; this.enterVideo = enterVideo; this.skip = skipNow;
    this.destroy = function () {
      cancelAnimationFrame(raf); cancelAnimationFrame(rafV); cancelWaapi();
      clearTimeout(self._budget); clearTimeout(self._watchdog); /* Phase2 Step3: タイマ解除 */
      restoreScroll();
      try { vid.pause(); vid.removeAttribute('src'); vid.load(); } catch (e) {} /* デコーダ解放 */
      try { provider.destroy(); } catch (e) {}
      if (ov.parentNode) ov.parentNode.removeChild(ov);
      if (JI.current === self) JI.current = null;
    };
  }

  /* ================= セッションスキップ ================= */
  function seenKey(cfg) { return 'ji-seen:' + (cfg.id || location.pathname); }
  function isSeen(cfg) { try { return sessionStorage.getItem(seenKey(cfg)) === '1'; } catch (e) { return false; } }
  function markSeen(cfg) { if (cfg.skip.oncePerSession) { try { sessionStorage.setItem(seenKey(cfg), '1'); } catch (e) {} } }

  /* ================= config 検証(警告のみ・停止しない) =================
     記事作成者が不足項目を把握しやすくする開発補助。挙動は一切変えず console.warn のみ。
     戻り値: [{ level:'warn', path, msg }]。手動: JourneyIntro.validate(cfg) / 自動: auto() 内で実行 */
  function validate(userCfg) {
    var issues = [];
    function warn(path, msg) { issues.push({ level: 'warn', path: path, msg: msg }); }
    var c = userCfg || {};

    if (c.version == null) warn('version', 'version 未指定です（推奨: ' + SCHEMA_VERSION + '）');
    else if (c.version !== SCHEMA_VERSION) warn('version', 'version=' + c.version + ' がエンジンschema ' + SCHEMA_VERSION + ' と不一致です');
    if (!c.id) warn('id', 'id 未指定。セッションスキップキーが location.pathname になります（記事ごとに一意な id を推奨）');

    var r = c.route || {};
    if (!c.route) warn('route', 'route 未指定（path/map/waypoints/descent が既定になります）');
    if (!r.path) warn('route.path', '航路パス未指定。飛行ラインが描画されません（例: "M258 44 Q249 68 244 92 …"）');
    if (r.map && !providers[r.map]) warn('route.map', 'map="' + r.map + '" は未登録プロバイダ。abstract-v1 に降格します（有効: ' + Object.keys(providers).join(' / ') + '）');

    var d = c.destination || {};
    if (!c.destination) warn('destination', 'destination 未指定（タイトル・座標が空になります）');
    else {
      if (!d.jp) warn('destination.jp', '目的地名(jp)未指定＝到着ラベルが空になります');
      if (d.lat == null || d.lon == null || (d.lat === 0 && d.lon === 0)) warn('destination.lat/lon', '座標(lat/lon)未指定または0。地図の焦点合わせと座標表示が不正になります');
    }

    var v = c.video || {};
    if (!(v.src || (v.sources && v.sources.length))) warn('video', 'video.src も video.sources も無し。動画は再生されず Hero へ直行します（意図的なら無視可）');
    if (v.sources && v.sources.length) v.sources.forEach(function (s, i) {
      if (!s || !s.src) warn('video.sources[' + i + '].src', 'sources[' + i + '] に src がありません');
    });

    /* descent の海岸線データ有無（vector-v2 かつ map-data 読込済のときのみ点検） */
    var D = global.JOURNEY_MAP_DATA;
    if (r.map === 'vector-v2' && D && D.stages && r.descent && r.descent.length) {
      r.descent.forEach(function (dsc, i) {
        if (dsc && dsc.stage && !D.stages[dsc.stage]) warn('route.descent[' + i + '].stage',
          'stage="' + dsc.stage + '" の海岸線データが map-data にありません（そのステージはスキップ。別地域は build-map-data.mjs で追加）');
      });
    }

    /* Hero 要素の存在（DOM がある実行時のみ） */
    if (global.document && document.querySelector) {
      var sel = c.hero || '.ji-hero';
      try { if (!document.querySelector(sel)) warn('hero', 'Hero要素 "' + sel + '" がDOMに見つかりません（記事の <img> に class="ji-hero" 付け忘れ？ Hero先読みが効きません）'); } catch (e) {}
    }

    if (issues.length && global.console) try {
      console.warn('[JourneyIntro] config 検証: ' + issues.length + ' 件の注意（警告のみ・再生は継続します）');
      issues.forEach(function (it) { console.warn('  ⚠ ' + it.path + ' — ' + it.msg); });
    } catch (e) {}
    return issues;
  }

  /* ================= エントリポイント ================= */
  var JI = {
    version: '1.3.8-progress',
    current: null,
    registerMap: registerMap,
    providers: providers,
    validate: validate,                /* Phase1 Step3: config検証(警告のみ・停止しない) */
    _pickVideoSource: pickVideoSource, /* V3: 選択ロジックの単体テスト用(内部) */
    _planVideo: planVideo,             /* V3 Step2: 回線フォールバック判定の単体テスト用(内部) */
    _readNetwork: readNetwork,         /* V3 Step2: 回線情報の取得(テスト/デバッグ用) */
    _isIOS: isIOS,                     /* V3 Step3: iOS判定(テスト/デバッグ用) */
    start: function (userCfg, opts) {
      var cfg = merge(DEFAULTS, userCfg || {});
      if (cfg.version !== SCHEMA_VERSION) {
        try { console.warn('[JourneyIntro] config version ' + cfg.version + ' != engine schema ' + SCHEMA_VERSION); } catch (e) {}
      }
      opts = opts || {};
      if (!opts.force) {
        if (global.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
        if (cfg.skip.oncePerSession && isSeen(cfg)) return null;
      }
      var inst;
      try {
        inst = new Instance(cfg, opts);
        JI.current = inst;
        if (opts.autoplay !== false) inst.play();
      } catch (e) {
        /* Phase2 Step3: 構築/開始の失敗でも記事本文へ確実に到達（オーバーレイ除去＋スクロール復元） */
        try { var stray = document.querySelector('.ji-overlay'); if (stray && stray.parentNode) stray.parentNode.removeChild(stray); } catch (_) {}
        try { document.documentElement.style.overflow = ''; } catch (_) {}
        try { console.error('[JourneyIntro] 初期化失敗 — 記事本文を表示します', e); } catch (_) {}
        return null;
      }
      return inst;
    }
  };
  global.JourneyIntro = JI;

  /* 自動初期化: 記事HTML内の <script type="application/json" id="journey-intro-config"> */
  function auto() {
    var tag = document.getElementById('journey-intro-config');
    if (!tag) return;
    var cfg;
    try { cfg = JSON.parse(tag.textContent); }
    catch (e) { try { console.error('[JourneyIntro] config JSON parse error', e); } catch (_) {} return; }
    try { validate(cfg); } catch (e) {} /* Phase1 Step3: 記事作成補助の警告(停止しない) */
    /* 本番(自動起動)は完了後にオーバーレイを破棄して動画デコーダ等を解放 */
    var inst;
    try { inst = JI.start(cfg, { onComplete: function () { if (inst) inst.destroy(); } }); }
    catch (e) { try { console.error('[JourneyIntro] start failed', e); } catch (_) {} }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto);
  else auto();

})(window);
