# Journey Engine — Config リファレンス（記事作成者向け）

Journey Intro は **エンジン非依存・config駆動**。新記事は「HTMLに4点を差し込み → configを書く → 動画を書き出す」だけで完成します。
エンジン(`journey-intro.js`)・地図データ(`map-data/`)・CSSは**全記事で共有**（記事ごとの改変不要）。

---

## 1. 記事HTMLに差し込む4点

```html
<!-- ① head: 共有CSS -->
<link rel="stylesheet" href="assets/journey/journey-intro.css">

<!-- ② Hero画像に ji-hero クラス（フェード着地先＝先読み対象） -->
<img src="images/travel/<slug>/hero.webp" class="viewer-photo ji-hero" width="1600" height="2844" alt="…">

<!-- ③ body末尾: この記事の旅設定（id=journey-intro-config で自動起動） -->
<script type="application/json" id="journey-intro-config">
{ …この記事のconfig（下記スキーマ）… }
</script>

<!-- ④ body末尾: 共有スクリプト（?v= はキャッシュ更新用。全記事で同じ値に揃える） -->
<script src="assets/journey/map-data/journey-map.v1.js?v=131" defer></script>
<script src="assets/journey/journey-intro.js?v=131" defer></script>
```

記事ごとに変えるのは **② の画像パス** と **③ の config** だけ。①④は全記事共通（コピペ）。

---

## 2. 記事ごとに変える値（＝configの必須項目）

| 項目 | config | 例 |
|---|---|---|
| 記事ID | `id` | `"travel-18"` |
| タイトル(目的地名) | `destination.jp` / `destination.ro` | `"川平湾"` / `"Kabira Bay"` |
| 座標 | `destination.lat` / `destination.lon` | `24.454` / `124.145` |
| Hero画像 | HTMLの `class="ji-hero"`（configの`hero`は既定`.ji-hero`） | — |
| 動画 | `video.sources` / `video.poster` | `assets/video/travel-18/arrival-*.mp4` |
| ルート | `route.path` / `route.waypoints` / `route.introLabel` | 下記 §4 |

これ以外（fx・timing・skip・easeOut等）は**すべて既定値**で動きます（省略可）。

---

## 3. config スキーマ（全フィールド）

`*` = 必須。それ以外は省略時デフォルト。**未知/省略フィールドは既定に deep-merge**（＝後方互換：古いconfigはそのまま動く）。

```jsonc
{
  "version": 1,                    // * スキーマ版（現行1固定）
  "id": "travel-18",               // * 記事識別子（ji-seen:<id> セッションキーに使用）

  "route": {
    "map": "vector-v2",            // "vector-v2"(実海岸線) | "abstract-v1"(様式化)。データ欠落時は自動でabstractへ降格
    "path": "M258 44 Q…",          // * 航路のSVGパス（flight viewBox 300×300 座標系）
    "waypoints": [                 // 経由地ラベル（node は同 300×300 座標）
      { "jp": "東京", "ro": "Tokyo", "node": [258, 44] }
    ],
    "introLabel": { "jp": "世界", "ro": "The World" }
  },

  "destination": {                 // * 目的地（座標セレモニー＋地図アンカーに使用）
    "jp": "川平湾", "ro": "Kabira Bay", "lat": 24.454, "lon": 124.145
  },

  "hero": ".ji-hero",              // フェード着地先のHero画像セレクタ（先読み対象）

  "video": {
    "src": "assets/video/travel-18/arrival-720.mp4?v=1",   // * フォールバック単一URL（sources非対応/失敗時）
    "sources": [                                            // 端末別（無ければ src のみ＝V2挙動）
      { "src": ".../arrival-720.mp4?v=1",  "maxWidth": 640,  "tier": "mobile"  },
      { "src": ".../arrival-1080.mp4?v=1", "maxWidth": 1024, "tier": "tablet"  },
      { "src": ".../arrival-1080.mp4?v=1",                   "tier": "desktop" }
    ],
    "poster": ".../arrival-poster.webp?v=1", // 再生前フレーム（黒画面回避）
    "startAt": 3.5,                // 再生開始秒
    "playSeconds": 16.0,           // Hero接続点（この秒でフェード）
    "arrivalEase": false,          // 到着減速(playbackRateランプ)。false=1.0固定（iOSカクつき回避／推奨）
    "easeOutMs": 900, "easeOutRate": 0.30, // arrivalEase:true時の減速カーブ
    "objectPosition": "center",
    "loadBudgetMs": 6000,          // 準備がこの時間で整わなければHero直行
    "saveDataFallback": "hero"     // Save-Data/2G時 "hero"=動画スキップ / "lowest"=最低tier
  },

  "fx": {                          // 演出トグル（全既定ON。比較/無効化はここで）
    "heroZoom": true,              // Hero接続の Scale(1→1.035)=Dissolve+Scale
    "heroPreload": true,           // 接続前にHero画像を decode 先読み
    "progressComplete": true,      // progressバーを100%満たしてから動画へ
    "pauseAfterFade": true,        // フェード完了後に video.pause（フェード中も動画継続）
    "trailGlint": true, "glintLen": 0.07, "pinRing": true, "grain": true, "vignette": true
  },

  "timing": {                      // 尺・遷移（既定で十分。微調整用）
    "heroCrossfadeMs": 1000,       // Hero接続フェード長（travel-17は1000）
    "phase1Ms": 13000, "flightStartPct": 0.46, "flightEndPct": 0.90,
    "crossfadeMs": 900, "heroPreloadLeadMs": 250, "progressCompleteMs": 250,
    "labelFadeMs": 380, "labelPassDelayMs": 250,
    "arrival": { "holdMs":380, "pinMs":600, "labelStartMs":560, "labelMs":560, "coordStartMs":640, "coordMs":1000, "pauseMs":1280 }
  },

  "skip": { "button": true, "label": "スキップ", "oncePerSession": true },
  "brand": "週末ログ · Journey"
}
```

