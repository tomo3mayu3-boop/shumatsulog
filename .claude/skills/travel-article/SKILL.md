---
name: travel-article
description: iPhoneから複数の写真＋一言メモだけで週末ログの記事を作成し、プレビュー→明示承認→公開まで進める共通スキル。4カテゴリ対応（travel/cooking/carwash/yurulog）。写真を添付して「旅行記事作成お願い」「travel記事にして」「この写真で記事」／「料理記事作成お願い」「cooking記事」／「洗車記事作成お願い」「carwash記事」／「ゆるログ記事作成お願い」「yurulog記事」等で起動。依頼文からカテゴリを判定し、build-images.jsで画像変換、あとはClaudeが最新のtravel記事を基本形にHTMLを直接書き、対象カテゴリの一覧・sitemap・(必要に応じ)トップを更新する。フォーム/JSON/generate層やAI-API連携は使わない。
---

# 週末ログ 記事アシスタント（iPhone完結・直接HTML方式 / 4カテゴリ共通）

複数の写真と一言メモを受け取り、記事を組み立てて公開まで進める。ユーザーの操作は「**写真を添付 → 一言メモ → プレビュー確認 → 承認**」だけ。**旅行・料理・洗車・ゆるログの4カテゴリを同じ共通フローで作る**（構成は既存の最新トラベル記事を基本形にし、差はカテゴリ別設定だけ）。

**方式**: 画像変換だけ `build-images.js`（`--base {category}` で `images/{category}/` に出力）を使い、**HTMLは Claude が「最新の travel 記事」を基本形にして直接書く**（構造・CSSクラス・メタの書き方をそこから写す。特定の記事に固定しない＝テンプレが進化したら自動追従）。中間JSON・`generate.js`・入力フォーム・AI-API連携などは**使わない**。修正は「この部分だけ直して」と依頼 → 該当HTMLを直接編集する。

> **起動互換**: 旧「旅行記事」用の起動方法（`/travel-article`・「旅行記事作成お願い」等）はそのまま travel カテゴリとして動作する。travel の構成・文章方針・出力は従来と変わらない。

## 大前提（毎回）
- **作業リポジトリは本番 `C:\homepage`**（= `shumatsulog` repo）。`C:\homepage_backup` では公開されない。cwd を確認する。
- **公開（commit・push）は必ずプレビュー提示 → 明示承認の後だけ。** 自動push しない。
- ブランチは **main 直コミット**。**force push 禁止**。
- 使うスクリプトは `build-images.js` のみ。それ以外は直接編集する。
- push 後、**Windows起動時の既存同期（`scripts/git-sync.ps1` / 約45〜60秒遅延・main限定・ff-only・作業ツリーがクリーンな時だけ・分岐時は停止）** が `origin/main` を `C:\homepage` に取り込み、記事HTMLと `images/{category}/{folder}/` も自動追加される。**この同期処理は変更しない。**
- **Labs は対象外。**

## 入力
- **写真**: チャット添付。渡された順を基本に、**採用写真と順番は内容から判断してよい**（1枚目がヒーロー＝`eager`/`preload`対象）。洗車で施工前後が分かる場合は Before→After の並びを活かす。
- **メモ**: 数行。カテゴリ・状況・場所/料理名・時間・気分の断片で可。ここから本文を書く。

---

## Step 0.5 — カテゴリ判定（最初に必ず）
依頼文からカテゴリを判定する：
- 「**旅行 / トラベル / travel**」→ `travel`
- 「**料理 / cooking**」→ `cooking`
- 「**洗車 / carwash**」→ `carwash`
- 「**ゆるログ / yurulog**」→ `yurulog`

**判定できない／曖昧な場合は勝手に決めず、ユーザーに確認する**（例：「どのカテゴリの記事にしますか？ 旅行/料理/洗車/ゆるログ」）。以降、確定したカテゴリの設定を下表から使う。

## カテゴリ別設定（共通フローに差し込む値）

