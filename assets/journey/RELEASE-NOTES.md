# Journey Intro Engine ― Release Notes

## Phase3 Step3 (2026-08-01 / branch: journey-engine-v3) — 動画→Hero Dissolve+Scale（Hero画像側のみ）
動画→Heroの接続に上品な Dissolve+Scale を追加。**Scaleは Hero画像側のみ・動画は等倍（画質低下ゼロ）**（v1.3.8→**1.3.9-heroscale**）:
- 新 `fx.heroScaleIn`（既定true）＝`toHero` のDissolve(heroCrossfadeMs 1000)中に **Hero画像(`cfg.hero`=.ji-hero)を `heroScaleFrom(1.025)→heroScaleTo(1.0)` の settle**（自然サイズへ収束）。WAAPI compositor transform・毎フレームJS無し
- **動画にはScaleを掛けない**: `fx.heroZoom`(動画側scale)は travel-17 で false 継続。動画は常に等倍＝画質低下ゼロ
- 記事Heroにインラインtransformを残さない（完了/破棄/中断で cancel＋clear。settle既定なので無ジャンプ）
- **playbackRate 1.0固定を確実化**: travel-17 は `arrivalEase` 未指定で**既定 `true`(減速ON)を継承していた不整合**を発見→ **既定を `true`→`false` に修正**。travel-17も1.0固定に（接続は動画タイムスタンプ16.0sで発火＝接続点不変。enterVideo 14620ms・CEREMONY 2920ms 不変）
- 維持: PC=1080p / Mobile=720p（tier不変）・動画再エンコード無し
- 性能: WAAPI1本(compositor)・rAF増なし・毎フレーム割当なし・iPhone安全。JS gzip +523 / CSS 0
- 通し確認 `_p3review3.html`（本番同一timing・実Hero背景・settle/scale-in/OFF のA/B・タップ起動）

## Phase3 Step2-fix (2026-08-01 / branch: journey-engine-v3) — プログレスバー100%到達＋比較ページ本番同一速度
- **バー100%修正**: `jiFill` 最終値 `scaleX(.85)→scaleX(1)`＝**100%到達**。CSSアニメの最終フレームは `fill:both` で保持＝iPhone Safariでも確実描画。`completeProgress` は **WAAPI(fill:forwards)依存を撤去**しインラインで `scaleX(1)` を確定＋`progressCompleteMs(250)` の間を維持（接続16.0s・タイミング不変）
  - タイムライン: 0→13000msで100%充填→CEREMONY中(13000-14620ms)は100%保持→enterVideoで100%確定→14870msで地図フェードと共に退場。**動画移行直前に必ず100%**
- **比較ページ本番同一速度**: `_p3review2.html` の `phase1Ms` 短縮を撤去し **travel-17と完全同一の時間軸**（phase1 13s / CEREMONY 2920ms / enterVideo 14620ms / 接続16.0s / 座標・リップル時刻）。A/Bは**リップルと座標ロックの見た目のみ**切替（時間軸は短縮しない）
- 保護不変: 地図/動画/Hero/画質/arrivalEase 不変。バーの最終値のみ 85%→100%（要望どおりの修正）。engine v1.3.7→**1.3.8-progress**
- 性能: バーはCSSアニメ(コンポジタ)継続＝rAF増なし。completeProgressはむしろWAAPI廃止で軽量化。JS gzip +60 / CSS gzip +75

## Phase3 Step2 (2026-08-01 / branch: journey-engine-v3) — 到着セレモニーの余韻（リップル洗練・座標ロックの余韻）
既存演出の微調整のみ。**新しい派手なエフェクトは追加せず**、強さ/速度/透明度と読み取れる余韻だけ整える（v1.3.6→**1.3.7-ripple**）:
- **ピンのリップル**: 既存 driveCeremony の定数を `cfg.fx.ripple`（7値：opacity/opacityEcho/scaleFrom/scaleTo/durMs/offsetMs/easePow）へ**パラメータ化**し独立調整可能に。既定＝洗練版
  - before→after: opacity `.5→.46` / echo `.26→.20` / scaleTo `2.23→2.05` / durMs `650→720`(やや緩やか) / offsetMs `300→330` / easePow `2→2.4`(柔らかい収束)。値は構築時に1回ローカル化＝**rAF処理は増やさない**（同一計算のパラメータ化）
