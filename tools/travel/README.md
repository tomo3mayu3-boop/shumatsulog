# Travel Draft Tools

iPhone から写真＋一言メモで旅行記事を作成・公開するためのツール群です。

## Phase 1 — iPhone完結ワークフロー（現行・直接HTML方式）

**目標体験**: iPhoneで「写真を添付 → 一言メモ → プレビュー確認 → 承認」だけで記事を公開する。画像変換・執筆・組版・反映は Claude が実行する。

```
写真＋メモ ──▶ build-images.js ──▶ Claudeが既存記事を型にHTML直接作成 ──▶ 一覧/sitemap/next-id更新 ──▶ プレビュー ──▶〔承認〕──▶ push
   (添付)      images/travel/+断片      travel-{id}.html                      travel.html / sitemap.xml       (必須)
```

- 入口は **Claude Code スキル `travel-article`**（`.claude/skills/travel-article/SKILL.md`）。写真を添付して「旅行記事にして」で起動し、上記を一括実行する。
- **画像変換だけ `build-images.js` を使い、HTMLは Claude が `travel-16.html` 等を型にして直接書く**。中間JSON・`generate.js`・`validate-ready` などの層は**使わない**（ファイルは下記「Sprint履歴」として残置。使わないだけ）。
- **修正は「この部分だけ直して」と依頼** → Claude が該当HTMLを直接編集（指定箇所以外は触らない）。JSON編集・再生成はしない。
- 公開は **必ずプレビュー後の明示承認** を挟む（自動push しない）。本番は `C:\homepage`（shumatsulog repo）、main 直コミット。

### build-images.js（画像パイプライン / Node + sharp）

原本フォルダから各写真の AVIF/WebP 多サイズ＋OG(JPG 1200×630) を生成し、`build` 断片JSON（`imageFolder`/`imagePrefix`/`orientation`/`photos[]`/`ogImage`）を出力する。**sharp が既定でEXIFを全除去**するため、出力にGPS・撮影日時・機種名は残らない。

```bash
cd tools/travel && npm install          # 初回のみ（sharp）
node tools/travel/build-images.js --src drafts/incoming/travel-17 --folder sui --out-json drafts/travel-17.build.json
```

| オプション | 既定 | 説明 |
|-----------|------|------|
| `--src <dir>` | (必須) | 原本フォルダ。ファイル名順（自然順）に index 1.. を割当 |
| `--folder <name>` | (必須) | `images/travel/{name}/` の出力先 |
| `--prefix <p>` | `{folder}-` | 生成ファイル名の接頭辞 |
| `--variants a,b` | `400,800` | 縮小幅（フル幅未満のみ採用）。フル幅は常に付与 |
| `--og-index N` | `1` | OGに使う写真番号（横写真を選ぶ用） |
| `--max-full N` | `1600` | フル幅の上限（超える原本は縮小） |
| `--dry-run` / `--force` | off | 書かずに計画表示 / 既存上書き |

- **画像原本 `drafts/incoming/` は `.gitignore` 済み**（GPS付き原本を公開しないため）。コミットしない。
- OGは JPG のみ（WebPのOGはXで表示されないため）。

---

## Sprint 1 履歴（フォーム版・非推奨）

> **Note:** 下記の入力フォーム（`form/`）と draft スキーマ（`schema.json`/`validate.js` の draft用途）は Sprint 1 の実装。Phase 1 では **フォーム入力は Claude の組み立てに置き換え**、通常は使わない（履歴として保持）。`validate.js` は `validate-ready.js` が内部再利用するため残す。

iPhone Safari 向けの旅行記事ドラフト入力ツールです。フォームから JSON を生成し、`drafts/` に保存する前段階のワークフローを提供します。

## ディレクトリ構成

