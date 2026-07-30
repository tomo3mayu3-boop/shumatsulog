# Journey Engine V3 設計提案 — 端末・通信適応の動画最適化

作成: 2026-07-31 ／ ステータス: **設計提案（未実装・レビュー待ち）**
前提: V2（`journey-intro-v1` ブランチ・engine v1.2.1）は完成・確定。本V3はその上に**後方互換で**積む。

---

## 1. 目的と対象範囲

**目的（V3主目的）**
1. スマホとPCで適切な動画解像度を出し分ける
2. スマホ＝軽量版 / PC＝高画質版
3. 読み込みが遅い場合はHero画像へ自然にフォールバック
4. iPhone Safari でも再生開始が安定
5. **V2の設定互換性を維持**（既存 config はそのまま動く）
6. travel-17以外でも **JSON設定だけで再利用**できる設計を維持

**対象範囲（やること）**: 動画の選択・読み込み・フォールバック・アセット生成のみ。
**スコープ外（やらないこと）**: 演出の変更（宇宙→…→Heroの振付は不変）、SDK/管理画面/自動生成（=V4以降）。

---

## 2. 基本方針

- **選択はJSで1本に決定**（viewport幅・DPR・`navigator.connection`）→ `<video>` に設定。
  - `<source media>` は「回線」を判定できず、エンジンはJSで video を制御（currentTime/playSeconds）するため、**JS選択方式**を採用。
- **後方互換の要**: V2の `video.src`（単一）はそのまま動作。V3は `video.sources`（配列）を**追加した時だけ**選択ロジックが働く。
- ランタイムの外部通信0・CSP無変更を維持（自己ホスト）。

---

## 3. config スキーマ拡張（すべて任意＝後方互換）

```jsonc
"video": {
  "src": ".../arrival-720.mp4",       // 必須(V2). sources無し/選択不能時のフォールバック
  "sources": [                        // 任意(V3). あれば端末/回線で最適を選択
    { "src": ".../arrival-540.mp4",  "maxWidth": 640,  "tier": "mobile"  },
    { "src": ".../arrival-720.mp4",  "maxWidth": 1024, "tier": "tablet"  },
    { "src": ".../arrival-1080.mp4",                   "tier": "desktop" }
  ],
  "poster": ".../arrival-poster.webp", // iOS安定＆フォールバック用の1枚(接続フレーム)
  "startAt": 3.5, "playSeconds": 16.0, // V2と同じ
  "loadBudgetMs": 6000,               // これを超えて再生準備できなければHeroへ(既定: heroCrossfade+余裕)
  "saveDataFallback": "hero"          // "hero"=動画を出さずHero / "lowest"=最低tier
}
```
- 旧記事（`src`のみ）＝V2挙動。`sources`を書いた記事だけV3選択。**config `version` は1のまま**（追加項目は任意）。

---

## 4. 選択ロジック（優先順）

1. `prefers-reduced-motion: reduce` → 従来どおりIntro自体を生成しない（即Hero）。
2. `connection.saveData==true` または `effectiveType∈{slow-2g,2g}` → `saveDataFallback`（既定 `hero`＝動画スキップ、地図→到着セレモニー→Hero）。
3. `effectiveType==='3g'` → `mobile` tier 固定。
4. 上記以外 → `実効幅 = innerWidth`（high-DPIは1段引き上げる係数を適用）を各source `maxWidth` と突き合わせ、**条件を満たす最小tier**を選択。`maxWidth` 無しは最上位(desktop)。
5. `sources` 未指定 → `video.src`（V2挙動）。
6. `navigator.connection` 非対応（Safari等）→ 回線判定はスキップし viewport/DPR のみで選択（安全側に中位tier既定）。

---

## 5. 読み込み予算とHeroフォールバック

- Phase1（地図≈13.6s）中に、選択rendition を `preload=auto`＋`load()` で**先読み**（V2実装を踏襲）。
- **enterVideo 時**: `readyState≥3(HAVE_FUTURE_DATA)`相当まで待つ。`loadBudgetMs` 超過 or `error/stalled` → **動画フェーズを飛ばして到着セレモニー→Heroへ直行**（poster/Heroが見える）。
- **再生中**の `stalled/waiting` が一定時間継続 → その位置からHeroへクロスフェード（現状 `toHero` 流用）。
- 既存の「autoplay拒否→toHero」「`ended`保険」「4sウォッチドッグ」を踏襲・強化。
- → いずれの失敗でも**記事は必ず閲覧可能**（V2の安全設計を維持）。

---

## 6. iPhone Safari 安定化

