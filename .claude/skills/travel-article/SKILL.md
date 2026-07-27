---
name: travel-article
description: iPhoneから写真＋一言メモだけで旅行記事(travel-N)を作成し、プレビュー→明示承認→公開まで進める。写真を添付して「旅行記事にして」「travel記事つくって」「この写真で記事」等で起動。build-images.jsで画像変換し、あとはClaudeが既存記事を型にHTMLを直接書き、一覧・sitemap・next-idを更新する。JSON/generate層は使わない。
---

# 旅行記事アシスタント（週末ログ / iPhone完結・直接HTML方式）

写真と一言メモを受け取り、記事を組み立てて公開まで進める。ユーザーの操作は「**写真を添付 → 一言メモ → プレビュー確認 → 承認**」だけ。

**方式**: 画像変換だけ `build-images.js` を使い、**HTMLは Claude が「最新の travel 記事」を型にして直接書く**（構造・CSSクラス・メタの書き方をそこから写す。特定の記事に固定しない＝テンプレが進化したら自動で追従する）。中間JSON・`generate.js`・`validate-ready` などは**使わない**（ファイルは残置。使わないだけ）。修正は「この部分だけ直して」と依頼 → Claude が該当HTMLを直接編集する。

## 大前提（毎回）
- **作業リポジトリは本番 `C:\homepage`**（= `shumatsulog` repo）。`C:\homepage_backup` では公開されない。cwd を確認する。
- **公開（commit・push）は必ずプレビュー提示 → 明示承認の後だけ。** 自動push しない。
- ブランチは **main 直コミット**（feature/PR 使わない）。**force push 禁止**。
- 使うスクリプトは `build-images.js` のみ。それ以外はファイルを直接編集する。

## 入力
- **写真**: チャット添付。渡された順が記事順（1枚目がヒーロー＝`eager`/`preload`対象）。
- **メモ**: 数行。場所・状況・撮ったもの・気分の断片で可。ここから本文を書く。

---

## 手順

### Step 0 — 準備
1. cwd が `C:\homepage` か確認。
2. `tools/travel/node_modules` が無ければ `cd tools/travel && npm install`（sharp）。
3. `tools/travel/next-id.json` を読み `id` を決定（`slug = travel-{id}`）。
4. **型にする最新記事を特定して読む**：`ls travel-*.html` の**最大番号**（例 `ls travel-*.html | sort -V | tail -1`）が直近公開記事。これを「型記事」として構造・CSSクラス・メタの書き方を写す。加えて `travel.html`（一覧フォーマット）と `sitemap.xml` も読む。以降このスキル内の `travel-16.html` はすべて**この型記事に読み替える**（例示にすぎない）。

### Step 1 — 原本を取り込む
- 添付写真を `drafts/incoming/travel-{id}/` に順序が安定する名前（`01`,`02`,…）で保存。
- このフォルダは `.gitignore` 済み（GPS/EXIF付き原本を公開しないため）。**原本は絶対コミットしない。**

### Step 2 — 画像ビルド（唯一のスクリプト）
```bash
node tools/travel/build-images.js --src drafts/incoming/travel-{id} --folder {folder} --out-json drafts/travel-{id}.build.json
```
- `{folder}` は場所が分かる短い英小文字（例 `sui`,`koja`）。`--prefix` 省略で `{folder}-`。
- OGに使う横写真が1枚目でなければ `--og-index N`。
- 出力: `images/travel/{folder}/` にAVIF/WebP多サイズ＋`{prefix}og.jpg`、及び断片JSON（`imageFolder`/`imagePrefix`/`orientation`/`photos[]`(index,width,height,variants)/`ogImage`）。
- **この断片が画像の真実**。以降の `srcset`/`width`/`height`/preload/og:image は必ずこの値を使う。
- sharp既定でEXIF全除去 → 出力にGPS・撮影日時・機種名は残らない。
- HEICが弾かれたら「JPEG/PNGで再共有」を促す（iPhone添付は通常JPEG）。
- 原本を作業フォルダから消してよい場合は、変換後に `drafts/incoming/travel-{id}/` を削除して原本を残さない。

### Step 3 — HTMLを直接書く（＝執筆＋組版）
Step 0 で特定した**型記事（最大番号の `travel-{N}.html`）** を下敷きに `travel-{id}.html` を新規作成する。以下を**必ず**満たす（=確認項目）。

#### 標準レイアウト（固定）— travel-15・16 を標準テンプレートとする
旅行記事は **travel-15・travel-16 の構成を標準テンプレート**とする。新規作成時にこの構成を変更しない（下敷きにする型記事＝最大番号の記事も、この標準に準拠している前提で写す）。