```
tools/travel/
├── schema.json          # ドラフト JSON の JSON Schema
├── parse-body.js        # 本文パーサー（Node / ブラウザ両対応）
├── validate.js          # バリデーション（Node / ブラウザ両対応）
├── validate-ready.js    # ready 専用バリデーション（Sprint 2a）
├── generate.js          # ready JSON → staging HTML（Sprint 2c）
├── apply.js             # staging → 本番反映（Sprint 3b）
├── render-listing.js    # travel.html 一覧セクション生成（Sprint 3b）
├── next-id.json         # 次に使う記事 ID
├── fixtures/
│   └── mock-travel-16.json  # E2E 確認用 ready JSON フィクスチャ
├── form/
│   ├── index.html       # 入力フォーム
│   ├── app.js           # フォームロジック
│   └── style.css        # フォーム専用スタイル
└── templates/
    └── article.html     # travel-15 ベースの HTML 骨格

drafts/                  # 生成した JSON の保存先（手動）
staging/                 # ビルド前のステージング（Sprint 2 以降）
```

## フォームの起動方法

リポジトリルート（`homepage/`）で静的サーバーを起動します。

```bash
npx serve .
```

ブラウザで以下を開きます。

```
http://localhost:3000/tools/travel/form/
```

> **Note:** `file://` で直接開いた場合、`next-id.json` の fetch は CORS 制限で失敗します。その場合は ID のデフォルト値 `16` が使われます。通常は `npx serve` 経由で利用してください。

## JSON の保存手順

1. フォームに記事内容を入力する
2. 画面下部の **JSON を保存** をタップ
3. バリデーション通過後、`travel-{id}.json` がダウンロードされる
4. ダウンロードしたファイルを `drafts/` フォルダに移動する

## 出力 JSON 構造

```json
{
  "schemaVersion": 1,
  "status": "draft",
  "category": "travel",
  "id": 16,
  "slug": "travel-16",
  "title": "...",
  "date": "2026-07-13",
  "locationTag": "...",
  "heroSubtitle": "...",
  "listingDescription": "...",
  "body": {
    "raw": "...",
    "sections": [
      { "type": "photo", "paragraphs": ["..."] },
      { "type": "text", "paragraphs": ["..."] }
    ]
  },
  "build": null,
  "meta": {
    "createdAt": "2026-07-24T08:00:00.000Z",
    "updatedAt": "2026-07-24T08:00:00.000Z",
    "source": "iphone-form-v1"
  }
}
```

## 本文パーサー（parse-body.js）

| ルール | 説明 |
|--------|------|
| セクション区切り | 行全体が `---` |
| 段落 | セクション内で空行区切り |
| 空セクション | 除外 |
| セクション種別 | 最終セクションのみ `text`、それ以外 `photo` |
| 1セクションのみ | 種別は `photo` |
| `<br>` | そのまま保持 |

### Node での簡易テスト

```bash
node -e "
const { parseBody } = require('./tools/travel/parse-body');
const raw = 'Photo one line\\n\\nSecond para with <br> break\\n\\n---\\n\\nClosing text\\n\\nFinal para';
const result = parseBody(raw);
console.log(JSON.stringify(result, null, 2));
"
```

期待結果: 2 セクション（1 つ目 `photo`、2 つ目 `text`）、`raw` は入力そのまま。

## バリデーション（validate.js）

### 必須チェック（errors）

- `id`: 1 以上の整数
- `title`: 1〜80 文字
- `date`: `YYYY-MM-DD`（実在する日付）
- `locationTag`: 非空
- `heroSubtitle`: 1〜200 文字
- `body`: 非空
- `listingDescription`: 1〜300 文字

### 警告（warnings）

- `id <= 15`: 既存記事との重複リスク
- 空のセクション（段落なし）

## Sprint 2a — テンプレートと ready JSON 基盤

Sprint 1 の draft JSON に PC 側で `build` ブロックを追記し、`status: "ready"` にした JSON を HTML 生成の入力とします。Sprint 2a ではその骨格（テンプレート・スキーマ・検証・エスケープ）を追加しました。

### 追加ファイル

