# Journey Intro Engine

旅行記事の冒頭に「宇宙→世界→経由地→目的地→実写ドローン→Hero」の導入演出を差し込む、**config駆動・記事非依存**のエンジン。
全記事でエンジン/地図データ/CSSを共有し、記事側は **HTML4点＋config** を書くだけ。

- **記事の作り方・config全項目**: → [`CONFIG.md`](CONFIG.md)（記事作成者はまずこれ）
- 動画の書き出し・実機検証: → [`V3-VERIFY.md`](V3-VERIFY.md)
- 変更履歴: → [`RELEASE-NOTES.md`](RELEASE-NOTES.md)

## 記事への組み込み（4点）

```html
<link rel="stylesheet" href="assets/journey/journey-intro.css">            <!-- ① head -->
<img … class="ji-hero" …>                                                  <!-- ② Hero画像に ji-hero -->
<script type="application/json" id="journey-intro-config">{ …config… }</script> <!-- ③ 記事の旅設定 -->
<script src="assets/journey/map-data/journey-map.v1.js?v=131" defer></script>   <!-- ④ 共有スクリプト -->
<script src="assets/journey/journey-intro.js?v=131" defer></script>
```

記事ごとに変えるのは **②のHero画像** と **③のconfig（destination・route・video）** だけ。詳細は `CONFIG.md`。

- `route.map`: `"vector-v2"`(実海岸線) / `"abstract-v1"`(様式化・地域非依存)。map-data未読込時は自動でabstractへ降格
- 動画: `scripts/build-video-renditions.mjs --slug <id>` で 720/1080/poster を生成し `video.sources` に指定
- CSP: インラインJSONは実行されないデータブロックのため本番CSP（inline script禁止）でも動作

## 自動で面倒を見るもの

Skip／`prefers-reduced-motion`（即Hero）／同一セッション2回目の自動スキップ（`ji-seen:<id>`）／端末別解像度選択／
Save-Data・2G→Hero直行／iOS canplay gating・autoplay拒否・データ欠落のフォールバック／Intro中スクロールロック＆復元／完了後のDOM破棄＆デコーダ解放／出典表記の自動表示

## 開発

- 比較/検証ハーネス（リポジトリ直下・未公開）: `_v3cmp.html`(選択/サイズ) `_v3res.html`(解像度) `_v3trans.html`(遷移A/B) `_v3ease.html`(減速A/B) `_v3final.html`(通し確認)
- 決定論スクラバー: `instance.seek(ms)` で任意時刻を静止
- 地図データ再生成: `scripts/build-map-data.mjs`（mapshaperコマンド込み・ビルド時のみ）
- API: `JourneyIntro.start(cfg, opts)` / `registerMap(name, provider)` / `current` / `version`。詳細は `journey-intro.js` ヘッダ
- 既知の制約（降下ステージの地域固定など）は `CONFIG.md` §7