- **座標ロックの余韻**: `.a-coord.locked` に**一度きりのCSS transition**（`--ji-coord-settle` 既定.5s／paint・毎フレーム不介入）。暗い下地を維持し可読性向上＋控えめなターコイズグロー `--ji-coord-glow`（独立調整可）。**余韻の長さは延長しない**
- **保護不変**: `CEREMONY`(2920ms)＝接続時刻(enterVideo 14620ms)はリップル値に非依存＝**タイミング/接続16.0s 不変**（証明済）。動画・Hero・画質・arrivalEase 不触
- **性能**: rAF内処理増なし・毎フレーム割当なし・iPhoneカクつき要因なし（CSSは一度きりtransition）。JS +525gzip / CSS +270gzip（config値＋コメント）
- 比較ページ `_p3review2.html`（洗練↔現行を独立A/B・phase1短縮で到着を素早く確認）。travel-17本番HTML無変更・config互換維持

## Phase3 Step1 (2026-08-01 / branch: journey-engine-v3) — 静的質感の底上げ（静か・清潔・上品／純CSS）
「演出追加」でなく「高級感を磨く」方針で、質感を静かに整える（**engine無変更＝CSSのみ**）:
- **grain 減衰**: opacity `.05→.03`（「入っているか分からない」上限・映画風回避）
- **vignette 弱化**: 縁のみへ `transparent 58%→62%` ＆ `rgba(2,10,18,.3→.2)`
- **ルート線グリント**: 純白 `rgba(255,255,255,.9)`→控えめなターコイズ寄り `rgba(224,246,250,.82)`（派手な白反射を避け清潔に）
- **地図クレジット**: `rgba(.5→.42)` で一段静かに（情報系は控えめ）
- **保護不変を厳守**: タイミング／動画区間(3.5–16.0s)／画質(720p・1080p CRF20 slow)／`arrivalEase:false` は**全て不変**（CSSのみ・JS/動画/尺 不触）
- **性能**: JS 0B / CSS +334B raw(gzip +219)。静的スタイル値のみ＝init/seek/rAF/GC 影響なし・新要素なし・毎フレーム増なし
- レビュー用 `_p3review.html`（css?v=p3s1・travel-17相当）。travel-17本番HTMLは無変更。config互換維持

## Phase2 Step5 (2026-08-01 / branch: journey-engine-v3) — travel-17 完全不変の総回帰（差分ゼロ判定）
Phase2全体（`journey-v3-phase1-step4`→現在）の runtime 差分を精査し、travel-17 の挙動が不変であることを確定:
- **travel-17.html 差分ゼロ / map-data 差分ゼロ**。変更 runtime は journey-intro.js・.css のみ
- **値計算・演出・タイミング関数はバイト不変**: tickShared/updateFlight/updateLabels/driveCeremony/updateCoordText/arcFrac/seek/enterVideo本体/watchVideo計算/toHero演出(fade,heroZoom)/DEFAULTS(timing,fx,video) は差分なし（`tickShared(ms)` はtry包みのインデント差のみ＝呼び出し同一）
- **happy-pathの唯一の差はステージdivのクラス名**（`ji-stage-japan/ryukyu/miyako`→`ji-stage--i0/i1/i2(+--last)`）。travel-17の3段は同keyframe(jiStJapan/Ryukyu/Miyako)・同fill(.38)へ写像＝**レンダリング等価**
- 他のJS差分は全て**失敗経路のみ**（tick/loopのtry/catch・abortToArticle・start guard）＋**正常完了で解除されるwatchdog**＝正常系で不実行/無効果
- 回帰対象（seek/stage opacity/flight/ceremony/video/Hero transition/タイミング/見た目）**全て不変**。**差分なし**
- コミット無し（検証のみ）。Phase2完了判定を発行

