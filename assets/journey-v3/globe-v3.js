/*! Globe Intro (試作) — travel-23「3D地球のみ」版
   Natural Earth 衛星テクスチャの高品質3D地球で 青森→台北 を飛行→到着→記事本文へフェード。
   2Dフライトマップ(journey-intro.js)へは渡さない。自己完結・外部CDN不使用・音声なし。
   config: window.GLOBE_V3_CONFIG または #globe-v3-config(JSON)。 */
(function (global) {
  'use strict';
  var DEG = Math.PI / 180;

  /* ANA風の青い大気グロー用 Fresnelシェーダ(依存追加なし・three標準attribute/uniformのみ) */
  var GV3_ATMO_VS = [
    'varying vec3 vN; varying vec3 vView;',
    'void main(){',
    '  vec4 mv = modelViewMatrix * vec4(position,1.0);',
    '  vN = normalize(normalMatrix * normal);',
    '  vView = normalize(-mv.xyz);',
    '  gl_Position = projectionMatrix * mv;',
    '}'
  ].join('\n');
  var GV3_ATMO_FS = [
    'varying vec3 vN; varying vec3 vView;',
    'uniform vec3 uColor; uniform float uPower; uniform float uOpacity;',
    'void main(){',
    '  float rim = pow(1.0 - abs(dot(vView, vN)), uPower);',
    '  gl_FragColor = vec4(uColor, rim * uOpacity);',
    '}'
  ].join('\n');

  var DEFAULTS = {
    hero: '.ji-hero',
    spinMs: 13000,
    frontLon: 128,                 // 停止時に正面へ来る経度(東アジア中心・微調整可)
    tiltDeg: 26,                   // 地球の傾き(北緯side=東アジア/日本を画面中央へ。ANA機内マップ風の見下ろし)
    spin: false,                   // 地球儀の回転はしない(東アジア正面で固定)
    flat: true,                    // 平面寄り(立体陰影なし=地図をそのまま貼った見え方)
    fov: 16,                       // 望遠=ほぼ平行投影。縁の膨らみ(球っぽさ)を抑える
    camZ: 8.0,                     // カメラ距離(FOVに合わせて画面占有を調整)
    routeMs: 2800,                 // 都市間の弧(航路)を描く時間(やや短縮)
    lon0: 180,                     // 経度→3D方位のキャリブレーション(frontLon/frontYと整合。都市ドットの位置合わせ)
    cities: [                      // 地球上に表示する都市(ドット＋ラベル)。route は index ペアを結ぶ
      { jp: '青森',      lat: 40.82, lon: 140.74 },
      { jp: '台北',      lat: 25.05, lon: 121.52, dest: true },
      { jp: '東京／羽田', lat: 35.55, lon: 139.78 },
      { jp: '那覇／沖縄', lat: 26.21, lon: 127.68 },
      { jp: 'マニラ',    lat: 14.60, lon: 120.98 }
    ],
    route: [ [0, 1] ],             // 青森 → 台北 を弧で結ぶ
    // ANA風の衛星写真調(NASA Blue Marble由来・パブリックドメイン)。実行時は外部接続せずローカル同梱を使用。
    texMobile: 'assets/journey-v3/textures/earth-sat-2048.jpg',
    texDesktop: 'assets/journey-v3/textures/earth-sat-2048.jpg',
    texSpec: 'assets/journey-v3/textures/earth-spec-2048.jpg',     // 海だけ光る反射マップ
    texNormal: 'assets/journey-v3/textures/earth-normal-2048.jpg', // 起伏の陰影(立体感)
    mask: 'assets/journey-v3/textures/earth-mask-1024.png',
    routeTop: 'AOMORI → TAIPEI',
    airline: 'SHUMATSU AIR',
    arriving: 'ARRIVING IN TAIPEI',
    destLabel: 'TAIPEI / TAIWAN',
    skipLabel: 'SKIP', replayLabel: 'REPLAY',
    journey: null                  // JourneyIntro 用 config（route/descent/destination…）
  };

  function $(s, r) { return (r || document).querySelector(s); }
  function mk(t, c) { var e = document.createElement(t); if (c) e.className = c; return e; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function hasWebGL() { try { var c = document.createElement('canvas'); return !!(global.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl'))); } catch (e) { return false; } }
  function reducedMotion() { return global.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; }

  function start(userCfg) {
    var cfg = Object.assign({}, DEFAULTS, userCfg || {});
    var doc = document, heroEl = $(cfg.hero);
    if (doc.querySelector('.gv3-overlay')) return { destroy: function () {} }; // 二重起動防止(オーバーレイ/canvas/RAFを1組だけに)
    var ov = mk('div', 'gv3-overlay');
    // ラベル（別レイヤー・地名はテクスチャに焼かず表示）
    var labels = mk('div', 'gv3-labels');
    var lRoute = mk('div', 'gv3-label gv3-route'); lRoute.textContent = cfg.routeTop;
    var lSub = mk('div', 'gv3-label gv3-sub'); lSub.textContent = cfg.airline;
    var lArr = mk('div', 'gv3-label gv3-arrive'); lArr.textContent = cfg.arriving;
    var lDest = mk('div', 'gv3-label gv3-dest'); lDest.textContent = cfg.destLabel;
    labels.appendChild(lRoute); labels.appendChild(lSub); labels.appendChild(lArr); labels.appendChild(lDest);
    // 都市ドット＋ラベル(3D投影で毎フレーム追従。地球の前面にある都市だけ表示)
    var cityWrap = mk('div', 'gv3-cities');
    var cityDefs = cfg.cities || [];
    // 主役=航路の起終点(青森/台北)。他都市(東京/羽田・那覇/沖縄・マニラ)は補助として弱め表示。
    var primIdx = {}; (cfg.route || []).forEach(function (pr) { primIdx[pr[0]] = 1; primIdx[pr[1]] = 1; });
    var cityAux = [];
    var cityEls = cityDefs.map(function (c, i) {
      var isPrim = !!(c.dest || primIdx[i]); cityAux[i] = !isPrim;
      var el = mk('div', 'gv3-cityLabel' + (c.dest ? ' gv3-cityDest' : '') + (isPrim ? '' : ' gv3-cityAux'));
      el.innerHTML = '<span class="gv3-dot"></span><span class="gv3-cname">' + c.jp + '</span>';
      cityWrap.appendChild(el); return el;
    });
    // 航路に沿って飛ぶ機体(右向き=+xを基準。進行方向へ回転)
    var planeEl = mk('div', 'gv3-plane');
    planeEl.innerHTML = '<svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true"><path fill="#ffffff" stroke="rgba(6,24,34,.55)" stroke-width="0.7" d="M30 16 L20 13.6 L14.5 5 L12 5 L14.6 13 L6.5 14 L3.5 10 L1.6 10 L3.2 16 L1.6 22 L3.5 22 L6.5 18 L14.6 19 L12 27 L14.5 27 L20 18.4 Z"/></svg>';
    var leadEl = mk('div', 'gv3-lead');       // 航路先端の光点(視線誘導)
    // 上部UIバー(機内マップ風): 左=経路 / 右=航空会社
    var topbar = mk('div', 'gv3-topbar');
    topbar.innerHTML = '<span class="gv3-tb-route">' + (cfg.routeTop || '') + '</span><span class="gv3-tb-air">' + (cfg.airline || '') + '</span>';
    var controls = mk('div', 'gv3-controls');
    var btnSkip = mk('button', 'gv3-btn gv3-skip'); btnSkip.type = 'button'; btnSkip.textContent = cfg.skipLabel;
    btnSkip.setAttribute('aria-label', '演出をスキップして記事へ');
    controls.appendChild(btnSkip);
    ov.appendChild(labels); ov.appendChild(cityWrap); ov.appendChild(leadEl); ov.appendChild(planeEl); ov.appendChild(topbar); ov.appendChild(controls);
    doc.body.appendChild(ov);
    var prevOverflow = doc.documentElement.style.overflow;
    doc.documentElement.style.overflow = 'hidden';

    var raf = 0, disposed = false, three = null, io = null, handedOff = false, ji = null;
    function cleanup() {
      if (disposed) return; disposed = true;
      if (raf) cancelAnimationFrame(raf);
      doc.removeEventListener('visibilitychange', onVis);
      doc.removeEventListener('keydown', onKey);
      global.removeEventListener('resize', onResize);
      global.removeEventListener('pagehide', cleanup);
      if (io) { try { io.disconnect(); } catch (e) {} }
      if (three) three.dispose();
      doc.documentElement.style.overflow = prevOverflow || '';
    }
    function removeSelf() { ov.classList.add('gv3-hide'); setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 700); }
    function focusArticle() { try { var m = doc.querySelector('main') || doc.body; if (m) { if (!m.hasAttribute('tabindex')) m.setAttribute('tabindex', '-1'); m.focus({ preventScroll: true }); } } catch (e) {} }
    function toHeroDirect() { removeSelf(); cleanup(); focusArticle(); }

    // reduced-motion / WebGL非対応 → 静止表示（テクスチャ地球の1枚絵＝静止画）
    if (reducedMotion() || !hasWebGL() || !global.THREE) {
      ov.classList.add('gv3-static', 'gv3-show');
      var img = mk('img', 'gv3-static-img');
      img.src = (Math.min(global.innerWidth || 1024, global.innerHeight || 768) <= 820) ? cfg.texMobile : cfg.texDesktop;
      img.alt = '';
      ov.insertBefore(img, ov.firstChild);
      topbar.classList.add('gv3-on');
      preload(heroEl);
      setTimeout(function () { if (!disposed) toHeroDirect(); }, 1600);
      wireControls(); return { destroy: cleanup };
    }

    try { three = buildGlobe(ov, cfg); }
    catch (e) { try { console.error('[GlobeV3] three失敗→静止', e); } catch (_) {} toHeroDirect(); return { destroy: cleanup }; }

    io = ('IntersectionObserver' in global) ? new IntersectionObserver(function (es) { if (three) three.onScreen = es[0] ? es[0].isIntersecting : true; }, { threshold: 0 }) : null;
    if (io) io.observe(ov);
    function onVis() { if (three) three.hidden = doc.hidden; }
    doc.addEventListener('visibilitychange', onVis);
    function onResize() { if (three) three.resize(); }
    global.addEventListener('resize', onResize);
    global.addEventListener('pagehide', cleanup);

    preload(heroEl);
    requestAnimationFrame(function () { ov.classList.add('gv3-show'); });

    // テンポ: 地球出現~1.5s / 飛行2.8s(維持) / hold350 / 台北ズーム1700 → 到着演出(handToArticle)へ。総尺≈9.3s
    var routeMs = cfg.routeMs || 2800, holdMs = 350, zoomMs = 1700, appearEnd = 1500;
    var T = { starsIn: 600, gIn0: 300, gIn1: appearEnd,
      route0: appearEnd, route1: appearEnd + routeMs,
      zoom0: appearEnd + routeMs + holdMs, zoom1: appearEnd + routeMs + holdMs + zoomMs,
      handoff: appearEnd + routeMs + holdMs + zoomMs };
    var t0 = performance.now();

    function updateCityLabels(routeP) {
      if (!three || !three.projectCities) return;
      var ps = three.projectCities(), W = ov.clientWidth, H = ov.clientHeight;
      for (var i = 0; i < cityEls.length; i++) {
        var p = ps[i]; if (!p) continue;
        cityEls[i].style.left = (p.x * W).toFixed(1) + 'px';
        cityEls[i].style.top = (p.y * H).toFixed(1) + 'px';
        var vis = p.front > 0.15 ? clamp((p.front - 0.15) / 0.3, 0, 1) : 0;
        var cap = cityAux[i] ? 0.65 : 1;   // 補助都市は最大不透明度を抑える
        cityEls[i].style.opacity = (vis * clamp(routeP * 1.4, 0, 1) * cap).toFixed(3);
      }
    }

    function updatePlane(routeP) {
      if (!three || !three.arcHead) { planeEl.style.opacity = 0; leadEl.style.opacity = 0; return; }
      var h = three.arcHead(routeP);
      if (h && routeP > 0.01 && h.front > 0.05) {
        var W = ov.clientWidth, H = ov.clientHeight, op = clamp((routeP - 0.01) / 0.06, 0, 1);
        planeEl.style.left = (h.x * W).toFixed(1) + 'px'; planeEl.style.top = (h.y * H).toFixed(1) + 'px';
        planeEl.style.transform = 'translate(-50%,-50%) rotate(' + h.angle.toFixed(1) + 'deg)';
        planeEl.style.opacity = op.toFixed(3);
        leadEl.style.left = (h.x * W).toFixed(1) + 'px'; leadEl.style.top = (h.y * H).toFixed(1) + 'px';
        leadEl.style.opacity = (op * 0.9).toFixed(3);
      } else { planeEl.style.opacity = 0; leadEl.style.opacity = 0; }
    }

    function loop(now) {
      if (disposed) return;
      var t = now - t0;
      var render = three.onScreen !== false && !three.hidden;
      three.setStars(clamp(t / T.starsIn, 0, 1));
      three.setAppear(easeOut(clamp((t - T.gIn0) / (T.gIn1 - T.gIn0), 0, 1)));
      three.setSpin(0); // 回転なし(東アジア正面で固定)
      var rp = easeInOut(clamp((t - T.route0) / (T.route1 - T.route0), 0, 1));
      three.setRoute(rp);                 // 都市間の弧を描く
      three.setZoom(easeInOut(clamp((t - T.zoom0) / (T.zoom1 - T.zoom0), 0, 1)));
      if (render) three.render();
      updateCityLabels(rp);               // 都市ドット/ラベルを画面へ追従
      updatePlane(rp);                    // 機体を航路先端に沿って飛ばす
      // 出発時から機内マップ風の上部UIバー(経路/航空会社)
      if (t > T.route0 - 400) topbar.classList.add('gv3-on');
      // 3D地球のみ: 到着を見せてから記事本文へフェード
      if (t >= T.handoff && !handedOff) { handedOff = true; handToArticle(); return; }
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    // 3D地球のみ版: 2Dフライトマップ(V2)へは渡さず、到着演出→記事本文へフェードして終了。
    function handToArticle() {
      // 都市ドット/機体/先端光点/上部バーを退場（到着地の余韻を残す）
      cityWrap.style.transition = 'opacity 600ms ease'; cityWrap.style.opacity = '0';
      planeEl.style.transition = 'opacity 600ms ease'; planeEl.style.opacity = '0';
      leadEl.style.transition = 'opacity 600ms ease'; leadEl.style.opacity = '0';
      topbar.classList.remove('gv3-on');
      lArr.classList.add('gv3-on');                 // ARRIVING IN TAIPEI (~850ms)
      preload(heroEl);
      // ARRIVING → TAIPEI / TAIWAN（到着タイトル ~1400ms）
      setTimeout(function () { if (disposed) return; lArr.classList.remove('gv3-on'); lDest.classList.add('gv3-on'); }, 850);
      // オーバーレイ全体をフェードアウト(700ms)＝下の記事本文(ヒーロー)へ直接クロスフェード
      setTimeout(function () { if (disposed) return; removeSelf(); cleanup(); focusArticle(); }, 2250);
    }

    function skipToArticle() { if (disposed) return; if (raf) { cancelAnimationFrame(raf); raf = 0; } toHeroDirect(); }
    function onKey(e) { if ((e.key === 'Escape' || e.key === 'Esc') && !disposed) { e.preventDefault(); skipToArticle(); } }
    function wireControls() {
      btnSkip.addEventListener('click', skipToArticle);
      doc.addEventListener('keydown', onKey);       // Escape でも記事本文へ
    }
    wireControls();
    return { destroy: cleanup };
  }

  function preload(heroEl) { try { if (heroEl && heroEl.decode) heroEl.decode().catch(function () {}); } catch (e) {} }

  /* ================= 高品質3D地球（Natural Earth 地図帳テクスチャ） ================= */
  function buildGlobe(ov, cfg) {
    var THREE = global.THREE;
    var cnv = mk('canvas', 'gv3-webgl'); ov.insertBefore(cnv, ov.firstChild);
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    var renderer = new THREE.WebGLRenderer({ canvas: cnv, antialias: true, alpha: false });
    renderer.setPixelRatio(dpr);
    if (renderer.outputEncoding !== undefined && THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;
    var scene = new THREE.Scene();
    var FOV = cfg.fov || 40, CAMZ = cfg.camZ || 3.1;
    var camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
    camera.position.set(0, 0, CAMZ);

    var loader = new THREE.TextureLoader();
    var small = Math.min(global.innerWidth || 1024, global.innerHeight || 768) <= 820;
    var atlas = loader.load(small ? cfg.texMobile : cfg.texDesktop);
    if (atlas.colorSpace !== undefined && THREE.SRGBColorSpace) atlas.colorSpace = THREE.SRGBColorSpace;
    else if (THREE.sRGBEncoding) atlas.encoding = THREE.sRGBEncoding;
    atlas.anisotropy = 8;
    var mat;
    if (cfg.flat) {
      // 平面寄り: 陰影を付けず地図をそのまま貼る(MeshBasic=ライト非依存)。少し暗めにして白飛び回避
      mat = new THREE.MeshBasicMaterial({ map: atlas, color: new THREE.Color(0xc2ccd6), transparent: true, opacity: 0 });
    } else {
      var normTex = cfg.texNormal ? loader.load(cfg.texNormal) : null;  // 起伏の法線マップ(立体感)
      var matOpts = { map: atlas, specular: new THREE.Color(0x070b13), shininess: 40, transparent: true, opacity: 0 };
      if (normTex) { matOpts.normalMap = normTex; matOpts.normalScale = new THREE.Vector2(0.85, 0.85); }
      mat = new THREE.MeshPhongMaterial(matOpts);
    }
    var globe = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), mat);
    globe.rotation.x = (cfg.tiltDeg || 0) * DEG; // 東アジア/日本を中央へ傾ける
    scene.add(globe);

    // === 都市マーカー + 都市間の弧(航路) : globeの子＝地球と一緒に傾く/拡大する ===
    var LON0 = (cfg.lon0 != null ? cfg.lon0 : 90);
    function ll2v(lat, lon, r) {
      var phi = (90 - lat) * DEG, th = (lon + LON0) * DEG;
      return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th));
    }
    function slerp(a, b, t) {
      var d = Math.max(-1, Math.min(1, a.dot(b))), om = Math.acos(d);
      if (om < 1e-4) return a.clone();
      var s = Math.sin(om);
      return a.clone().multiplyScalar(Math.sin((1 - t) * om) / s).add(b.clone().multiplyScalar(Math.sin(t * om) / s));
    }
    var cityDefs = cfg.cities || [];
    var cityVecs = cityDefs.map(function (c) { return ll2v(c.lat, c.lon, 1); });
    var routeGroup = new THREE.Group(); globe.add(routeGroup);
    var arcs = [], arcPairs = [];
    function arcAlt(tt) { return 1.002 + 0.055 * Math.sin(Math.PI * tt); }
    (cfg.route || []).forEach(function (pair) {
      var a = cityVecs[pair[0]], b = cityVecs[pair[1]]; if (!a || !b) return;
      arcPairs.push({ a: a.clone(), b: b.clone() });
      var N = 96, pts = [];
      for (var i = 0; i <= N; i++) { var t = i / N; pts.push(slerp(a, b, t).multiplyScalar(arcAlt(t))); }
      var geo = new THREE.BufferGeometry().setFromPoints(pts);
      geo.setDrawRange(0, 0);
      var line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xdaf3ff, transparent: true, opacity: 0, depthWrite: false }));
      line.__count = N + 1; routeGroup.add(line); arcs.push(line);
    });
    // ANA風の青い大気: 外側の明るいリムグロー(Fresnel/BackSide) ＋ 内側の淡いヘイズ(FrontSide)
    var rimU = { uColor: { value: new THREE.Color(0x74c4ff) }, uPower: { value: 3.7 }, uOpacity: { value: 0 } };
    var atmoRim = new THREE.Mesh(new THREE.SphereGeometry(1.07, 64, 48),
      new THREE.ShaderMaterial({ uniforms: rimU, vertexShader: GV3_ATMO_VS, fragmentShader: GV3_ATMO_FS,
        transparent: true, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(atmoRim);
    var hazeU = { uColor: { value: new THREE.Color(0x9bd6ff) }, uPower: { value: 3.6 }, uOpacity: { value: 0 } };
    var atmoHaze = new THREE.Mesh(new THREE.SphereGeometry(1.006, 64, 48),
      new THREE.ShaderMaterial({ uniforms: hazeU, vertexShader: GV3_ATMO_VS, fragmentShader: GV3_ATMO_FS,
        transparent: true, side: THREE.FrontSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(atmoHaze);
    // 照明（自然・控えめ）
    // 太陽光: ほぼカメラ側から当てて可視面を昼側に(ANA機内マップは夜側を見せない)。normal/specで陰影と海の光沢が出る
    var dir = new THREE.DirectionalLight(0xffffff, 1.1); dir.position.set(-0.5, 0.55, 1.35); scene.add(dir); // グリントを日本から左のアジア沿岸側へ逃がす
    scene.add(new THREE.AmbientLight(0x8496b3, 0.62)); // 影側も沈み込みすぎない自然な起こし
    // 星空（深い黒＋濃紺・大きさ/明るさに自然なばらつき・地球と一緒に回さない）
    var stars = makeStars(THREE); stars.dim.material.opacity = 0; stars.bright.material.opacity = 0;
    scene.add(stars.dim); scene.add(stars.bright);

    var frontY = -(cfg.frontLon * DEG) - Math.PI / 2;
    var api = {
      onScreen: true, hidden: false,
      setStars: function (a) { stars.dim.material.opacity = a * 0.6; stars.bright.material.opacity = a * 0.95; },
      setAppear: function (p) { mat.opacity = p; rimU.uOpacity.value = 0.95 * p; hazeU.uOpacity.value = 0.55 * p; var s = 0.62 + 0.38 * p; globe.scale.setScalar(s); atmoRim.scale.setScalar(s); atmoHaze.scale.setScalar(s); },
      setSpin: function (p) { globe.rotation.y = frontY + (cfg.spin ? p * Math.PI * 2 : 0); }, // spin:false=回転なし(正面固定)
      setZoom: function (p) { camera.position.z = CAMZ - p * (CAMZ * 0.42); camera.updateProjectionMatrix(); },
      setRoute: function (p) {
        for (var i = 0; i < arcs.length; i++) {
          arcs[i].material.opacity = clamp(p * 1.3, 0, 1);
          arcs[i].geometry.setDrawRange(0, Math.max(2, Math.floor(arcs[i].__count * clamp(p, 0, 1))));
        }
      },
      projectCities: function () {
        globe.updateMatrixWorld();
        var out = [];
        for (var i = 0; i < cityVecs.length; i++) {
          var wp = cityVecs[i].clone().multiplyScalar(1.02).applyMatrix4(globe.matrixWorld);
          var toCam = camera.position.clone().sub(wp).normalize();
          out.push({ x: wp.clone().project(camera).x * 0.5 + 0.5, y: -wp.clone().project(camera).y * 0.5 + 0.5,
                     front: wp.clone().normalize().dot(toCam), dest: !!cityDefs[i].dest });
        }
        return out;
      },
      // 航路の先端(進行度p)を画面座標＋進行方向角で返す(機体アイコン用)
      arcHead: function (p) {
        if (!arcPairs.length) return null;
        var pr = arcPairs[0];
        function pt(tt) { tt = clamp(tt, 0, 1); return slerp(pr.a, pr.b, tt).multiplyScalar(arcAlt(tt)); }
        globe.updateMatrixWorld();
        var pos = pt(p).applyMatrix4(globe.matrixWorld);
        // 進行方向は前後対称の微小区間で算出(到着p=1でも0長にならず、機首が反転しない)
        var lo = Math.max(0, p - 0.03), hi = Math.min(1, p + 0.03);
        var wLo = pt(lo).applyMatrix4(globe.matrixWorld), wHi = pt(hi).applyMatrix4(globe.matrixWorld);
        var sLo = wLo.clone().project(camera), sHi = wHi.clone().project(camera), sp = pos.clone().project(camera);
        var dx = sHi.x - sLo.x, dy = -(sHi.y - sLo.y);
        return { x: sp.x * 0.5 + 0.5, y: -sp.y * 0.5 + 0.5, angle: Math.atan2(dy, dx) * 180 / Math.PI,
                 front: pos.clone().normalize().dot(camera.position.clone().sub(pos).normalize()) };
      },
      render: function () { renderer.render(scene, camera); },
      resize: function () { var w = ov.clientWidth, h = ov.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); },
      dispose: function () { try {
        globe.geometry.dispose(); if (mat.map) mat.map.dispose(); if (mat.specularMap) mat.specularMap.dispose(); if (mat.normalMap) mat.normalMap.dispose(); mat.dispose();
        atmoRim.geometry.dispose(); atmoRim.material.dispose(); atmoHaze.geometry.dispose(); atmoHaze.material.dispose();
        arcs.forEach(function (l) { l.geometry.dispose(); l.material.dispose(); });
        stars.dim.geometry.dispose(); stars.dim.material.dispose(); stars.bright.geometry.dispose(); stars.bright.material.dispose();
        renderer.dispose();
      } catch (e) {} }
    };
    api.resize();
    return api;
  }

  function starLayer(THREE, n, r0, r1, size, color) {
    var pos = new Float32Array(n * 3);
    for (var i = 0; i < n; i++) {
      var u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = r0 + Math.random() * (r1 - r0), s = Math.sqrt(1 - u * u);
      pos[i * 3] = r * s * Math.cos(th); pos[i * 3 + 1] = r * u; pos[i * 3 + 2] = r * s * Math.sin(th);
    }
    var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({ color: color, size: size, sizeAttenuation: true, transparent: true, opacity: 0 }));
  }
  function makeStars(THREE) {
    // 2層で大きさ・明るさのばらつきを表現
    return { dim: starLayer(THREE, 1600, 20, 34, 0.045, 0x9fb2d6),
             bright: starLayer(THREE, 260, 20, 34, 0.095, 0xeaf2ff) };
  }

  /* ================= 起動 ================= */
  function auto() {
    var cfg = global.GLOBE_V3_CONFIG || null;
    var tag = document.getElementById('globe-v3-config');
    if (!cfg && tag) { try { cfg = JSON.parse(tag.textContent); } catch (e) {} }
    if (!cfg) return;
    try { start(cfg); } catch (e) { try { console.error('[GlobeV3] start失敗', e); } catch (_) {} }
  }
  global.GlobeV3 = { start: start };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', auto, { once: true });
  } else {
    auto();
  }
})(window);
