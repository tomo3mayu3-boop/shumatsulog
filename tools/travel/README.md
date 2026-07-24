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

## Sprint 2 以降

Sprint 2 では `drafts/` の JSON から HTML 記事を生成するビルドスクリプトを追加予定です。テンプレートは `tools/travel/templates/` に配置します。