```
tools/travel/
├── schema-ready.json      # ready 状態 JSON の JSON Schema
├── validate-ready.js      # ready 専用バリデーション
├── escape.js              # HTML / 属性エスケープ
└── templates/
    └── article.html       # travel-15 ベースの HTML 骨格
```

### schema-ready.json

Sprint 1 の `schema.json` と同じベースフィールドに加え、`status` は `"ready"`、`build` は **必須オブジェクト** です。

`build` ブロックの主要フィールド:

| フィールド | 説明 |
|-----------|------|
| `orientation` | `"landscape"` または `"portrait"` |
| `imageFolder` | `images/travel/` 以下のフォルダ名 |
| `imagePrefix` | ファイル名プレフィックス（例: `sui-`） |
| `photos[]` | 各写真の `index`, `alt`, `width`, `height`, `variants` |
| `ogImage` | OGP 用 JPG（`filename`, `width: 1200`, `height: 630`） |
| `sidebar.places[]` | サイドバー地図（`label`, `detail`, `mapQuery`, `zoom`, `iframeHeight`） |
| `seo.description` | `<meta description>` 用テキスト |

### validate-ready.js

`validate.js` の `validateDraft` を再利用し、ready 状態専用の追加チェックを行います。

| チェック | 内容 |
|----------|------|
| status | `"ready"` のみ許可（`draft` / `build: null` は拒否） |
| build | null / undefined を拒否、build 各フィールドを検証 |
| slug | `travel-{id}` 形式と id の一致 |
| photo 数 | `countPhotoSections(body)` === `build.photos.length` |

#### Node での簡易テスト

```bash
# draft / build:null は拒否される
node -e "const v=require('./tools/travel/validate-ready'); console.log(v.validateReady({status:'draft',build:null}));"

# photo セクション数と build.photos 数の不一致
node -e "
const { validateReady } = require('./tools/travel/validate-ready');
const mock = {
  schemaVersion: 1,
  status: 'ready',
  category: 'travel',
  id: 16,
  slug: 'travel-16',
  title: 'テスト記事',
  date: '2026-07-13',
  locationTag: '沖縄県宮古島市',
  heroSubtitle: '副題',
  listingDescription: '一覧説明',
  body: {
    raw: 'photo\\n\\n---\\n\\ntext',
    sections: [
      { type: 'photo', paragraphs: ['写真'] },
      { type: 'text', paragraphs: ['締め'] }
    ]
  },
  build: {
    orientation: 'landscape',
    imageFolder: 'test',
    imagePrefix: 'test-',
    seo: { description: 'SEO説明文' },
    photos: [
      { index: 1, alt: 'a', width: 100, height: 100, variants: [400] },
      { index: 2, alt: 'b', width: 100, height: 100, variants: [400] }
    ],
    ogImage: { filename: 'test-og.jpg', width: 1200, height: 630 },
    sidebar: {
      places: [
        { label: '場所', detail: '詳細', mapQuery: 'query', zoom: 14, iframeHeight: 220 }
      ]
    }
  },
  meta: {
    createdAt: '2026-07-24T08:00:00.000Z',
    updatedAt: '2026-07-24T08:00:00.000Z',
    source: 'iphone-form-v1'
  }
};
console.log(validateReady(mock));
"
```

期待結果: 1 件目は `valid: false`、2 件目は photo 数不一致エラー。

### article.html プレースホルダ

| プレースホルダ | 用途 |
|----------------|------|
| `{{TITLE_FULL}}` | `<title>` / og:title（タイトル + ` \| 週末ログ`） |
| `{{DESCRIPTION}}` | meta description / og:description |
| `{{OG_IMAGE_URL}}` | og:image / twitter:image |
| `{{OG_IMAGE_WIDTH}}` / `{{OG_IMAGE_HEIGHT}}` | og:image サイズ |
| `{{CANONICAL_URL}}` | canonical / og:url |
| `{{PRELOAD_LINK}}` | 1 枚目 `<link rel="preload">` 全文 |
| `{{JSON_LD_ARTICLE}}` | Article JSON-LD（1 行） |
| `{{JSON_LD_BREADCRUMB}}` | BreadcrumbList JSON-LD（1 行） |
| `{{ARTICLE_CLASS}}` | `travel-article travel-article-landscape` 等 |
| `{{HERO_H2}}` / `{{HERO_SUBTITLE}}` / `{{LOCATION_TAG}}` | ヒーロー |
| `{{BODY_SECTIONS}}` | 本文 `<section>` 群（Sprint 2b で生成） |
| `{{SIDEBAR_PLACES}}` | サイドバー地図ボックス（Sprint 2b で生成） |
| `{{SHARE_TEXT_ENCODED}}` / `{{SHARE_URL_ENCODED}}` | X シェア URL 用 |