## Phase2 Step4 (2026-08-01 / branch: journey-engine-v3) — 非宮古サンプル地域で動作確認（config切替の実証）
宮古島以外（石垣・川平湾）でも Journey Intro が **config だけで成立**することを実証。**engine/CSS/map-data/travel-17 は無変更**（runtime変更ゼロ）:
- サンプルハーネス `_p2region.html`（未公開）: 石垣・川平湾(24.454,124.145) を destination＋descent だけで切替。段送りは Step1のindex依存で地域名非依存
- 使用データは**既存 `ryukyu` ステージ**（南西諸島全体・53paths が石垣を包含）＝**新規map-data不要**。descent=[japan@東京, ryukyu@沖縄(中間), ryukyu@石垣(保持)]
- 検証: 全descentステージが画面内に解決（i0 63/64・i1 54/54・i2 20/79%）／サンプルconfigは validate 0件／engine・CSS・map-data・travel-17 の git差分ゼロ
- 「地図のみ(動画なし→Hero)」モードで地図降下を単独確認可。参考に宮古(既定descent)も同ページで比較
- 補足: 石垣の“最終クローズアップ”専用データは無いため最終段も ryukyu スケール（パン表現）。近接図が要る地域は build-map-data.mjs でデータ追加（Step2の手順・データのみ）
- **性能**: runtime変更ゼロ＝init/seek/rAF/FPS/mem すべて Step3 と同一。JS/CSS 0B。既存記事影響なし・後方互換維持

## Phase2 Step3 (2026-07-31 / branch: journey-engine-v3) — 安全フォールバック強化（必ず記事本文へ到達）
壊れたconfig / stage不足 / map-data不足 / destination不足 でも**必ず記事本文へ到達**するようフェイルセーフを追加（v1.3.5→**1.3.6-failsafe**）。全て失敗時のみ動作＝正常系はコスト0:
- **構築/開始の例外**: `start()` を try/catch。失敗時は `.ji-overlay` 除去＋`documentElement.overflow` 復元＋null返し（スクロールロックを残さない）。node実証済
- **rAFループの例外**: 地図tick・動画loopを try/catch → `abortToArticle()`（オーバーレイ除去＋スクロール復元＋onComplete）で記事へ復帰
- **サイレント停滞**: 全体ウォッチドッグ（実尺+60s余裕）で未完了なら `abortToArticle()`。正常完了/破棄で解除。誤発火しない上限
- 既存フォールバックは健在: map-data不足→abstract降格 / 未登録stageスキップ / destination既定(空・0で非クラッシュ) / JSON parse失敗→記事表示
- **性能**: try/catchはV8で例外0時コスト0・毎フレーム割当なし。ウォッチドッグはsetTimeout1本(完了で解除)。**init/seek/rAF/FPS/mem 不変**。JS +2584B raw(gzip +673)/CSS 0
- travel-17: 追加コードは失敗経路のみ＝**正常系は完全不変**。V2/V3後方互換維持・記事HTML変更ゼロ

## Phase2 Step2 (2026-07-31 / branch: journey-engine-v3) — map-dataビルドの地域汎用化（地域定義の外部データ化）
地域(ステージ)定義を `build-map-data.mjs` のハードコードから **`scripts/map-regions.json` へ外部化**。**新地域はデータ追加のみ**（スクリプト無改変）で対応可能に:
- `scripts/map-regions.json` 新規: world/japan/ryukyu/miyako を `{file, kind|bbox, minRingArea, mapshaper}` で定義。順序=出力stages順。旧inline定義とバイト一致（値・順序・attribution）を検証
- `build-map-data.mjs`: 定義をJSONから読む形へ改修（**処理ロジックは無改変＝同一入力で同一出力**）。`--regions <json>` `--out <dir>` オプション追加（テスト用に本番を触らず出力可）
- **runtime `journey-map.v1.js` は再生成せず据置**＝**travel-17完全不変**（git差分なしを確認）。**engine(js/css)は無変更**
- 実証: 合成地域を map-regions.json への追加のみでビルド→ `stages.<新地域>` 生成を確認（本番未変更のまま）
- 段送りアニメは Step1で地域名非依存化済のため、3段構造の別地域は **データ追加のみ・CSS追加不要**
- **性能**: runtime変更ゼロ（build-timeのみ）。init/seek/rAF/FPS/mem すべて不変。V2/V3後方互換維持・記事HTML変更ゼロ

