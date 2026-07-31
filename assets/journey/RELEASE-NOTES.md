# Journey Intro Engine ― Release Notes

## v1.3.0-step4 (2026-07-31 / branch: journey-engine-v3) — V3 Step4: レンディション生成＋travel-17適用（実運用入り）
- 新規 `scripts/build-video-renditions.mjs`（ffmpeg-static・build-map-data.mjsと同方式）: マスター4Kから 540/720/1080(縦・H.264 faststart 無音)＋poster.webp を生成。サイズレポート＆config貼付スニペットを出力
- **travel-17 を `sources`/`poster` へ切替**＝V3で初の適応配信（エンジン読込を `?v=130` に更新しV3エンジンをロード）
- 生成物 `assets/video/travel-17/`：arrival-540(1.09MB)/-720(2.90MB=現行v2と同一)/-1080(10.97MB)/-poster.webp(0.03MB)、いずれも19.69s
- 検証: 手順書 `assets/journey/V3-VERIFY.md`＋比較ページ `_v3cmp.html`（PC/iPhone同条件・自動選択表示・手動画質比較・poster確認・サイズHEAD取得・選択マトリクス・ログ）
- 選択ログ（実config）: iPhone375→mobile / iPad768・iPadPro1366→tablet(iOS cap) / PC1440→desktop / 2g・SaveData→Hero直行 / 3g→mobile再生
- **V2への影響なし**: エンジンコード無変更（Step3のまま）。旧 `journey-arrival-v2.mp4` は温存。travel-17以外の記事は単一src＝従来挙動

## v1.3.0-step3 (2026-07-31 / branch: journey-engine-v3) — V3 Step3: iOS Safari 安定化ハードニング
- `<video>` に `webkit-playsinline` を追加（旧iOSのインライン再生）。`playsinline`/`muted`属性は明文化
- **canplay gating**: `enterVideo` で `readyState≥2` なら即再生（通常/V2＝挙動不変）、未準備なら `canplay` を待って再生。iOSの早すぎる `play()` 拒否・黒画面を回避（待機中はposter表示、`loadBudgetMs`超過ならHero）
- **iOS tier cap**: iOS(iPhone/iPad/iPadOS13+)では高解像度デコード回避のため最上位(desktop=maxWidth無し)を選ばず、maxWidth有りの最上位(tablet相当)にcap。V3の`sources`指定時のみ・iPhone/iPadは元々mobile/tabletなので実質iPad Pro級のみ対象
- autoplay拒否/低電力モードは従来どおり即Hero（Step2の集約を踏襲）。`toHero`で保留canplayを無効化
- 追加API（内部・テスト用）: `JourneyIntro._isIOS()`
- **V2への影響なし**: 単一src(travel-17)はtier cap対象外。canplay gatingは「未準備時のみ」分岐＝先読み済みの通常再生は同一。属性追加は非iOSで無害

## v1.3.0-step2 (2026-07-31 / branch: journey-engine-v3) — V3 Step2: 回線フォールバック＋読込予算＋poster
- `navigator.connection` から Save-Data / effective[slow-2g,2g] を判定。**V3設定(`video.sources`)時のみ** `saveDataFallback`（既定 `hero`）で動画を出さず 地図→到着セレモニー→Hero に直行。`lowest` 指定なら最低tierに差替えて再生
- `video.loadBudgetMs`（既定6000）: enterVideo後この時間内に再生位置が進まなければ（未準備/停滞）→ Heroへ。従来の4sウォッチドッグを置換
- 再生失敗を必ずHeroへ集約: `play()`拒否 / `error`イベント / 予算超過 / `ended` の全経路が `toHero`
- `poster`（`video.poster`）を `<video>` に設定＝黒画面回避の接続フレーム（生成はStep4）
- **V2への影響なし**: `sources` 無しの単一src(travel-17)は回線スキップ対象外＝常に再生（従来挙動）。失敗時フォールバックのみ強化
- 追加API（内部・テスト用）: `JourneyIntro._planVideo(videoCfg, chosen, netOverride?)` / `._readNetwork()`