固定部分: header, nav, footer, `script.js`, back-to-top, サイドバーのカテゴリボックス、戻るリンク section。

### escape.js

Sprint 2b のレンダラーで alt テキストや属性値を安全に出力するためのユーティリティです。`&`, `<`, `>`, `"`, `'` をエスケープします。

```bash
node -e "const {escapeHtml}=require('./tools/travel/escape'); console.log(escapeHtml('<test>'));"
# 期待: &lt;test&gt;
```

ブラウザでは `TravelEscape.escapeHtml` / `TravelEscape.escapeAttr` として利用できます。

## Sprint 2b — HTML レンダラー

Sprint 2a のプレースホルダを埋めるレンダラーモジュールです。

```
tools/travel/
├── render-head.js       # head / hero プレースホルダ
├── render-picture.js    # <picture> ブロック
├── render-sections.js   # 本文セクション
└── render-sidebar.js    # サイドバー地図
```

## Sprint 2c — generate.js CLI

ready JSON から HTML を生成し、`staging/` に出力します（リポジトリルートの既存 `travel-*.html` は上書きしません）。

### 使い方

```bash
# staging/travel-{id}.html を生成
node tools/travel/generate.js tools/travel/fixtures/mock-travel-16.json

# 検証のみ（HTML を stdout に出力、ファイルは書かない）
node tools/travel/generate.js tools/travel/fixtures/mock-travel-16.json --dry-run

# 出力先を指定（デフォルト: staging/）
node tools/travel/generate.js drafts/travel-16.json --out staging/
```

### 処理フロー

1. JSON を読み込み、`validateReady()` で検証（失敗時は stderr にエラー、exit 1）
2. `{repoRoot}/travel-{id}.html` が既にあれば slug 衝突で中止
3. `staging/travel-{id}.html` が既にあれば中止（Sprint 2c では上書き不可）
4. `templates/article.html` を読み込み、レンダラーでプレースホルダを置換
5. 未置換の `{{PLACEHOLDER}}` を検出（Sprint 3a、残存時は stderr にトークン一覧、exit 1）
6. `staging/travel-{id}.html` に書き出し（`--dry-run` 時は stdout のみ）

> **Note:** ステップ 5 はファイル書き込み**前**および `--dry-run` の stdout 出力**前**に実行されます。

### 生成物

| 出力 | 説明 |
|------|------|
| `staging/travel-{id}.html` | ステージング用 HTML（本番反映前の確認用） |

> **Note:** Sprint 2c では `staging/` への出力のみです。本番ルートへのコピーは別スプリントで行います。

## Sprint 3a — プレースホルダ自動検証

Sprint 2c の `generate.js` に、未置換プレースホルダの自動検出を追加しました。

### 動作

- レンダリング後の HTML を `findRemainingPlaceholders()` で走査し、`{{TITLE_FULL}}` 等の `{{UPPER_SNAKE}}` 形式トークンを検出
- 1 件でも残存していれば **exit 1** で中止。stderr に `Error: unreplaced placeholders remain: {{TOKEN1}}, {{TOKEN2}}, ...` と一覧表示
- 検査は **ファイル書き込み前** および **`--dry-run` の stdout 出力前** の両方で実行（不完全な HTML が staging や stdout に出ない）

### Sprint 2c との関係