| 項目 | travel | cooking | carwash | yurulog |
|---|---|---|---|---|
| slug | `travel-{id}` | `cooking-{id}` | `carwash-{id}` | `yurulog-{id}` |
| 画像 `--base` | `travel`（省略可＝既定） | `cooking` | `carwash` | `yurulog` |
| 画像URLベース | `images/travel/{folder}/` | `images/cooking/{folder}/` | `images/carwash/{folder}/` | `images/yurulog/{folder}/` |
| 一覧ページ | `travel.html` | `cooking.html` | `carwash.html` | `yurulog.html` |
| canonical/og:url | `https://shumatsulog.com/travel-{id}` | `…/cooking-{id}` | `…/carwash-{id}` | `…/yurulog-{id}` |
| `<title>` 接尾 | `… \| 週末ログ` | `… \| 週末ログ` | `… \| 週末ログ` | `… \| ゆるログ` |
| header `<h1>` | `✈️ 週末ログ` | `🍳 週末ログ` | `🚗 週末ログ` | `🗒️ 週末ログ` |
| ナビ/カテゴリ active | 旅行 / ✈️ 旅行 | 料理 / 🍳 料理 | 洗車 / 🚗 洗車 | ゆるログ / 🗒️ ゆるログ |
| パンくず名 / item | 旅行 / `…/travel` | 料理 / `…/cooking` | 洗車 / `…/carwash` | ゆるログ / `…/yurulog` |
| Hero下の一行 | `📍 {場所タグ}` | `🍳 料理` | `🚗 洗車` | `🗒️ ゆるログ` |
| サイドバー | 地図(場所)＋カテゴリ | SNS＋カテゴリ | SNS＋カテゴリ（道具/場所があれば任意で追加可） | SNS＋カテゴリ |
| 記事番号の決め方 | `tools/travel/next-id.json` ＋ `ls travel-*.html` の最大 の大きい方 | `ls cooking-*.html` の最大+1 | `ls carwash-*.html` の最大+1 | `ls yurulog-*.html` の最大+1 |
| トップ更新箇所 | `index.html` の `#travel` | `#cooking` | `#carwash` | `#yurulog` |

**記事番号はハードコードしない。** 各カテゴリの既存記事を調べ、最大+1を自動提案する（記事が無ければ 1）。

## カテゴリ固有の方針（本文の書き方）
- **travel（現行維持）**：観光紹介/レビューしない・見たものを書く・感想は最小限・短文・改行多め・余韻で終わる。サイドバーは地図（場所）。**現在の構成・文章方針をそのまま維持する。**
- **cooking**：**その日の料理と時間の記録**として書く。レシピ検索サイト的な一般解説にしない。**材料・工程・分量・調理時間を必須にしない／入力から断定できないものを推測補完・捏造しない。** 入力（写真＋メモ）から明確に分かるレシピ情報は自然に本文へ織り込んでよい。ユーザーが「レシピとして」と明示した場合のみ材料/工程を本文セクションに整理し、料理名・材料・工程が揃う場合のみ JSON-LD `Recipe` を追加（情報不足で架空Recipeを作らない）。
- **carwash**：洗車の記録。**Before/After 写真がある場合は本文の写真セクションで自然に活用**（施工前→施工後の並び。専用スライダー等の独自UIは使わない）。使った道具・場所はメモにあれば自然に触れる。
- **yurulog**：**内容に応じて短い記録**でよい（写真1枚でも可）。説明しすぎない・短文・余白・オチを付けない・余韻で終わる。

---

## 手順（共通。`{category}`/`{id}`/`{folder}`/`{base}`/`{listing}` は上表で解決）

### Step 0 — 準備
1. cwd が `C:\homepage` か確認。
2. `tools/travel/node_modules` が無ければ `cd tools/travel && npm install`（sharp）。※画像スクリプトは全カテゴリ共用。
3. 上表の方法で **記事番号 `{id}`** を決定（`slug = {category}-{id}`）。
4. **基本形の最新記事を読む**：`ls travel-*.html | sort -V | tail -1` の最大番号 = 直近公開のトラベル記事。これを基本形として構造・CSSクラス・メタの書き方を写す。加えて対象カテゴリの一覧 `{listing}`・`sitemap.xml`・`index.html` の該当セクションを読む。
   - travel 以外でサイドバーに地図を持たない版の型として、既存 `yurulog-*.html`（SNS＋カテゴリのサイドバー、`<picture>`本文）を参照してよい。