- `muted`属性＋`playsinline`（＋`webkit-playsinline`）: v1.2.1で対応済み、V3で明文化。
- **`poster` 設定** → 再生前でもフレーム表示（黒画面回避・体感安定）。
- 選択renditionは **faststart 必須**（ビルド時付与）。
- iOSは高解像度デコードが重い → iOSでは上限tierを係数で制限（例: desktop選ばず tablet上限）。
- 低電力モード等で `play()` 拒否 → 即Heroフォールバック（現状 `.catch` 流用）。

---

## 7. アセット・パイプライン（ビルド時のみ・ffmpeg）

- `scripts/build-video-renditions.mjs`（`npm ffmpeg-static` 使用＝build-map-data.mjsと同方式・実証済み）:
  - 入力: マスター動画（今回の元4K等）＋ トリム情報（例 `-ss/-to`）。
  - 出力: `assets/video/<slug>/arrival-540.mp4 / -720.mp4 / -1080.mp4`（H.264 / **faststart** / 無音 / 縦）＋ `arrival-poster.webp`（Hero接続フレーム）。
  - 命名・ディレクトリ規約を固定 → config はパターンで機械的に書ける。
- 参考コマンド（各tier）:
  `ffmpeg -i master.mp4 -ss <s> -to <e> -map 0:v:0 -vf scale=<W>:-2 -c:v libx264 -crf <22-26> -preset veryfast -pix_fmt yuv420p -an -movflags +faststart out.mp4`

---

## 8. ファイル構成

```
assets/journey/journey-intro.js     # 動画選択+読込予算+フォールバック強化(V3・後方互換)  ← 主変更
assets/journey/journey-intro.css    # 原則変更なし(posterのobject-fit微CSSのみ想定)
scripts/build-video-renditions.mjs  # 新規(ビルド時・ffmpeg-static)
assets/video/<slug>/                # 記事別 renditions(540/720/1080) + poster.webp
_spec_journey_engine_v3.md          # 本提案
assets/journey/RELEASE-NOTES.md     # v1.3.0 追記
```

---

## 9. 段階的実装手順（各ステップで travel-17 を壊さない）

| Step | 内容 | travel-17への影響 |
|---|---|---|
| **1. スキーマ＋選択** | `video.sources` 対応＋viewport/DPR選択（無ければ`src`にフォールバック） | 無し（renditions未整備の間は単一srcのまま） |
| **2. 回線対応＋フォールバック** | saveData/effectiveType判定・`loadBudgetMs`超過→Hero直行・poster対応 | 無し（configに sources/poster を書くまで従来挙動） |
| **3. iOS安定化ハードニング** | canplay gating・poster・autoplay拒否整理 | 無し（堅牢化のみ） |
| **4. パイプライン＋切替** | build-video-renditions.mjs → travel-17のrenditions生成 → configを`sources`へ | ここで初めて travel-17 が適応配信に |
| **5. 横展開** | 記事テンプレ/travel-articleスキルに「renditions+poster生成」と config雛形を追記 | 他記事も3行+JSONで適応対応 |

各Stepは独立コミット（1コミット=1目的・rollback可）。Step1-3はエンジン堅牢化のみで見た目不変。

---

## 10. ブランチ戦略・互換

- **推奨: `journey-intro-v1`（V2確定）から `journey-engine-v3` ブランチを切る。** V2は「いつでも公開できる状態」を保持し、V3は隔離して進める。
- engine semver: 1.2.x → **1.3.0**（加算的・後方互換）。既存API（`start/registerMap/seek/current`）不変。
- 旧記事（単一src）はそのまま動作＝**互換維持**。

---

## 11. リスクと対応

| リスク | 対応 |
|---|---|
| Safariが `navigator.connection` 非対応 | viewport/DPRのみで選択・安全側の中位tier既定。saveData相当は判定不可＝控えめに |
| renditions×記事数でリポ肥大 | 将来 Cloudflare R2/Stream 外出し（`src`絶対URL対応は設計済み） |
| poster生成の追加工数 | poster任意（未指定でもHero直フォールバックで動作） |
| tier選択の解像度基準 | Step4着手時に実機で最終決定（暫定: mobile 540 / tablet 720 / desktop 1080 縦） |

---

## 12. 未確定・要相談（実装前に決めたい点）

1. tier解像度の初期値（暫定 540/720/1080 縦でよいか）
2. `loadBudgetMs` 既定値（暫定6000ms＝地図の途中で判断可）
3. saveData/2g時は「動画スキップ→Hero」でよいか（＝`saveDataFallback: "hero"`）
4. poster を用意するか（iOS安定に有効だが、無くてもHero直フォールバックで動く）