| 機能 | スプリント |
|------|-----------|
| ready JSON → staging HTML 生成 | Sprint 2c |
| レンダラー統合（head / sections / sidebar） | Sprint 2c |
| `--dry-run`（stdout のみ、ファイル書かない） | Sprint 2c |
| slug 衝突チェック（ルート `travel-{id}.html`） | Sprint 2c |
| staging 上書き不可 | Sprint 2c |
| 未置換プレースホルダ自動検出（exit 1） | **Sprint 3a** |

手動の `Select-String` による残存チェック（Sprint 2d）は引き続き任意の追加確認として利用できます。

## Sprint 3b — apply.js（本番反映）

ready JSON と `staging/travel-{id}.html` から、記事をサイトに反映します。

### 使い方

```bash
# 本番反映（staging → ルート、travel.html / sitemap.xml / next-id.json 更新）
node tools/travel/apply.js tools/travel/fixtures/mock-travel-16.json

# 計画のみ表示（ファイルは書かない）
node tools/travel/apply.js tools/travel/fixtures/mock-travel-16.json --dry-run

# 既存ファイルがある場合の上書き
node tools/travel/apply.js tools/travel/fixtures/mock-travel-16.json --force
```

### 前提

1. `validateReady()` を通過する ready JSON
2. `staging/travel-{id}.html` が存在（`generate.js` で事前生成）

```bash
# staging が無い場合は先に生成
node tools/travel/generate.js tools/travel/fixtures/mock-travel-16.json
```

### 処理フロー

1. ready JSON を読み込み、`validateReady()` で検証（失敗時 exit 1）
2. `staging/travel-{id}.html` の存在確認（無ければ中止）
3. ルート `travel-{id}.html` が既にあれば中止（`--force` で上書き可）
4. `--dry-run`: 予定アクションを表示して終了
5. `staging/travel-{id}.html` → ルート `travel-{id}.html` にコピー
6. `travel.html`: ヒーロー直後（最初の `</section>` の後）に一覧 `<section>` を挿入。`href="travel-{id}.html"` が既にあれば中止（`--force` でスキップして続行）
7. `sitemap.xml`: `travel-15` エントリの直後に URL を追加（`lastmod=data.date`, `priority=0.6`）。既にあればスキップ
8. `next-id.json`: `id >= nextId` なら `nextId` を `id + 1` に更新
9. 成功サマリを表示

### 安全制約

| 対象 | 動作 |
|------|------|
| `travel-1.html` 〜 `travel-15.html` | **変更しない**（新規 `travel-{id}.html` の追加のみ） |
| `travel.html` | 既存記事セクションはそのまま、新記事を先頭に **prepend** |
| `index.html` / `style.css` / `script.js` | **変更しない** |
| `sitemap.xml` | 新 URL エントリの追加のみ |

### dry-run / --force

| オプション | 用途 |
|-----------|------|
| `--dry-run` | コピー・更新の予定を表示。ファイルは一切書かない |
| `--force` | ルート HTML の上書きを許可。一覧・サイトマップが既にあればスキップして続行 |

### E2E 確認（mock-travel-16）

```powershell
# 1. staging 生成（再実行時は staging を削除してから）
Remove-Item staging/travel-16.html -ErrorAction SilentlyContinue
node tools/travel/generate.js tools/travel/fixtures/mock-travel-16.json

# 2. dry-run
node tools/travel/apply.js tools/travel/fixtures/mock-travel-16.json --dry-run

# 3. 本番反映
node tools/travel/apply.js tools/travel/fixtures/mock-travel-16.json
```

期待結果:

- `travel-16.html` がリポジトリルートに作成される
- `travel.html` の先頭記事が `travel-16.html` へのリンクになる
- `sitemap.xml` に `https://shumatsulog.com/travel-16` エントリが追加される
- `next-id.json` の `nextId` が `17` になる

### コミット前チェックリスト