## Phase2 Step1 (2026-07-31 / branch: journey-engine-v3) — 段送りアニメの脱・名前依存（slotインデックス化 / Performance First採用=A2）
降下ステージのCSSアニメを地域名依存から降下index依存へ（v1.3.4→**1.3.5-slot**）。**Performance First により JS駆動(A1)ではなくコンポジタ維持のslotCSS(A2)を採用**:
- CSS: `.ji-stage-japan/ryukyu/miyako` → `.ji-stage--i0/i1/i2`（keyframe `jiStJapan/Ryukyu/Miyako` は不変）、最終段の明るいfillは `.ji-stage--last` へ
- provider: 降下index で `ji-stage--i<n>`＋最終段 `ji-stage--last` を付与（地域名クラス廃止）
- travel-17(3段)=i0/i1/i2＋last＝**同keyframe・同fill・同段＝バイト等価レンダリング**（検証済）
- **性能**: JS +223B(gzip +119) / CSS +96B(gzip +70)＝コメント+slot条件のみ。**rAF追加コスト0・毎フレーム割当0**（stageは従来どおりコンポジタCSSアニメ、JS opacityにしない）。init/seek/再生は静的解析上不変
- 別地域は同3段構造なら stage差替のみで動作（N≠3は後続で slotセット拡張）。V2/V3後方互換維持・記事HTML変更ゼロ
- 性能ハーネス `_p2perf.html`（init×20/seek×200/FPS/mem）を追加

## Phase1 Step4 (2026-07-31 / branch: journey-engine-v3) — 新記事 config 雛形ジェネレータ（エンジン非改変）
「configだけで新記事を開始」を実現する `scripts/new-article.mjs`（ビルド時のみ・**エンジン本体は無変更**）:
- 記事固有値（--id/--jp/--ro/--lat/--lon ほか）から、貼付用 config・HTML4点・動画ビルドコマンド・チェックリストを出力
- 出力configは travel-17 の確定プリセット（vector-v2 / arrivalEase:false / heroZoom:false / heroCrossfadeMs:1000 / startAt3.5・playSeconds16.0）ベース＋記事固有値
- 記事スクリプトの `?v=` は travel-17 から自動取得して整合。`--config-out` で config 書き出し可
- 別地域（宮古・八重山エリア外）指定時は降下データ不一致の注意を表示（CONFIG.md §7 と整合）
- 実証: 生成した travel-18 config が `JourneyIntro.validate` で **0件**（そのまま動作）を確認
- CONFIG.md §0 クイックスタート追記。**travel-17・既存記事・エンジンは無変更**。V2/V3後方互換維持

## Phase1 Step3 (2026-07-31 / branch: journey-engine-v3) — config検証 JourneyIntro.validate（警告のみ）
記事作成者が不足項目を把握しやすくする開発補助（v1.3.3→**1.3.4-validate**）:
- `JourneyIntro.validate(cfg)` 公開。`[{level:'warn',path,msg}]` を返し console.warn 出力。**警告のみ・停止しない・configは非改変**
- 自動起動(`auto()`)時に実行。**正しいconfigは0件**（travel-17=0件で検証済＝挙動/コンソール不変）
- 点検: version / id / route.path / route.map(未登録は降格明示) / destination.jp・lat,lon(0/未指定) / video(src・sources無) / sources[].src / route.descent[].stage(map-data無) / hero要素(.ji-hero付け忘れ)
- メッセージは「パス — 何が問題か＋対処」の形（例: `route.path — 航路パス未指定。飛行ラインが描画されません（例: "M258 44 …"）`）
- try/catchで囲みvalidate自体の失敗も初期化を妨げない。CONFIG.md §5.5 追記。V2/V3後方互換維持

