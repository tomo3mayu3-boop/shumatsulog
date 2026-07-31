# Journey Engine V3 — 実機検証手順（Step4）

動画レンディション（540/720/1080）＋poster の PC・iPhone 同条件比較手順。
検証ページ: **`_v3cmp.html`**（リポジトリ直下・開発用）。

## 0. 配信サーバ（必ず C:\homepage から起動）
```bash
cd /c/homepage && python -m http.server 8731 --bind 0.0.0.0
```
- PC: `http://localhost:8731/_v3cmp.html`
- iPhone（同一Wi-Fi）: `http://<PCのLAN IP>:8731/_v3cmp.html`（例 `http://192.168.2.183:8731/_v3cmp.html`）
  - LAN IP は PowerShell `ipconfig` の IPv4 で確認。

## 1. ①自動選択の確認（同条件比較の要）
ページ上部に「この端末での自動選択」が出る。PC と iPhone で開き、下表と一致するか確認:

> tier方針（2026-07-31確定）: 高DPI端末での拡大表示による甘さ対策で **540pは廃止**。
> mobile=**720p** / tablet=**1080p** / desktop=**1080p**（すべて CRF20 / preset slow / bt709色タグ）。

| 端末（viewport） | 通常回線 | 選択tier / ファイル |
|---|---|---|
| iPhone（375）| 4g/3g | **mobile** / arrival-720.mp4 |
| iPad 縦（768）| 4g | **tablet** / arrival-1080.mp4 |
| iPad Pro（1366, iOS cap）| 4g | **tablet** / arrival-1080.mp4 |
| PC（1440）| 4g | **desktop** / arrival-1080.mp4 |
| Safari（回線API非対応）| — | viewport のみで選択（PCなら desktop=1080）|

低速・省データ時（iPhoneのみ判定可）:
| 条件 | 挙動 |
|---|---|
| 2g / slow-2g | 動画を出さず **Hero直行**（reason=2g）|
| Save-Data ON | **Hero直行**（reason=save-data）|
| 3g | mobile を **再生** |

- iPhone実機での Save-Data 検証: 設定 > モバイル通信 > 通信のオプション > データモード > **省データモード** をON。
- 低速回線の擬似: Mac Safari + iPhone実機なら「デベロッパ > Service Worker/Network Link Conditioner」または実際の低速環境で。PC Chrome は DevTools > Network > Throttling で `effectiveType` が変わる。

## 2. ②手動再生で画質比較
「720(mobile) / 1080(tablet/desktop) / auto」ボタンで、地図を飛ばして動画パート（開始3.5s→接続16.0s→Hero）を再生。
同じ端末で切替え、**画質差**と**Hero接続の自然さ**を目視比較。ログに `chosen tier / src` が出る。
（全画面での拡大率そのものは `_v3res.html` で数値確認できる。）

## 3. ③poster 表示確認
- 上段: `arrival-poster.webp` を直接表示（絵柄確認）。
- 下段: `<video preload="none" poster=...>`。**再生前にこの絵が出る**こと＝黒画面回避を実機で確認（特に iPhone）。

## 4. ④ファイルサイズ（配信元から HEAD 取得）
ページ④の表に Content-Length ベースの実サイズが出る。基準値:
| tier | ファイル | 解像度 | 設定 | サイズ |
|---|---|---|---|---|
| mobile | arrival-720.mp4 | 720×1280 | CRF20 slow | 6.94 MB |
| tablet/desktop | arrival-1080.mp4 | 1080×1920 | CRF20 slow | 16.89 MB |
| poster | arrival-poster.webp | 720×1280 | webp q82 | 0.03 MB |

## 5. ⑤選択マトリクス
ページ⑤に viewport×iOS の選択結果が表で出る（上記①と同じ判定を一覧化）。

## 6. 本番（travel-17）通し確認
`http://<host>:8731/travel-17.html` を開き、PC/iPhone で通し再生。
- console error / 404 が無いこと、Skip・2回目自動スキップ・reduced-motion、Heroへの接続を確認。
- 期待通りの解像度が読まれているかは DevTools/Network（PC）で `arrival-540/720/1080.mp4` のどれが GET されたかを確認。

## 生成物の再ビルド
```bash
node scripts/build-video-renditions.mjs --in "<master.MP4>" --slug travel-17 --poster-at 3.5
```
（ffmpeg は `npm i -D ffmpeg-static` もしくは `--ffmpeg <path>` / `$FFMPEG`。master は元4K: `動画 2026-07-14 9 18 57.MP4`）
