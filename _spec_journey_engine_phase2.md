# Journey Engine Phase2 設計提案 — 地域汎用化（宮古島専用構造の解体）

作成: 2026-07-31 ／ ステータス: **設計提案（未実装・レビュー待ち）** ／ branch: journey-engine-v3
前提: Phase1（テンプレート化）完了。engine v1.3.4-validate。本Phaseはその上に**後方互換で**積む。

---

## 1. 目的・スコープ

**目的**: `japan / ryukyu / miyako` に固定された 地図データ・降下ステージ・CSS を汎用化し、**configだけで別地域へ差し替え**られる構造にする。
**スコープ外**: 新演出の追加、演出の見た目変更（宇宙→…→Heroの振付は不変）。あくまで「再利用性・拡張性・保守性」。

**絶対条件（全Step共通）**
- travel-17 の演出（見た目・タイミング・挙動）を**一切変えない**
- 既存configとの後方互換維持（`descent`/`stages` 未指定は現行同一）
- 記事側HTMLの変更は最小限（原則ゼロ）
- map-data が無い地域でも**記事本文へ安全に進める**
- 各Stepは独立コミット＝rollback可

---

## 2. 現状の結合点（解くべき3層）

| 層 | 現状 | 結合 |
|---|---|---|
| データ | `JOURNEY_MAP_DATA.stages={world,japan,ryukyu,miyako}` | 地域固定（データは本質的に地域依存） |
| プロバイダ | `cfg.route.descent` 反復＋`D.stages[key]`＋lat/lonアンカー | **概ね汎用**（Phase1 Step2済）。残: `ji-stage-<key>` クラス付与 |
| CSS | `.ji-stage-japan/ryukyu/miyako`→`jiStJapan/Ryukyu/Miyako`（位置依存の3段ずらしopacity）＋miyako固有fill | **名前依存の本丸** |

**核心**: 段送りアニメは本来「降下順（1段目/2段目/最終段）」に依存し、地域名には依存しない。ここを名前非依存にすれば汎用化できる。

---

## 3. 主要設計判断（レビューしてほしい点）

### 判断A: 段送りアニメの脱・名前依存 — 「データ駆動 + JS駆動opacity」を推奨
現行 `jiStJapan/Ryukyu/Miyako` は `--ji-p1` 上の keyframe（例 japan: 47→53→62→68%）を `ease-in-out` で補間。
- **案A1（推奨）JS駆動**: 各stageの opacity を決定論tick（`tickShared`/`seek`）で計算。stage記述子に `at:{in,hold,out}`（%）を持たせ、**CSSの ease-in-out を JS で厳密再現**（`cubic-bezier(.42,0,.58,1)` 実装）。
  - 利点: 任意段数で動作／`seek()`決定論と統合／stage用CSSアニメを全廃＝名前依存ゼロ。
  - travel-17不変の担保: 既定3段の `at` を現行keyframeに一致させ、**CSS opacity(解析値) と JS opacity を各時刻でサンプリング比較**して同一を保証（ブラウザ不要の解析検証が可能）。
- **案A2（代替）slotクラス**: CSSを `.ji-stage--i0/i1/i2`（降下index）へ改名。keyframe内容は不変＝travel-17完全同一。段数は事前定義セット（2/3/4段）に限定。
  - 利点: CSSリネームのみ＝最小リスク。欠点: 段数が固定セットに制限・CSS依存が残る。
- **結論（Performance First により改定・採用A2）**: A1 は stage opacity を毎フレーム メインスレッドで計算/書込＝現行のコンポジタCSS（メインスレッド0コスト）から rAF 処理時間が必ず増える。追加条件「少しでも悪化するなら実装しない」に反するため **A2（slotインデックスCSS）を正式採用**。keyframe不変＝travel-17バイト等価／rAF追加コスト0／毎フレーム割当0。段数対応(N≠3)は slotセット拡張で対応（後続Step）。
  - **Step1 実装済**: `.ji-stage-japan/ryukyu/miyako` → `.ji-stage--i0/i1/i2`、最終段 `.ji-stage--last`。プロバイダは降下indexでクラス付与。

### 判断B: 最終段の明るいfill（`.ji-stage-miyako .ji-land path`）
→ 記述子の任意プロパティ `fill`（または `hold:true` の段に既定適用）で汎用化。未指定は現行の標準fill。