**レイアウト（この順序で固定）**
```
Hero
→ Section（画像＋本文）
→ Section（画像＋本文）
→ …（写真の数だけ繰り返し）
→ 締め
→ 旅行一覧へ戻る
```

**画像**
- 記事コンテナは `.travel-article-landscape` を使用する。
- 写真はすべて `class="viewer-photo"`。
- `width`/`height` は画像本来の実寸を保持（縦横比を保つ）。表示サイズは既存CSSで揃える。
- 画像の作り方・サイズ展開は travel-15・16 と同一（`build-images.js` の出力をそのまま使う）。

**本文**
- 各 Section は「画像 ＋ 短文（2〜4行）」を基本とする。
- 長文は避ける。写真を見ながら読めるテンポを優先する。

**Hero**
- 「タイトル ／ 一文 ／ 場所」のみ。余計な説明を書かない。

**締め**
- 「感想（写真なしの短い余韻）／ 旅行一覧へ戻るリンク」で終える。

**禁止事項**
- 独自レイアウトを作らない。
- `travel-article-portrait` を使わない。
- 記事ごとに HTML 構造を変えない。
- CSS を増やさない。
- 既存テンプレートを崩さない。

**記事ごとに変更してよいのは：タイトル・本文・写真・地図・OGP・JSON-LD のみ。** HTML 構造・class 名・section 構成は変更しない。

#### ✅ 確認項目（チェックリスト）
1. **既存記事の構造とデザインを踏襲**：header / nav / `main.layout>content>div.travel-article.travel-article-landscape` / hero / 写真section群 / 締めtext section / 戻るリンク / sidebar（地図＋カテゴリ）/ footer / `script.js` / back-to-top を**型記事と同一構造**で。CSSクラス名・DOM構造・`script.js`挙動・メタの書き方は型記事に合わせる（変えない）。
   - **記事コンテナのクラスは常に `travel-article-landscape` を使う（既存の標準）。先頭画像が縦（portrait）でも `travel-article-portrait` へ変更しない。** 断片JSONの `orientation` 値は各画像の縦横比の把握にのみ使い、コンテナのクラス切り替えには使わない（縦写真は landscape 記事内でも既存CSSで適切に表示される）。各画像の `width`/`height` は断片の実寸をそのまま入れ、縦横比は保持する。
2. **canonical・OGP・JSON-LD・slug・日付を確認**：
   - `<title>` = `{title} | 週末ログ`、`meta description`
   - `og:title`/`og:description`/`og:type=article`/`og:site_name=週末ログ`
   - `og:image` = `https://shumatsulog.com/images/travel/{folder}/{prefix}og.jpg`、`og:image:width=1200`/`height=630`
   - `og:url` と `canonical` = `https://shumatsulog.com/travel-{id}`（**slugを新IDに**。型記事のIDを残さない）
   - JSON-LD **Article**（headline/description/image=og.jpg/url/datePublished=`{date}`/publisher）
   - JSON-LD **BreadcrumbList**（3件目 name=タイトル・item=canonical）
   - `twitter:card=summary_large_image`/`twitter:site=@potato_weekend`/`twitter:image`=og.jpg
   - footer のシェアURL（`twitter.com/intent/tweet` の `text`=`{title} | 週末ログ`、`url`=canonical、いずれも encodeURIComponent）
   - `date` は `YYYY-MM-DD`（メモの日付。無ければ確認して決める。EXIFは除去済みで使えない）
3. **画像の alt・srcset・width・height を正しく**：各写真の `<picture>` は
   - `<source type="image/avif" srcset="…" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 60vw, 780px">`
   - `<source type="image/webp" srcset="…">`
   - `<img src="images/travel/{folder}/{prefix}{n}.webp" alt="…" class="viewer-photo" loading="…" width="{w}" height="{h}">`
   - `srcset` は断片の `variants` から：フル幅は `{prefix}{n}.avif {W}w`（サフィックス無し）、縮小は `{prefix}{n}-{v}.avif {v}w`。webpも同様。
   - `width`/`height` は断片の実寸。**1枚目だけ** `loading="eager" fetchpriority="high"`、他は `loading="lazy"`。
   - `alt` は写真の内容を簡潔に（Claudeが画像を見て記述）。
   - head の `<link rel="preload" as="image">` は**1枚目のavif** srcset（断片の photo1）。