- [ ] `travel-1.html` 〜 `travel-15.html` に diff がない
- [ ] `index.html` / `style.css` / `script.js` に diff がない
- [ ] `travel.html` は新記事セクションの prepend のみ
- [ ] `sitemap.xml` は travel-16 エントリ追加のみ
- [ ] ルート `travel-16.html` が意図どおり（mock 適用時）
- [ ] `--dry-run` で計画が期待どおり

## Sprint 2d — E2E 確認

Sprint 2c の `generate.js` パイプラインを、フィクスチャ JSON から end-to-end で検証する手順です。出力は `staging/` のみで、本番ファイル（`travel-*.html` ルート、`travel.html`、`sitemap.xml` 等）は触りません。

### 1. E2E 生成手順

#### フロー概要

```
mock-travel-16.json  →  validateReady  →  generate.js  →  staging/travel-16.html
```

| 段階 | 内容 |
|------|------|
| 入力 | `tools/travel/fixtures/mock-travel-16.json`（`status: "ready"`、`build` 付き） |
| 検証 | `validateReady()` で ready JSON を検証 |
| 生成 | `generate.js` がテンプレート + レンダラーで HTML を組み立て |
| 出力 | `staging/travel-16.html` |

#### コマンド（リポジトリルート `homepage/` で実行）

**Step 1 — validateReady 確認**

```powershell
node -e "const v=require('./tools/travel/validate-ready'); const d=require('./tools/travel/fixtures/mock-travel-16.json'); console.log(JSON.stringify(v.validateReady(d), null, 2));"
```

期待結果: `{ "valid": true, "errors": [], "warnings": [] }`

**Step 2 — 既存 staging ファイルを削除（再生成時は必須）**

Sprint 2c では `staging/travel-{id}.html` の**上書き不可**です。`--dry-run` も同じ存在チェックを通るため、再実行前に削除が必要です。

```powershell
Remove-Item staging/travel-16.html -ErrorAction SilentlyContinue
```

**Step 3 — HTML 生成**

```powershell
node tools/travel/generate.js tools/travel/fixtures/mock-travel-16.json
```

期待結果: `Generated: ...\staging\travel-16.html`

**Step 4 — プレースホルダ残存チェック**

Sprint 3a 以降、`generate.js` が書き込み前に未置換 `{{...}}` を自動検出します。Step 3 が exit 0 で完了していれば、プレースホルダ残存はないことが保証されます。

任意の追加確認（手動）:

```powershell
Select-String -Path staging/travel-16.html -Pattern '\{\{'
```

期待結果: マッチなし（出力なし）

#### dry-run の使い方

HTML をファイルに書かず stdout に出力して検証のみ行います。**Step 2 の削除を先に行うこと**（staging に同名ファイルがあると dry-run も中止されます）。

```powershell
Remove-Item staging/travel-16.html -ErrorAction SilentlyContinue
node tools/travel/generate.js tools/travel/fixtures/mock-travel-16.json --dry-run 2>$null | Select-Object -First 20
```

stderr に `Dry run OK: would write to ...\staging\travel-16.html` が出れば成功。stdout には完全な HTML が出力されます。

#### 本番ワークフロー参照（draft → ready → generate）

E2E フィクスチャの代わりに、実際の記事を生成する場合の流れです（Sprint 2d では実行不要、Sprint 3 以降の参考）。

1. iPhone フォーム（`tools/travel/form/`）で draft JSON を `drafts/travel-{id}.json` に保存
2. PC 側で `build` ブロック（画像メタ・サイドバー・SEO 等）を追記し、`status: "ready"` に変更
3. `validateReady()` で検証
4. `node tools/travel/generate.js drafts/travel-{id}.json` で `staging/travel-{id}.html` を生成

### 2. 検証手順（mock → generate → staging → confirm）

#### 主要手段: HTML ソース diff

生成物 `staging/travel-16.html` を、手書きの参照記事 `travel-15.html` とソース diff します。同一記事（イラフ SUI 122号室）をベースにしているため、**slug 参照（`travel-15` ↔ `travel-16`）以外の構造差分**が主な確認ポイントです。