## Phase1 Step2 (2026-07-31 / branch: journey-engine-v3) — 降下ステージのconfig化（route.descent）
エンジンにハードコードされていた降下順 `japan / ryukyu / miyako` を `config.route.descent` へ移設（v1.3.2→**1.3.3-descent**）:
- `DEFAULTS.route.descent` に既定3ステージを定義。**未指定configは deep-merge でこの既定を継承＝現行と完全同一**
- 各 `descent[]` = `{ stage, anchor }`。`anchor:[lat,lon]` で焦点固定 / `"destination"`(省略時も)で目的地に焦点
- vector-v2プロバイダはハードコード配列を `cfg.route.descent` 反復に置換。`stage` は `D.stages[]`＋CSS `.ji-stage-<stage>` に対応。データ無しstageはスキップ（他は描画）
- **travel-17は完全に挙動不変**（descent未指定→既定継承。旧ハードコードとアンカー解決がバイト等価であることを検証済）
- 地図描画のみに関与。**ルート線(ji-flight)・到着ピン(a-pin)・座標(a-coord)は buildDom 側で不変**（プロバイダは globe/stages/glow のみ scenes へ追加）
- CONFIG.md §3/§7 更新。V2/V3後方互換維持。記事側HTMLの変更は不要

## Phase1 Step1 (2026-07-31 / branch: journey-engine-v3) — テンプレート化: config完全ドキュメント（エンジン変更なし）
週末ログ全体で再利用するためのテンプレート整備。エンジン/地図/CSSは全記事共有・記事側はHTML4点+configのみ、を明文化:
- `CONFIG.md` 新規: 記事作成者向けリファレンス（HTML4点／記事ごとに変える値の対応表／config全フィールド・必須マーク／route作り方／動画ビルド手順／自動処理一覧／既知の制約）
- `README.md` 更新: CONFIG.md/V3-VERIFY.md へ誘導、V3実態（sources/poster・build-video-renditions・abstract降格）に整合
- **既知の制約を明文化**: `vector-v2` の降下ステージは 日本→南西諸島→宮古 の海岸線データに固定（目的地はlat/lonで焦点合わせされるが海岸線の“形”は宮古周辺）。別地域は当面 `abstract-v1` 推奨。Phase2で `route.descent` config化＋地域別ステージ追加予定
- エンジンコード/挙動は無変更（v1.3.2-arrivalEase）。V2/V3後方互換は不変

## v1.3.2-arrivalEase (2026-07-31 / branch: journey-engine-v3) — 到着減速(playbackRate)の切り分けA/B
iPhone実機でフェード直前の微小カクつきが残存。位置が到着減速開始(接続16.0sの0.9s前=15.1s)と一致するため、`playbackRate` 操作を原因候補として切り分け:
- 新フラグ `video.arrivalEase`（既定true=現行）。**false で easeOut ランプを完全スキップ**＝初期化後 `playbackRate` に一切触れず 1.0固定（フェード中も1.0）
- A/B比較ページ `_v3ease.html`（A=減速あり / B=1.0固定。共通: Hero先読みON・フェード1000ms・Dissolve+Scale(heroZoom ON)・pauseAfterFade。開始位置14.5/13.0/3.5s・ループ）
- 通し確認ページ `_v3final.html`（本番相当: 地図→動画→Hero を通し。arrivalEase:false / Dissolve+Scale 1000ms / Hero先読み / pause後 / progress100% / Mobile 720p。タップで通し再生を2〜3回繰り返し可）
- ramp検証: A は 15.1→16.0s で rate 1.0→0.30、B は全域 1.0（代入自体が走らない）
- **後方互換**: 未指定=true=従来挙動。travel-17 は現状のまま（本A/Bはハーネスで隔離、確定後に反映）
- 方針: iPhone SafariでBのみ滑らかなら到着減速を廃止し、フェード＋Scaleで到着感を維持（heroZoom再ON検討）

