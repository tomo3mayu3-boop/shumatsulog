# Journey Intro Engine

旅行記事の冒頭に「宇宙→世界→経由地→目的地→実写ドローン→Hero」の導入演出を差し込むエンジン。
設計書: リポジトリ直下 `_spec_journey_intro_engine.md` ／ 変更履歴: `RELEASE-NOTES.md`

## 記事への組み込み（3点だけ）

```html
<!-- head -->
<link rel="stylesheet" href="assets/journey/journey-intro.css">

<!-- body末尾: この記事の旅設定（id が journey-intro-config なら自動起動） -->
<script type="application/json" id="journey-intro-config">
{ "version": 1, "id": "travel-XX",
  "route": { "map": "vector-v2", "path": "M258 44 …", 
             "waypoints": [ { "jp": "東京", "ro": "Tokyo", "node": [258,44] }, … ],
             "introLabel": { "jp": "世界", "ro": "The World" } },
  "destination": { "jp": "○○", "ro": "…", "lat": 0.0, "lon": 0.0 },
  "video": { "src": "assets/video/○○.mp4" },
  "skip": { "button": true, "label": "スキップ", "oncePerSession": true } }
</script>
<script src="assets/journey/map-data/journey-map.v1.js" defer></script>
<script src="assets/journey/journey-intro.js" defer></script>
```

- 動画: 「降下部分のみ・無音・Hero戻し無し」で書き出したものを指定（Hero接続はエンジンが行う）
- `route.map`: `"vector-v2"`（実海岸線）/`"abstract-v1"`（様式化）。map-data未読込時は自動でabstractへ降格
- CSP: インラインJSONは実行されないデータブロックのため本番CSP（inline script禁止）でも動作

## 自動で面倒を見るもの

Skip ボタン／`prefers-reduced-motion`（即Hero）／同一セッション2回目の自動スキップ（`ji-seen:<id>`）／
動画404・autoplay拒否・データ欠落のフォールバック／Intro中のスクロールロックと復元／完了後のDOM自動破棄／出典表記の自動表示

## 開発

- ハーネス: `/_proto_journey_intro.html`（リプレイ・ループ・決定論スクラバー。`instance.seek(ms)` で任意時刻を静止）
- 地図データ再生成: `scripts/build-map-data.mjs` 冒頭のコメント参照（mapshaperコマンド込み・ビルド時のみ）
- API: `JourneyIntro.start(cfg, opts)` / `registerMap(name, provider)` / `current`。詳細は journey-intro.js ヘッダ