### travel-17（現行本番）の実効config＝推奨プリセット
`video.arrivalEase:false` / `fx.heroZoom` は記事で調整（HQ検証の採用値）/ `timing.heroCrossfadeMs:1000` / 動画 `startAt:3.5, playSeconds:16.0`。
新記事はこれをベースに **destination・route・video を差し替え**れば同品質になります。

---

## 4. ルート（route.path / waypoints）の作り方

- 座標系は **flight SVG の viewBox 300×300**（左上原点）。地図(vector-v2)の見え方と厳密一致ではなく、「宇宙→世界→経由地→目的地」の**航路演出**を描くための抽象座標。
- `path`: 始点(東京付近)→経由地→目的地へ向かう緩いカーブ。`waypoints[].node` は通過ラベルを出す点。
- 既存の travel-17 パスを流用し、経由地名(waypoints.jp/ro)と終端の向きだけ調整するのが最短。
- 目的地の**地図アンカー**は `destination.lat/lon`（航路座標とは独立にエンジンが緯度経度で焦点合わせ）。

---

## 5. 動画の用意（ビルド時のみ・ffmpeg）

```bash
node scripts/build-video-renditions.mjs --in "<マスター動画>" --slug travel-18 --poster-at 3.5
```
- 出力: `assets/video/travel-18/arrival-720.mp4 / -1080.mp4 / -poster.webp`（720=mobile / 1080=tablet+desktop、CRF20 slow・bt709・faststart・無音）。
- スクリプトが **configスニペット** を出力するので、それを ③ の `video` に貼り付け（`?v=` は差替え時に更新）。
- 詳細/検証は `V3-VERIFY.md`。ffmpegは `npm i -D ffmpeg-static` か `--ffmpeg <path>`。

---

## 6. エンジンが自動で面倒を見るもの（記事側の実装不要）

Skip／`prefers-reduced-motion`（即Hero）／同一セッション2回目の自動スキップ／端末別解像度選択／Save-Data・2G→Hero直行／iOS canplay gating・autoplay拒否→Hero／読込予算超過→Hero／Intro中スクロールロック＆復元／完了後のDOM破棄＆デコーダ解放／出典表記の自動表示。

---

## 7. 既知の制約（Phase 2 で解消予定）

- **降下ステージの地域固定**: `vector-v2` の降下は 日本→南西諸島→**宮古(実海岸線)**。目的地は `lat/lon` で焦点合わせされるが、**表示される海岸線の“形”は宮古周辺のデータ**。
  → 宮古・八重山エリアの記事はそのまま高精度。**別地域（本島/北海道等）は海岸線の形が一致しない**ため、
  Phase 2 で (a) 降下ステージを `route.descent` としてconfig化、(b) 地域別 map-data ステージの追加、で対応予定。
  それまで別地域は `route.map:"abstract-v1"`（様式化・地域非依存）を使えば違和感なく成立する。
- 音声(`audio`)はフックのみ（無音運用）。
- `route` の緯度経度→航路座標の自動投影は未対応（航路は viewBox 座標で手動指定）。