## v1.3.1-transition (2026-07-31 / branch: journey-engine-v3) — Hero Crossfade スムーズ化（4点A/B）
`toHero`（動画→Hero）と `enterVideo`（地図→動画）の遷移を4点改善。すべて `cfg.fx` でトグル可＝A/B比較用:
- **①heroPreload**（既定ON）: Hero Crossfade開始の約 `timing.heroPreloadLeadMs`(250ms) 前に記事Hero画像を `img.decode()` 先読み。reveal時のデコードジャンク回避。対象は `cfg.hero`（既定 `.ji-hero`）
- **②progressComplete**（既定ON）: progressバーを100%(`scaleX(1)`)まで満たしてから 地図→動画 クロスフェード（`timing.progressCompleteMs` 250ms）。※「地図から通し」再生時のみ体感
- **③heroZoom**（既定ON・**比較用にconfigでOFF可**）: 末尾の scale(1→1.035)。拡大による軟化要因のため travel-17 は **OFF採用**
- **④pauseAfterFade**（既定ON）: フェード開始時に `video.pause()` せず、**フェード終了後**にpause（フェード中も動画が動き続け、静止フレームの固さを解消）
- travel-17: `"fx": { "heroZoom": false }` を採用、engine読込 `?v=131`。**エンジンAPI/演出の他要素・V2後方互換は不変**（新フラグ未指定の旧configは従来挙動）
- 比較ページ `_v3trans.html`（プリセットA現行/B改善+ZoomOFF/C改善+ZoomON＋個別トグル、接続部のみ/動画から/地図から通し、Hero画像背景つき）
- 検証注意: ④は `playSeconds`(16.0s) を越えてフェード中に約0.3s前進するため、カット済み末尾が僅かに覗く可能性 → A/Bで要確認

## v1.3.0 動画品質確定 (2026-07-31 / branch: journey-engine-v3) — tier再設計＋高画質再エンコード
実機診断で「甘さの主因はエンコードでなく **高DPI端末での540p全画面拡大**（object-fit:cover による2.6〜2.9倍拡大）」と判明。tier方針を再設計:
- **540pを廃止**。mobile=**720p** / tablet=**1080p** / desktop=**1080p**（全tier **CRF20 / preset slow / bt709色タグ明示 / faststart / 無音**）
- 再エンコード: `arrival-720.mp4`=6.94MB / `arrival-1080.mp4`=16.89MB（29.97fps・8bit・bt709 保持）。poster据置(0.03MB)
- travel-17 config を新 `sources`（mobile→720 / tablet・desktop→1080）へ更新。差替え検知のため video/poster に `?v=2` を付与
- `scripts/build-video-renditions.mjs` を新方針に更新（CRF/preset引数化・色タグ・720/1080生成・config出力）。生成物は決定論的に再現
- **エンジンコードは無変更**（v1.3.0-step3のまま）。Save-Data/2G/loadBudget/poster/Heroフォールバック/iOS cap/V2後方互換は現状維持
- 検証: `_v3cmp.html`(選択/画質/poster/サイズ/マトリクス) ＋ `_v3res.html`(全画面拡大率の実測・本番同条件の全画面比較)