4. **本文（ゆるログ文体）**：写真ごとに `<section>` 内へ短い段落。改行は `<br>`。段落は `<p>` 分割。締めは写真なしの `<section><p>…余韻…</p></section>`。
   - 観光紹介/文化紹介/レビューしない・見たものを書く・感想は最小限・1文短く・改行多め・オチを付けない・余韻で終わる。
   - 「〜でした」「〜だと思った」の連続、「おすすめ」「素晴らしい」は削る。基準トーン=既存 `travel-*.html`。
5. **sidebar**：地図 iframe（`maps.google.com/maps?q={encodeURIComponent 検索語}&output=embed&z={zoom既定14}`、height 既定220）＋ カテゴリボックス（型のまま）。場所説明文も差し替える。

### Step 4 — 一覧・sitemap・next-id を更新
1. **travel一覧（`travel.html`）**：hero直後に新記事の `<section>`（`article-row`：1枚目 `<picture>`(class `photo`,`loading=lazy`) ＋ `post-date`(YYYY.MM.DD) ＋ `<h3>タイトル</h3>` ＋ 説明文 ＋ `<a href="travel-{id}.html" class="btn">のぞく</a>`）を **先頭に prepend**。既存記事セクションは触らない。フォーマットは `travel.html` 内の既存 article-row を写す。
2. **`sitemap.xml`**：既存の最新 travel エントリの直後に
   ```xml
   <url>
     <loc>https://shumatsulog.com/travel-{id}</loc>
     <lastmod>{date}</lastmod>
     <priority>0.6</priority>
   </url>
   ```
   を追加（重複させない）。
3. **`tools/travel/next-id.json`**：`nextId` を `{id}+1` に更新。
4. **トップページ（`index.html`）の「最近の旅行」**：`#travel` セクションの `article-row` を**最新記事に更新**する。新記事公開時は毎回更新する。
   - 更新する要素：**トップ画像**（`<picture>` の `<source>` 群＋`<img>`）／**alt**／**紹介文**（記事固有の1文の `<p>`）／**記事へのリンク**（既存規約では一覧 `travel.html`。ボタン文言も既存のまま）。
   - **トップ画像は記事本文の先頭画像を機械的に使わない。** `.travel-photo` は横長バナー表示（`height:300px` cover）なので、**横向き（landscape）でトップ映えする写真を選定する**（先頭が縦写真なら、その記事の別の横写真を選ぶ）。`width`/`height` は選んだ画像の実寸、`srcset` は断片の `variants` を使う。
   - 2つ目の総則文 `<p>`（例「行った場所や食べたものの記録。」）は変えない。
   - **最終更新日**：`index.html` フッターの「最終更新：…」は自動更新ワークフローが push 時に更新するため手動編集しない。

### Step 5 — プレビュー提示 → 承認
- ブラウザで確認（`/staging/`ではなくルートに置いた `travel-{id}.html` なら相対パスが正しく解決する）。
- 要点（タイトル/副題/本文/各alt/OGの元写真/canonical/日付/一覧文）をユーザーに提示。
- **ここで止まる。** ユーザーの「公開して」等の明示承認を待つ。
  - **修正あり** →「この部分だけ直して」に従い、**指定箇所以外は不用意に変更しない**。ピンポイントEdit。→ 再プレビュー。
  - **承認** → Step 6。

### Step 6 — 公開（承認後だけ）
```bash
git add travel-{id}.html travel.html sitemap.xml images/travel/{folder} tools/travel/next-id.json index.html
git commit -m "feat(travel-{id}): {タイトル} を追加"
git push origin main
```
- `drafts/incoming/` と `drafts/*.build.json` はコミットしない。
- 公開確認: https://shumatsulog.com/travel-{id} （Cloudflare Pages 自動デプロイ）。

---

## 変更してよい範囲（安全制約）
- 追加/更新してよいのは：新規 `travel-{id}.html`、`travel.html`(先頭prependのみ)、`sitemap.xml`(新URL追加のみ)、`tools/travel/next-id.json`、`images/travel/{folder}/`、`index.html`(**`#travel` の「最近の旅行」`article-row` のみ**更新)。
- **触らない**：既存の全 `travel-*.html`（型記事を含む。読むだけ）、`style.css`、`script.js`、他カテゴリ。`index.html` も「最近の旅行」以外（他セクション・フッターの最終更新など）は触らない。
- 新規ページのJSは外部 `script.js` のみ（本番CSPで inline `<script>` は実行されない）。※型記事は準拠済み。
- OGは JPG（`{prefix}og.jpg` 1200×630）。WebPのOGはXで表示されない。
- 修正依頼は指定箇所のみ編集。迷ったら公開前に止まって確認する。