### Step 1 — 原本を取り込む
- 添付写真を `drafts/incoming/{category}-{id}/` に順序が安定する名前（`01`,`02`,…）で保存。
- `drafts/incoming/` は `.gitignore` 済み（GPS/EXIF付き原本を公開しないため）。**原本は絶対コミットしない。**

### Step 2 — 画像ビルド（唯一のスクリプト）
```bash
node tools/travel/build-images.js --base {base} --src drafts/incoming/{category}-{id} --folder {folder} --out-json drafts/{category}-{id}.build.json
```
- **travel は `--base` 省略可**（既定 travel）。他カテゴリは `--base cooking|carwash|yurulog` を必ず付ける。`--base` は4カテゴリのみ許可（不正値はエラー）。
- `{folder}` は内容が分かる短い英小文字（travel=場所, cooking=料理名, carwash=年月, yurulog=題材 等）。`--prefix` 省略で `{folder}-`。
- OGに使う横写真が1枚目でなければ `--og-index N`。
- 出力: `images/{base}/{folder}/` に AVIF/WebP 多サイズ＋`{prefix}og.jpg`、及び断片JSON（`imageFolder`/`imagePrefix`/`orientation`/`photos[]`(index,width,height,variants)/`ogImage`）。
- **この断片が画像の真実**。`srcset`/`width`/`height`/preload/og:image は必ずこの値を使い、URLベースは `images/{base}/{folder}/`。
- sharp既定でEXIF全除去 → GPS・撮影日時・機種名は残らない。HEICが弾かれたら「JPEG/PNGで再共有」を促す。
- 変換後、原本を残さなくてよければ `drafts/incoming/{category}-{id}/` を削除。

### Step 3 — HTMLを直接書く（＝執筆＋組版）
基本形（最新 `travel-{N}.html`）を下敷きに `{category}-{id}.html` を作成。**基本構成は全カテゴリ共通**、差は上表と固有方針だけ。

**共通レイアウト（この順序で固定）**
```
Hero（タイトル ／ 一文 ／ 上表「Hero下の一行」）
→ Section（画像＋短文）×（採用写真の数だけ）
→ 締め（写真なしの短い余韻）
→ {listing} へ戻るリンク
```

**✅ 確認項目**
1. **共通ナビ・ヘッダ・フッタ・サイドバー**を基本形と同等に。カテゴリ用に：header `<h1>` は上表。ナビは共通5項目で対象カテゴリを `aria-current="page"`（**料理ナビの解除状態を維持し `category disabled` へ戻さない**）。サイドバーは上表（travel=地図＋カテゴリ、他=SNS＋カテゴリ）。カテゴリボックスも対象を `aria-current="page"`。
2. **メタ**：`<title>={title} {上表接尾}`／`meta description`／OGP(`og:type=article`,`og:site_name=週末ログ`,`og:image=https://shumatsulog.com/images/{base}/{folder}/{prefix}og.jpg`,1200×630)／`og:url`・`canonical`=上表canonical（**拡張子なし**）／JSON-LD **Article**（image=og.jpg,url=canonical,datePublished=`{date}`）／JSON-LD **BreadcrumbList**（1 ホーム=`https://shumatsulog.com/`,2 上表パンくず,3 タイトル=canonical）／twitter一式（image=og.jpg）／footer シェアURL（text=`{title} {接尾}`,url=canonical,encodeURIComponent）。**サイト内リンクは `.html` 付き、canonical/og:url は拡張子なし**（既存規約）。`date`=`YYYY-MM-DD`（メモの日付。無ければ確認）。
3. **画像**：各写真の `<picture>` は avif/webp `<source srcset>`＋`<img class="viewer-photo" …>`。`sizes="(max-width: 640px) 100vw, (max-width: 1024px) 60vw, 780px"`。`srcset` は断片 `variants` から（フル幅=サフィックス無し、縮小=`-{v}`）、URLベース `images/{base}/{folder}/`。`width`/`height` は断片実寸。**1枚目だけ** `loading="eager" fetchpriority="high"` ＋ head `<link rel="preload" as="image">`（1枚目avif）、他は `lazy`。`alt` は写真内容を簡潔に（画像を見て記述）。記事コンテナのクラスは基本形に準拠（travel は `travel-article travel-article-landscape`。縦写真でも `-portrait` に変えない）。
4. **本文**：各 Section に短い段落（改行 `<br>`、段落 `<p>` 分割）。締めは写真なしの短い余韻。**上表「カテゴリ固有の方針」に従う**（travel=現行維持／cooking=料理と時間の記録・レシピ任意／carwash=Before/After自然活用／yurulog=短い記録可）。
5. **構造化データ（cooking のみ・条件付き）**：料理名・材料・工程が揃う or「レシピとして」指定時のみ JSON-LD `Recipe` を追加。情報不足で架空Recipeを作らない（その場合 Article のみ）。