## v1.3.0-step4 (2026-07-31 / branch: journey-engine-v3) — V3 Step4: レンディション生成＋travel-17適用（実運用入り）
- 新規 `scripts/build-video-renditions.mjs`（ffmpeg-static・build-map-data.mjsと同方式）: マスター4Kから 540/720/1080(縦・H.264 faststart 無音)＋poster.webp を生成。サイズレポート＆config貼付スニペットを出力
- **travel-17 を `sources`/`poster` へ切替**＝V3で初の適応配信（エンジン読込を `?v=130` に更新しV3エンジンをロード）
- 生成物 `assets/video/travel-17/`：arrival-540(1.09MB)/-720(2.90MB=現行v2と同一)/-1080(10.97MB)/-poster.webp(0.03MB)、いずれも19.69s
- 検証: 手順書 `assets/journey/V3-VERIFY.md`＋比較ページ `_v3cmp.html`（PC/iPhone同条件・自動選択表示・手動画質比較・poster確認・サイズHEAD取得・選択マトリクス・ログ）
- 選択ログ（実config）: iPhone375→mobile / iPad768・iPadPro1366→tablet(iOS cap) / PC1440→desktop / 2g・SaveData→Hero直行 / 3g→mobile再生
- **V2への影響なし**: エンジンコード無変更（Step3のまま）。旧 `journey-arrival-v2.mp4` は温存。travel-17以外の記事は単一src＝従来挙動

## v1.3.0-step3 (2026-07-31 / branch: journey-engine-v3) — V3 Step3: iOS Safari 安定化ハードニング
- `<video>` に `webkit-playsinline` を追加（旧iOSのインライン再生）。`playsinline`/`muted`属性は明文化
- **canplay gating**: `enterVideo` で `readyState≥2` なら即再生（通常/V2＝挙動不変）、未準備なら `canplay` を待って再生。iOSの早すぎる `play()` 拒否・黒画面を回避（待機中はposter表示、`loadBudgetMs`超過ならHero）
- **iOS tier cap**: iOS(iPhone/iPad/iPadOS13+)では高解像度デコード回避のため最上位(desktop=maxWidth無し)を選ばず、maxWidth有りの最上位(tablet相当)にcap。V3の`sources`指定時のみ・iPhone/iPadは元々mobile/tabletなので実質iPad Pro級のみ対象
- autoplay拒否/低電力モードは従来どおり即Hero（Step2の集約を踏襲）。`toHero`で保留canplayを無効化
- 追加API（内部・テスト用）: `JourneyIntro._isIOS()`
- **V2への影響なし**: 単一src(travel-17)はtier cap対象外。canplay gatingは「未準備時のみ」分岐＝先読み済みの通常再生は同一。属性追加は非iOSで無害

## v1.3.0-step2 (2026-07-31 / branch: journey-engine-v3) — V3 Step2: 回線フォールバック＋読込予算＋poster
- `navigator.connection` から Save-Data / effective[slow-2g,2g] を判定。**V3設定(`video.sources`)時のみ** `saveDataFallback`（既定 `hero`）で動画を出さず 地図→到着セレモニー→Hero に直行。`lowest` 指定なら最低tierに差替えて再生
- `video.loadBudgetMs`（既定6000）: enterVideo後この時間内に再生位置が進まなければ（未準備/停滞）→ Heroへ。従来の4sウォッチドッグを置換
- 再生失敗を必ずHeroへ集約: `play()`拒否 / `error`イベント / 予算超過 / `ended` の全経路が `toHero`
- `poster`（`video.poster`）を `<video>` に設定＝黒画面回避の接続フレーム（生成はStep4）
- **V2への影響なし**: `sources` 無しの単一src(travel-17)は回線スキップ対象外＝常に再生（従来挙動）。失敗時フォールバックのみ強化
- 追加API（内部・テスト用）: `JourneyIntro._planVideo(videoCfg, chosen, netOverride?)` / `._readNetwork()`

## v1.3.0-step1 (2026-07-31 / branch: journey-engine-v3) — V3 Step1: 端末別 動画ソース選択
- config `video.sources`（任意・配列）に対応。viewport幅＝デバイスクラスで「条件を満たす最小tier」を選択（mobile軽量維持のためDPRでtier引上げしない）
- `sources` 無しは従来の `video.src`（V2）をそのまま使用＝**後方互換**（travel-17は挙動不変）
- 選択結果は `instance.chosenVideo`、ロジックは `JourneyIntro._pickVideoSource(videoCfg, vw?)` で単体テスト可
- 演出・公開API不変。回線判定/フォールバック/posterはStep2以降