```powershell
# slug 差分を除いたざっくり比較（PowerShell）
Compare-Object (Get-Content travel-15.html) (Get-Content staging/travel-16.html) |
  Where-Object { $_.InputObject -notmatch 'travel-15|travel-16' }
```

エディタの diff 機能（VS Code: 右クリック → 「選択項目と比較」）でも可。

#### ブラウザプレビューの制約

`npx serve .` で `http://localhost:3000/staging/travel-16.html` を開くと、**CSS / JS / 画像が壊れます**。

| リソース | HTML 内のパス | staging から見た実際の解決先 | 結果 |
|----------|---------------|------------------------------|------|
| CSS | `style.css` | `/staging/style.css` | 404 |
| JS | `script.js` | `/staging/script.js` | 404 |
| 画像 | `images/travel/sui/...` | `/staging/images/travel/sui/...` | 404 |

パスはリポジトリルート基準で書かれているため、`/staging/` 配下では相対パスが 1 段ずれます。

#### 回避策

| 方法 | 用途 | 注意 |
|------|------|------|
| **ソース diff（推奨）** | 構造・メタ・マークアップの正しさ | 上記 Compare-Object またはエディタ diff |
| **一時的なルートコピー（ビジュアル確認のみ）** | レイアウト・CSS の目視確認 | `Copy-Item staging/travel-16.html travel-16.html` → 確認後 **必ず削除**。コミット禁止 |
| **travel-15 をレイアウト参照** | picture / section / sidebar の並び | 同一テンプレート系なので構造比較に有効 |

一時コピー例（確認後削除）:

```powershell
Copy-Item staging/travel-16.html travel-16.html
# npx serve . → http://localhost:3000/travel-16.html で確認
Remove-Item travel-16.html   # 確認後すぐ削除、コミットしない
```

#### 構造チェックリスト

`staging/travel-16.html` を diff または目視で確認:

- [ ] **head**: `<title>`, `meta description`, OGP（`og:title`, `og:description`, `og:image`, `og:url`）, canonical, JSON-LD（Article + BreadcrumbList）が埋まっている
- [ ] **preload**: 1 枚目 `<link rel="preload" as="image">` が avif srcset 付きで出力されている
- [ ] **hero**: `h2` タイトル、副題、`<p class="travel-location">` の locationTag
- [ ] **picture**: photo セクション数（6）分の `<picture>` ブロック。avif / webp `<source>` + `<img>` の srcset / sizes / width / height / alt / loading（1 枚目 `eager`、以降 `lazy`）
- [ ] **sections**: 最終 text セクションは `<picture>` なし。`<br>` が段落内に保持されている
- [ ] **sidebar**: 地図 iframe（`mapQuery`, `zoom`, `iframeHeight`）+ カテゴリボックス
- [ ] **footer**: 著作権、SNS リンク、X シェア URL（`travel-16` を指す）
- [ ] **固定部分**: header / nav / back-to-top / `script.js` 参照

#### 画像がローカルにない場合（`images/travel/sui/` 未配置）

mock-travel-16 の `build.imageFolder` は `sui` ですが、リポジトリに `images/travel/sui/` が無くても **HTML 構造の検証は可能**です。

| 手段 | 確認内容 |
|------|----------|
| **ソース diff** | `<picture>` / `<img>` の `src` / `srcset` パスが `images/travel/sui/sui-{n}...` 形式か |
| **dry-run stdout** | 生成 HTML をファイル不要で inspect |
| **Network 404（一時ルートコピー時）** | DevTools → Network で画像 URL が意図したパスを叩いているか（404 は想定内） |
| **validateReady** | `build.photos[]` の index / variants と body photo セクション数の一致 |

#### プレースホルダ残存の確認

Sprint 3a 以降は `generate.js` が自動検出（残存時 exit 1）。手動確認は任意:

```powershell
Select-String -Path staging/travel-16.html -Pattern '\{\{'
```

`{{TITLE_FULL}}` 等が 1 件も残っていないこと。`generate.js` が exit 0 なら通常は不要。残存があればレンダラーまたはテンプレート置換の不具合。

