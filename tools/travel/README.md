# Travel Draft Tools (Sprint 1)

iPhone Safari 向けの旅行記事ドラフト入力ツールです。フォームから JSON を生成し、`drafts/` に保存する前段階のワークフローを提供します。

## ディレクトリ構成

```
tools/travel/
├── schema.json          # ドラフト JSON の JSON Schema
├── parse-body.js        # 本文パーサー（Node / ブラウザ両対応）
├── validate.js          # バリデーション（Node / ブラウザ両対応）
├── next-id.json         # 次に使う記事 ID
├── form/
│   ├── index.html       # 入力フォーム
│   ├── app.js           # フォームロジック
│   └── style.css        # フォーム専用スタイル
└── templates/           # Sprint 2 以降で使用

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

### Sprint 2b 以降

Sprint 2b では `render-*.js`（head / picture / sections / sidebar）を追加し、Sprint 2c で `generate.js` CLI 統合を行います。