## v1.3.0-step1 (2026-07-31 / branch: journey-engine-v3) — V3 Step1: 端末別 動画ソース選択
- config `video.sources`（任意・配列）に対応。viewport幅＝デバイスクラスで「条件を満たす最小tier」を選択（mobile軽量維持のためDPRでtier引上げしない）
- `sources` 無しは従来の `video.src`（V2）をそのまま使用＝**後方互換**（travel-17は挙動不変）
- 選択結果は `instance.chosenVideo`、ロジックは `JourneyIntro._pickVideoSource(videoCfg, vw?)` で単体テスト可
- 演出・公開API不変。回線判定/フォールバック/posterはStep2以降


## V2 最終候補確定（2026-07-31 / travel-17）
実機(iPhone)確認を経て、Journey Intro V2 の演出パラメータを確定（エンジン無改変・config層のみ）:
- 動画: `journey-arrival-v2.mp4`（縦720p/faststart/無音）を **startAt 3.5s → playSeconds 16.0s**（ドローン尺12.5s・到着感維持）
- Heroフェード: **heroCrossfadeMs 1000ms ＋ heroZoom(Scale)** ＝ Dissolve+Scale（"ボワーン"と柔らかく溶け込む）
- 到着減速(easeOut 900ms)・到着セレモニーは既定のまま
- iOS動画自動再生の堅牢化(v1.2.1: muted属性/先読み)込み
- ※main マージ・Cloudflare公開はユーザー最終確認後


## v1.2.0 (2026-07-29〜30) — V2品質仕上げ ※正式公開版候補

**地図エンジン刷新（vector-v2）**
- 世界=Natural Earth 110m(PD) / 日本近海=国土地理院「地球地図日本」v2.2(polbnda) の実海岸線を
  ビルド時前処理（`scripts/build-map-data.mjs`・mapshaper 4段LOD）→ `map-data/journey-map.v1.js`（27.5KB gzip）
- 地球儀の中を実世界地図が自転／日本(東京アンカー)→南西諸島→宮古・伊良部を実海岸線でLODクロスフェード降下
- 出典を intro 左下に自動表示（プロバイダの `attribution`）。モバイルは2行折返しでスキップボタンと非干渉
- map-data 欠落/破損時は abstract-v1 に自動降格（記事は壊れない）。ランタイム外部通信0・CSP無変更
- fix: プロバイダ生成要素を決定論シークの制御対象に収集（エンジン化時のリグレッション）
- fix: 降格時に前回mountの出典表記が残留する問題

**計測（Lighthouse モバイルエミュレーション・4xスロットリング）**
| | Perf | A11y | BP | LCP | CLS | TBT |
|---|---|---|---|---|---|---|
| ベースライン(イントロ無し) | 66 | – | – | 6.5s | 0 | 220ms |
| v1.2.0(イントロ有り) | 59 | 96 | 96 | 7.0s | **0** | 350ms |

→ イントロの追加コストは -7pt / LCP+0.5s / TBT+130ms。CLS 0 維持（オーバーレイはレイアウト非干渉）。

## v1.1.1 (2026-07-29) — travel-17 本番組み込み
- 記事側3行＋config JSON で組み込み。動画ウォッチドッグ／Intro中スクロールロック／完了後オーバーレイ自動破棄
- Skip・reduced-motion・同一セッション2回目自動スキップ・404/autoplay拒否フォールバックを実機相当で検証

## v1.1.0 — Phase2 演出
- トレイルグリント／ピン着地リング×2／240ms映画的マッチカット／粒状ノイズ+ビネット（全て `cfg.fx` でOFF可）

## v1.0.0 — エンジン化
- 単一HTML試作を config駆動エンジンへ分離（3層構成）。MapProvider差替口・決定論シーク・WAAPIクロスフェード

## 既知の制約
- Lighthouse Perf はサイトベースライン(66)自体がモバイル4xスロットルで頭打ち（Hero画像1600pxが支配的）
- 低速回線では本文が一瞬見えてからイントロが被る（JS失敗時も記事が読める安全側の設計判断）
- バックグラウンドタブでは rAF が止まるが `ended` イベントで完走を保証
- reduced-motion はコード+CSSの二重防御だが、実OS設定での最終確認は実機にて
- 音声(`cfg.audio`)はフックのみ（無音運用）。地図の nodeGeo(緯度経度)指定は将来拡張