### Step 4 — 一覧・sitemap・トップを更新
1. **一覧（`{listing}`）**：hero直後に新記事カードを **prepend**（`article-row`：代表画像 ＋ `post-date`(YYYY.MM.DD) ＋ `<h3>タイトル</h3>` ＋ 説明文 ＋ `<a href="{category}-{id}.html" class="btn">のぞく</a>`）。フォーマットは対象一覧の既存カードに合わせる（travel.html は `<picture>`、cooking/carwash/yurulog は `<img class="photo">` 系）。既存カードは触らない。cooking で空状態プレースホルダがあれば削除してよい（**COMING SOONへ戻さない**）。
2. **`sitemap.xml`**：上表canonicalを重複なく追加：
   ```xml
   <url>
     <loc>{canonical}</loc>
     <lastmod>{date}</lastmod>
     <priority>0.6</priority>
   </url>
   ```
3. **トップ（`index.html`）の該当セクション**（上表「トップ更新箇所」）：必要に応じ最新記事に更新（travelの「最近の旅行」運用と同じ）。代表画像は**横向きでトップ映えする写真**を選ぶ（先頭が縦なら別の横写真）。リンク/総則文は既存のまま。**フッター「最終更新：…」は自動更新ワークフローが更新するため手動編集しない。**
4. travel の記事番号は従来どおり `tools/travel/next-id.json` を `{id}+1` に更新してよい（他カテゴリは番号ファイルを持たず走査で決める）。

### Step 5 — プレビュー提示 → 承認
- ルートに置いた `{category}-{id}.html` をブラウザ確認（相対パスが正しく解決）。要点（タイトル/一文/本文/各alt/OGの元写真/canonical/日付/一覧文）を提示。
- **ここで止まる。** 明示承認を待つ。修正は「この部分だけ直して」に従いピンポイントEdit → 再プレビュー。承認 → Step 6。

### Step 6 — 公開（承認後だけ）
```bash
git add {category}-{id}.html {listing} sitemap.xml images/{base}/{folder} index.html   # travel は tools/travel/next-id.json も
git commit -m "feat({category}-{id}): {タイトル} を追加"
git push origin main
```
- `drafts/incoming/` と `drafts/*.build.json` はコミットしない。
- push 後 Cloudflare Pages が自動デプロイ。Windows起動時同期（既存）で `C:\homepage` に取り込まれる。

---

## 変更してよい範囲（安全制約）
- 追加/更新してよいのは：新規 `{category}-{id}.html`、対象一覧 `{listing}`(hero直後prependのみ)、`sitemap.xml`(新URL追加のみ)、`images/{base}/{folder}/`、`index.html`(**対象カテゴリのセクションのみ**更新)、travelのみ `tools/travel/next-id.json`。
- **触らない**：他カテゴリの記事・一覧、`style.css`、`script.js`、`tools/travel/*`（画像スクリプトは実行のみ）、Labs。`index.html` も対象セクション以外は触らない。**既存トラベル記事・表示、Windows起動時同期を壊さない。**
- 料理ナビ・料理一覧（`cooking.html`）の**解除済み状態を維持**（`category disabled`/COMING SOON へ戻さない）。
- 新規ページのJSは外部 `script.js` のみ（本番CSPで inline `<script>` は実行されない）。OGは JPG（`{prefix}og.jpg` 1200×630）。
- 修正依頼は指定箇所のみ編集。迷ったら公開前に止まって確認する。
