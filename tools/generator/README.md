# 多カテゴリ記事ジェネレーター（tools/generator/）

travel / yurulog / carwash / cooking の4カテゴリを、iPhoneフォーム →
カテゴリ別JSON → 検証 → staging HTML 生成 → 人間確認 → 本番反映 まで扱う。

**travel は既存の `tools/travel/` パイプラインを一切変更せず温存**している。
この層は travel をフォーム/next-id 用に「認識」するだけで、travel の
draft/ready JSON の生成・検証は従来の `tools/travel/validate*.js` に委譲する。
（＝既存 travel JSON はそのまま検証を通る）

## ファイル

| ファイル | 役割 |
|---|---|
| `category-config.js` | 全カテゴリの共通/固有項目・必須(draft/ready)・slug・画像フォルダ・一覧ページ等の単一の真実（UMD: Node+ブラウザ） |
| `validate-common.js` | カテゴリ横断の検証。travel は legacy validator へ委譲、他は config 駆動（UMD） |
| `next-id.js` | 既存 `{prefix}-{n}.html` を走査し「最大+1」を算出（ハードコードなし）。`--write` で `next-ids.json` を出力 |
| `next-ids.json` | フォームが記事番号の初期値に使う（自動生成物） |
| `renderers.js` | staging HTML / 一覧カード / sitemap 断片の生成（Node） |
| `generate.js` | ready JSON → `staging/{slug}.html` + `.card.html` + `.sitemap.xml`（衝突・上書き防止） |
| `apply.js` | staging → 本番反映（一覧カード prepend / sitemap 追記 / next-id 更新、重複スキップ、`--dry-run`/`--force`） |
| `test.js` | ライブラリ検証テスト |
| `fixtures/` | 各カテゴリの ready テスト JSON |

## 使い方

```bash
# 記事番号の再計算（HTMLを追加した後など）
node tools/generator/next-id.js --write

# staging を生成（ready JSON。travel 以外）
node tools/generator/generate.js drafts/cooking-1.json
node tools/generator/generate.js drafts/cooking-1.json --dry-run

# 人間が staging/cooking-1.html を確認 → 問題なければ本番反映
node tools/generator/apply.js drafts/cooking-1.json --dry-run
node tools/generator/apply.js drafts/cooking-1.json

# テスト
node tools/generator/test.js
```

travel はこれまでどおり `tools/travel/generate.js` / `tools/travel/apply.js` を使う。

## フォーム（iPhone）

`tools/travel/form/`（既存フォームを拡張）。最上部の「カテゴリ」で travel /
ゆるログ / 洗車 / 料理 を切替。travel 選択時の出力は**従来と完全同一**。
新カテゴリは config 駆動でフォームを動的描画し、`draft`/`ready` を選べる。

ローカル確認（リポジトリルートで静的サーバ）:
```bash
python -m http.server 4599
# http://localhost:4599/tools/travel/form/
```

## JSON 形式

- travel: 既存仕様のまま（`locationTag`/`heroSubtitle`/`build` 等）。
- yurulog / carwash / cooking: 共通項目はトップレベル、カテゴリ固有は
  `categoryData` 配下。画像は `images:[{index,alt,caption,...}]`。

```
drafts/travel-{id}.json    （既存仕様）
drafts/yurulog-{id}.json
drafts/carwash-{id}.json
drafts/cooking-{id}.json
```

## 文章方針（カテゴリ別設定）

`category-config.js` の `writingRules` に、ゆるログ／料理の文章方針を保持
（説明しすぎない・推測補完しない・記録優先）。Recipe構造化データは材料と工程が
**両方揃ったときだけ**生成し、不足時は Article として出力する。

## URL 方針（既存踏襲）

- canonical / og:url: 拡張子なし（例 `https://shumatsulog.com/cooking-1`）
- サイト内リンク: `.html` 付き（例 `cooking-1.html`）

## 安全設計

- 生成は `staging/` のみ。本番 HTML を直接上書きしない。
- `generate.js` は ルート `{slug}.html` があれば slug 衝突で中止。
- `apply.js` は既存一覧カード/sitemap URL があればスキップ（重複防止）。
- 既存ファイルの削除・移動・並び替えはしない。