### 判断C: map-data の地域追加
データは本質的に地域依存。`build-map-data.mjs` の地域テーブル（現在 japan/ryukyu/miyako をハードコード）を**地域定義JSONで受ける**よう汎用化し、地域追加＝定義追加＋geojson供給に。mapshaperのbbox clipコマンドも地域定義から生成/明記。

---

## 4. Step 分解（各Step: 変更ファイル/変更内容/travel-17影響/確認/rollback を完了時報告）

### Step 1 — 降下ステージ記述子のスキーマ確立（レンダリング不変）
- `route.descent[]` を `{ stage, anchor, at?, hold?, fill? }` に拡張。既定3段に**現行keyframe一致の `at`** を付与（`DEFAULTS.route.descent`）。
- レンダリングは**現行CSSのまま**（この時点で見た目は1px も変えない）。`validate` を記述子対応に拡張。CONFIG.md 追記。
- travel-17影響: なし（既定継承・CSS据置）。rollback: revert 1コミット。
- 目的: データモデルを先に確定し、Step2の切替を安全化。

### Step 2 — 段送りアニメの脱・名前依存（JS駆動opacityへ切替）
- プロバイダ: `ji-stage-<key>`（アニメ起点）への依存を除去。stage opacity を `tickShared`/`seek` で `at`＋bezier(.42,0,.58,1) により算出。
- CSS: `.ji-stage-*` の**アニメ宣言を撤去**（`.ji-stage` 基本スタイルは残す）。`fill` は記述子/`hold`基準へ。
- **travel-17 完全不変の検証**: 既定3段で CSS解析opacity vs JS opacity を全区間サンプリングし一致を確認（不一致なら A2 slot方式へ）。
- travel-17影響: 見た目・タイミング同一（サンプリングで担保）。rollback: revert（CSSアニメ復活＝Step1断面）。

### Step 3 — map-data ビルドの地域汎用化
- `build-map-data.mjs` の地域テーブルを**地域定義（JSON/引数）で受ける**よう改修。地域追加手順（mapshaper clip＋定義）を明文化。
- 既存 japan/ryukyu/miyako は同一出力を再生成（バイト一致を確認）or 据置。ランタイム/engine変更なし。
- travel-17影響: なし（map-data再生成は同一）。rollback: スクリプトrevert・データは据置。

### Step 4 — 未登録stage / データ欠落の安全フォールバック強化
- 現行: 欠落stageはスキップ／map-data無→abstract降格。これを**明文化＋保証**（descentが全滅でも world/abstract で成立、最終的に**記事本文へ必ず到達**）。
- `validate` に地域データ不足の警告（Phase1 Step3で一部実装済）を拡充。
- travel-17影響: なし（正常系不変）。rollback: revert。

### Step 5 — 宮古島以外のサンプル地域で動作確認（未公開）
- サンプル地域（例: 八重山/石垣）の `stages` を Step3 ツールで生成し、サンプルconfigで降下を検証（ハーネス `_p2region.html`、未公開）。
- travel-17影響: なし（サンプルは別データ/別config）。rollback: サンプル削除。

### Step 6 — travel-17 完全不変の総回帰
- `seek()` で主要時刻の stage opacity / flight / ceremony / video 遷移を Phase2前後で比較し**同一**を確認。差分ゼロを最終報告。
- travel-17影響: なし（検証のみ）。rollback: 不要。

---

## 5. 後方互換・安全設計

- `route.descent` 未指定 → 既定3段（現行同一）。`stages` 未提供地域 → 該当stageスキップ／全滅時 abstract or world止まりでも**本文到達**。
- config `version` は 1 のまま（追加項目は任意）。engine API（`start/registerMap/validate/seek/current`）不変。
- 記事側HTML変更ゼロ（別地域記事も config だけで差し替え。地域データ/（A1採用時）CSS追加は不要）。

## 6. リスクと対応

| リスク | 対応 |
|---|---|
| JS駆動opacityが travel-17 と微差 | 解析サンプリングで一致検証。差が出れば bezier係数調整 or A2(slot)へ即切替 |
| 地域データ未整備の記事 | Step4のフォールバックで本文到達を保証。validateで事前警告 |
| リポ肥大（地域×データ） | 将来 R2/外部ホスト（`src`絶対URL対応は設計済）。当面は必要地域のみ生成 |

## 7. 未確定・要相談
1. 段送りアニメ方式: **A1(JS駆動) で進めてよいか**（A2 slotをフォールバックに保持）
2. サンプル地域は八重山/石垣でよいか（他候補あれば）
3. Step粒度: 上記6分割でよいか（結合/分割の希望）