## V2 最終候補確定（2026-07-31 / travel-17）
実機(iPhone)確認を経て、Journey Intro V2 の演出パラメータを確定（エンジン無改変・config層のみ）:
- 動画: `journey-arrival-v2.mp4`（縦720p/faststart/無音）を **startAt 3.5s → playSeconds 16.0s**（ドローン尺12.5s・到着感維持）
- Heroフェード: **heroCrossfadeMs 1000ms ＋ heroZoom(Scale)** ＝ Dissolve+Scale（"ボワーン"と柔らかく溶け込む）
- 到着減速(easeOut 900ms)・到着セレモニーは既定のまま
- iOS動画自動再生の堅牢化(v1.2.1: muted属性/先読み)込み
- ※main マージ・Cloudflare公開はユーザー最終確認後


## v1.2.0 (2026-07-29〜30) — V2品質仕上げ ※正式公開版候補

**地図エンジン刷新（vector-v2）**
- 世界=Natural Earth 110m(PD) / 日本近海=国土地理院「地球地図日本」v2.2(polbnda) の実海岸線を
  ビルド時前処理（`scripts/build-map-data.mjs`・mapshaper 4段LOD）→ `map-data/journey-map.v1.js`（27.5KB gzip）
- 地球儀の中を実世界地図が自転／日本(東京アンカー)→南西諸島→宮古・伊良部を実海岸線でLODクロスフェード降下
- 出典を intro 左下に自動表示（プロバイダの `attribution`）。モバイルは2行折返しでスキップボタンと非干渉
- map-data 欠落/破損時は abstract-v1 に自動降格（記事は壊れない）。ランタイム外部通信0・CSP無変更
- fix: プロバイダ生成要素を決定論シークの制御対象に収集（エンジン化時のリグレッション）
- fix: 降格時に前回mountの出典表記が残留する問題

**計測（Lighthouse モバイルエミュレーション・4xスロットリング）**
| | Perf | A11y | BP | LCP | CLS | TBT |
|---|---|---|---|---|---|---|
| ベースライン(イントロ無し) | 66 | – | – | 6.5s | 0 | 220ms |
| v1.2.0(イントロ有り) | 59 | 96 | 96 | 7.0s | **0** | 350ms |

→ イントロの追加コストは -7pt / LCP+0.5s / TBT+130ms。CLS 0 維持（オーバーレイはレイアウト非干渉）。

## v1.1.1 (2026-07-29) — travel-17 本番組み込み
- 記事側3行＋config JSON で組み込み。動画ウォッチドッグ／Intro中スクロールロック／完了後オーバーレイ自動破棄
- Skip・reduced-motion・同一セッション2回目自動スキップ・404/autoplay拒否フォールバックを実機相当で検証

## v1.1.0 — Phase2 演出
- トレイルグリント／ピン着地リング×2／240ms映画的マッチカット／粒状ノイズ+ビネット（全て `cfg.fx` でOFF可）

## v1.0.0 — エンジン化
- 単一HTML試作を config駆動エンジンへ分離（3層構成）。MapProvider差替口・決定論シーク・WAAPIクロスフェード

## 既知の制約
- Lighthouse Perf はサイトベースライン(66)自体がモバイル4xスロットルで頭打ち（Hero画像1600pxが支配的）
- 低速回線では本文が一瞬見えてからイントロが被る（JS失敗時も記事が読める安全側の設計判断）
- バックグラウンドタブでは rAF が止まるが `ended` イベントで完走を保証
- reduced-motion はコード+CSSの二重防御だが、実OS設定での最終確認は実機にて
- 音声(`cfg.audio`)はフックのみ（無音運用）。地図の nodeGeo(緯度経度)指定は将来拡張
