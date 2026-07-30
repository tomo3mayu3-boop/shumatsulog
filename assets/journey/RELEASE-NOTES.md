# Journey Intro Engine ― Release Notes

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