### 3. Sprint 3 引き継ぎ

#### Sprint 2 で完了すること

| 領域 | 完了内容 |
|------|----------|
| 入力 | iPhone フォーム → draft JSON |
| スキーマ | `schema.json` / `schema-ready.json` |
| 検証 | `validate.js` / `validateReady.js` |
| レンダリング | `render-head.js`, `render-picture.js`, `render-sections.js`, `render-sidebar.js` |
| 生成 CLI | `generate.js` → `staging/travel-{id}.html` |
| E2E 確認 | フィクスチャ mock → staging 生成・検証手順（本 README） |

#### Sprint 3 のスコープ（Sprint 2 では行わない）

| 項目 | 内容 |
|------|------|
| 本番反映 | `staging/travel-{id}.html` → リポジトリルート `travel-{id}.html` |
| 一覧更新 | `travel.html` に新記事リンク追加 |
| サイトマップ | `sitemap.xml` に URL 追加 |
| 画像パイプライン | 原本 → AVIF/WebP 変換、`images/travel/{folder}/` 配置 |
| `--force` | staging / ルート上書きオプション（Sprint 2c では未実装） |
| `next-id.json` 更新 | 記事公開後に ID を進める |
| デプロイ | GitHub Pages 等への反映 |

#### Sprint 3 に渡す成果物

| 成果物 | パス |
|--------|------|
| ready JSON フィクスチャ | `tools/travel/fixtures/mock-travel-16.json` |
| HTML テンプレート | `tools/travel/templates/article.html` |
| レンダラーモジュール | `tools/travel/render-*.js` |
| 生成 CLI | `tools/travel/generate.js` |
| ステージング HTML | `staging/travel-16.html`（E2E 生成物） |
| 検証手順 | 本 README Sprint 2d セクション |
| draft JSON（実記事分） | `drafts/travel-{id}.json`（フォーム出力、手動配置） |

### 4. Sprint 2 完了チェックリスト

レビュアー向け。すべてにチェックが付いたら Sprint 2 完了、Sprint 3 に進めます。

#### パイプライン

- [ ] `validateReady(mock-travel-16.json)` が `valid: true` を返す
- [ ] `generate.js` が `staging/travel-16.html` を生成する
- [ ] 再生成前に staging ファイル削除が必要（no-overwrite）であることを理解している
- [ ] `--dry-run` が HTML を stdout に出力し、ファイルを書かない
- [ ] 出力 HTML に `{{...}}` プレースホルダが残っていない

#### 構造品質

- [ ] `staging/travel-16.html` と `travel-15.html` の diff で head / picture / sections / sidebar / footer 構造が一致
- [ ] slug 参照（canonical, og:url, JSON-LD, シェア URL）が `travel-16` を指す
- [ ] photo セクション 6 + text セクション 1 の構成
- [ ] `<picture>` の avif / webp variants が `build.photos[].variants` と一致

#### 安全制約

- [ ] 生成物は `staging/` のみ（ルート `travel-*.html` 未作成）
- [ ] `travel.html` / `index.html` / `sitemap.xml` / `style.css` / `script.js` 未変更
- [ ] 一時ルートコピーは確認後削除済み（コミットしていない）

#### ドキュメント

- [ ] 本 README に Sprint 2d E2E 手順が記載されている
- [ ] ディレクトリ構成に `generate.js` と `fixtures/mock-travel-16.json` が記載されている
- [ ] Sprint 3 引き継ぎ範囲が明確

#### 既知の制限（受け入れ済み）

- [ ] Sprint 2c/2d では staging 上書き不可（Sprint 3 で `--force` 検討）
- [ ] `/staging/` URL では CSS/JS/画像が壊れる（ソース diff が主要検証手段）
- [ ] 画像ファイル自体の生成・配置は Sprint 3（構造のみ Sprint 2 で確認）
- [ ] 本番反映・一覧・サイトマップ更新は Sprint 3
