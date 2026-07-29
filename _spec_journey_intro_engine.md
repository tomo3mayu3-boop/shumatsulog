# Journey Intro Engine 設計書 v1.1

作成: 2026-07-29（v1.1: Phase2演出＋Phase3詳細設計を追記） ／ 対象: shumatsulog.com（週末ログ）
ステータス: **v1.1実装済み（未コミット） → Phase3(v2)は§11の設計のみ**

---

## 1. 目的と背景

travel-17 で試作した Journey Intro（宇宙→世界→東京→沖縄→宮古島→到着セレモニー→実写ドローン→Hero）を、
**今後100記事以上の旅行記事で使い回せる長期運用エンジン**として再設計する。

試作版の課題:
| 課題 | 内容 |
|---|---|
| 単一HTML密結合 | CSS/JS/SVG/設定が1ファイルに混在。記事ごとにコピーすると即座に保守不能になる |
| 設定が散在 | 経路・地名・座標・タイミングがCSSキーフレーム%とJS定数に分散 |
| 地図が手描き | 世界地図SVGが目分量。日本近海のズームに耐える精度がない |
| ラベルがCSS固定 | 経由地の数・名前を変えるたびにキーフレーム%を手計算 |

## 2. 要求事項

1. **モジュール化** — エンジン(js/css)と記事側設定を完全分離。記事への組み込みは「3行」
2. **設定ファイル化** — 経路・地名・座標・動画・タイミングをJSONで宣言。コード変更なしで新記事対応
3. **地図エンジンの刷新** — 手描きSVGを実データ由来へ。国土地理院ベースを検討
4. **保守性** — バージョニング、後方互換、開発ハーネス、決定論的テスト
5. **パフォーマンス** — 予算を定義し、100記事へスケールしても劣化しない構造

## 3. 全体アーキテクチャ（3層）

```
┌─ 記事HTML（100記事）────────────────────────────┐
│ <link  href="/assets/journey/journey-intro.css">          │
│ <script type="application/json" id="journey-intro-config">│
│   { …この記事の旅設定(JSON)… }                            │
│ </script>                                                 │
│ <script src="/assets/journey/journey-intro.js" defer>     │
└──────────────┬─────────────────────────────┘
               ↓ 自動初期化（config読取→DOM生成→再生）
┌─ エンジン層（全記事共通・1実体）───────────────┐
│ journey-intro.js                                          │
│  ├ core: タイムライン/フェーズ管理/シーク(決定論)         │
│  ├ phases: atmosphere / flight / ceremony / video / hero   │
│  ├ MapProvider registry（地図エンジン差替口）              │
│  └ hooks: audio / skip / onComplete / reduced-motion       │
│ journey-intro.css（見た目一式・CSS変数でテーマ/尺可変）     │
└──────────────┬─────────────────────────────┘
               ↓ mount(container, cfg)
┌─ 地図プロバイダ層（差替可能）─────────────────┐
│ abstract-v1 …… 現行の様式化グローブ（内蔵・依存0）★v1     │
│ vector-v2  …… 実測ベクトル海岸線（前処理して同梱）  次期  │
│ gsi-tiles-v3 … 地理院タイル実読込（要CSP変更）      任意  │
└────────────────────────────────────────┘
```

### ファイル構成
```
assets/journey/
  journey-intro.js          # エンジン本体（依存0・IIFE・~15KB min想定）
  journey-intro.css         # スタイル一式（~7KB）
  map-data/                 # (v2) 前処理済みベクトルデータ置き場
scripts/
  build-map-data.mjs        # (v2) GeoJSON→簡略パス変換（ビルド時のみ、要Node）
_proto_journey_intro.html   # 開発ハーネス（スクラバー/リプレイ。非公開・リンクしない）
_spec_journey_intro_engine.md  # 本書
```

## 4. 設定スキーマ（記事側JSON）

```jsonc
{
  "version": 1,                     // スキーマ版。エンジンが検証し不一致はwarn
  "id": "travel-17",                // 記事ID（スキップ記憶キー等）
  "route": {
    "map": "abstract-v1",           // MapProvider名
    "path": "M258 44 Q249 68 244 92 Q236 118 222 140 Q190 152 150 150",
    "waypoints": [                   // 経由地（数は可変。ラベル窓は自動計算）
      { "jp": "東京",   "ro": "Tokyo",      "node": [258, 44] },
      { "jp": "沖縄",   "ro": "Okinawa",    "node": [244, 92] },
      { "jp": "宮古島", "ro": "Miyakojima", "node": [222, 140] }
    ],
    "introLabel": { "jp": "世界", "ro": "The World" }
  },
  "destination": { "jp": "ユニの浜", "ro": "Uni Beach", "lat": 24.7880, "lon": 125.2480 },
  "video": {
    "src": "assets/video/journey-arrival.mp4",  // 降下部分のみ・無音・Hero戻しなし
    "poster": null, "startAt": 0, "playSeconds": null,
    "easeOutMs": 900, "easeOutRate": 0.30, "objectPosition": "center"
  },
  "audio": { "src": null, "volume": 0.5, "fadeInMs": 1400 },   // 風環境音は後付け
  "timing": {
    "phase1Ms": 13000, "flightStartPct": 0.46, "flightEndPct": 0.90,
    "crossfadeMs": 900, "heroCrossfadeMs": 1000,
    "arrival": { "holdMs": 380, "pinMs": 600, "labelStartMs": 560,
                 "labelMs": 560, "coordStartMs": 640, "coordMs": 1000, "pauseMs": 280 }
  },
  "skip": { "button": true, "label": "スキップ", "oncePerSession": true },
  "brand": "週末ログ · Journey"
}
```

設計判断:
- **経由地ラベルの表示窓は自動計算**（ノードの弧長→イージング逆関数で通過時刻を導出）。
  試作版のCSSキーフレーム%手計算を廃止。経由地が2つでも5つでも設定だけで動く。
- config は**記事HTMLにインライン**（`<script type="application/json">`）。外部fetch 1本を節約し、
  記事＝コンテンツ＋設定 が1ファイルで完結（iPhone記事パイプラインとの相性优先）。

## 5. 地図エンジンの刷新方針

### 比較（本番CSP: `img-src 'self' … data:` / `connect-src 'self' …GA系のみ` を確認済み）

| 案 | 内容 | 重量 | 外部依存 | CSP変更 | 出典表記 | 精度 | 実装コスト |
|---|---|---|---|---|---|---|---|
| **abstract-v1**（現行内蔵） | 様式化SVGグローブ＋帯状世界地図 | +0KB | なし | 不要 | 不要 | 低（雰囲気） | 済 |
| **vector-v2**（推奨・次期） | 国土地理院「地球地図日本」等のGeoJSONを**ビルド時に**簡略化しSVGパス化して同梱 | +20〜30KB gzip | **ランタイム0** | 不要 | 必要（後述） | 中〜高 | 中（前処理スクリプト） |
| gsi-tiles-v3（任意） | 地理院タイルをランタイム読込（終盤の島クローズアップのみ等） | +数百KB/再生 | gsi.go.jp | **必要**（img-src追加） | 必要 | 最高（実写地図） | 高（タイル管理・回線ジッタ対策） |

### 推奨: **v1で出荷 → v2を標準化、v3はオプション扱い**
理由:
1. 本サイトの原則（軽量・外部依存最小・CSP厳格）に v2 が最も適合。**ランタイムのネットワーク0**を維持できる
2. 演出はコレオグラフィ（秒単位の同期）が命。タイル読込のジッタは演出品質を直接壊す
3. v2 の元データは 国土地理院「地球地図日本」（または Natural Earth）を**ビルド時に** mapshaper 等で
   簡略化 → `map-data/japan-v1.js`（座標配列）として同梱。100記事すべて同じ1ファイルをキャッシュ共有

### 国土地理院データの利用条件（v2/v3共通）
- 出典の明記が必要（国土地理院コンテンツ利用規約 / 政府標準利用規約2.0・CC BY 4.0互換）
- エンジンは **MapProvider が返す attribution 文字列を intro 右下に自動表示**する枠を持つ
  （例: 「地図データ: 国土地理院（地球地図日本）」）。abstract-v1 は非表示
- v3（地理院タイル）を使う場合は `_headers` の CSP `img-src` に `https://cyberjapandata.gsi.go.jp` を追加する
  （**サイト全体のCSP変更になるため、採用時は別途明示承認を取る**）

### MapProvider インターフェース
```js
JourneyIntro.registerMap('name', {
  mount(container, cfg, ctx) { /* DOM構築。CSSアニメは --ji-p1 で尺同期 */ },
  seek(ms)   { /* 任意: 決定論シーク対応が必要な描画があれば */ },
  attribution: null | '地図データ: …',
  destroy()  {}
});
```

## 6. パフォーマンス設計

### 予算（1記事あたり追加コスト）
| 項目 | 予算 | 備考 |
|---|---|---|
| journey-intro.js | ≤ 20KB min（gzip ~7KB） | 全記事共通・強キャッシュ |
| journey-intro.css | ≤ 8KB | 同上 |
| map-data (v2) | ≤ 30KB gzip | 同上（全記事共有） |
| 記事側config | ≤ 2KB | インラインJSON |
| 動画 | ≤ 4MB / 720p / 6〜9s | **記事ごと**。poster(webp ≤60KB)必須化 |

### 方針
- 描画は **transform / opacity のみ**（GPU合成）。rAFループは常に1本。連続 filter アニメ禁止（試作で実証済み）
- クロスフェードは **Web Animations API**（CSS transition の発火不良回避。試作で実証済み）
- 動画は `preload="metadata"` で開始し、Phase1開始後に `auto` へ昇格（初期表示を塞がない）
- **LCP/CLS**: intro はオーバーレイでレイアウトに不干渉（CLS 0）。Hero画像の preload は既存記事の仕組みを維持
- **スキップ設計**（100記事運用の要）:
  - 右下に常時「スキップ」ボタン
  - `skip.oncePerSession`: sessionStorage `ji-seen:<id>` で**同一セッション2回目以降は自動スキップ**
  - `prefers-reduced-motion: reduce` は生成そのものを行わない（即Hero）
- rAFスロットル対策: 動画終端は `ended` イベントを保険に併用（実証済み）。バッテリー低電力等で
  autoplay が拒否された場合は poster 表示のまま即Heroへフォールバック

### 動画資産のスケール問題（100記事 × ~4MB）
- リポジトリ肥大（GitHub 1GB 目安）が中期リスク。**Phase 2 で Cloudflare R2/Stream 等への外出しを検討**
  （Cloudflare 移行が完了してから。エンジンは `video.src` がフルURLでも動く設計にしておく＝対応済み）

## 7. 保守性・運用

- **バージョニング**: エンジンは semver。互換を壊す変更はファイル名を上げる（`journey-intro.v2.js`）。
  config に `"version": 1` を持たせ、エンジンが不一致を console.warn（旧記事は旧挙動のまま動く）
- **記事への組み込み手順（3行）**: §3 の通り。旅行記事テンプレ／travel-article スキルに追記して
  記事生成時に config JSON を書くだけにする（iPhone完結パイプラインを崩さない）
- **開発ハーネス**: `_proto_journey_intro.html` を維持（リプレイ/ループ/タイムラインスクラバー/動画スクラバー）。
  エンジン公開APIのみで実装し、本番コードにデバッグUIを含めない
- **決定論テスト**: `instance.seek(ms)` で任意時刻の状態が再現できる設計を維持
  （フライト角度・セレモニー各段階・ラベル窓を console から数値検証できる。今回の検証手法を標準化）

## 8. アクセシビリティ

- 装飾レイヤー（地図・動画）は `aria-hidden="true"`。**スキップボタンはその外**に置きフォーカス可能
- `prefers-reduced-motion` 尊重（生成せず即Hero）
- 動画は muted / playsinline。音声(audio.src)を将来足す場合も **ユーザー操作なしでは音を出さない**
  （autoplay拒否時は pointerdown 一回で開始するフォールバック）

## 9. 段階的移行計画

| Phase | 内容 | 状態 |
|---|---|---|
| v1 | エンジン化（本書＋実装）。map=abstract-v1。travel-17 でβ | **今回** |
| v1.1 | travel-17 本番組込み（記事HTML3行＋config）。数記事で運用 | 承認後 |
| v2 | `build-map-data.mjs` で地理院ベクトル前処理 → vector-v2 プロバイダ | 次期 |
| v2.1 | 動画アセットの R2/Stream 外出し検討（Cloudflare移行完了後） | 中期 |
| v3 | gsi-tiles プロバイダ（要CSP変更・別途承認） | 任意 |

## 10. リスクと対応

| リスク | 対応 |
|---|---|
| 動画autoplay拒否（低電力モード等） | poster→即Heroフォールバック |
| バックグラウンドタブのrAF停止 | `ended` 保険＋復帰時に位相再計算 |
| リポ肥大（動画×記事数） | v2.1 で外部ストレージ。src はURL可の設計済み |
| GSIタイル採用時のCSP | 採用時に `_headers` 変更を明示承認制で |
| エンジン改修による旧記事破壊 | semver＋ファイル名バージョン、config version 検証 |

---

## 11. Phase 2 実施記録（v1.1.0 / 2026-07-29）

方針「派手ではなく高級感+20%」（参照トーン: Apple / DJI / Vision Pro / Mapbox）。
すべて `cfg.fx` フラグで個別OFF可（後方互換）。追加コスト: CSS+約1KB / JS+約1.5KB / **新規rAFループ0・連続filterアニメ0**。

| fx | 実装 | 変更理由 |
|---|---|---|
| トレイルグリント | 同一パス2本目に dash区間0.07 を機体直後に追従（既存フライト計算に相乗り・決定論） | 航路が「描かれた線」から「いま飛んでいる軌跡」になる。動きの気配を1本の細い光だけで足す |
| 着地リング | ピン着地(hold+pin×0.9)に同期し2輪（0.5/0.26透過・650ms・300ms差） | 「目的地が確定した」ことを無音で伝える定番文法（Google Maps）。時間駆動なのでシークでも再現 |
| 映画的マッチカット | heroCrossfade 1000→**240ms** cubic-bezier(.4,0,.2,1) ＋ 動画へ scale 1→1.035 (380ms) | 動画終端フレーム≒Hero構図のため、長い溶暗より「一歩前に踏み込んで切り替わる」方が上質。旧値はconfigで戻せる |
| 質感（粒状+ビネット） | data:URI の feTurbulence タイル（opacity .05, overlay）＋ 周辺減光の静的グラデ | ベタ塗りグラデの Illustrator 感を4%だけ崩し、周辺を沈めて中央（目的地）へ視線誘導。両方とも静的＝描画コスト一定 |

## 12. Phase 3（v2）設計方針 ― 国土地理院ベース地図移行（コード未着手）

### 12.1 ゴール
abstract-v1（様式化）を **実地形ベクトル（vector-v2）** に置き換え、
「世界（globe）→ 日本列島 → 南西諸島 → 宮古・伊良部 → 目的地」を**実在の海岸線**で降下する。
ランタイム外部通信0・CSP無変更・出典表記自動、を維持したまま。

### 12.2 データパイプライン（ビルド時・1回だけ）
```
元データ（いずれか。精度と権利で選定）
  A) 国土地理院「地球地図日本」(海岸線・行政界) … 出典表記で利用可
  B) Natural Earth 10m coastline … PD。世界層はこちら
       ↓ scripts/build-map-data.mjs（Node・mapshaper API）
  簡略化: 世界=許容誤差大 / 日本=中 / 南西諸島=小 / 宮古・伊良部=最小（4段LOD）
       ↓ 座標→各ステージ専用 viewBox に投影（メルカトル近似で十分。緯度帯が狭いため）
  出力: assets/journey/map-data/journey-map.v1.js（~25KB gz目標）
        JourneyIntro.registerMapData('jp-v1', { stages:[{id,viewBox,paths[],label}], attribution })
```
- 前処理はリポジトリ内で完結（外部ビルドサービス不使用）。生成物をコミットし、実行環境依存を残さない
- 世界層はNatural Earth（PD）、日本近海の精細層は地球地図日本 → attribution は「地図データ: 国土地理院（地球地図日本）」

### 12.3 vector-v2 プロバイダ設計
- `mount()`: ステージSVGを重ねて生成（fill=海岸線シルエット、既存のトーン＝薄いシアン系を踏襲し**v1の見た目を崩さない**）
- ズーム演出: 既存 `.ji-scenes` のCSSズームを流用し、**ステージ間はopacityクロスフェード**（LOD切替を溶かす）
- 経路座標系: config の `route.path/node` は**緯度経度指定に拡張**（`nodeGeo:[lat,lon]`）。エンジンが viewBox 座標へ射影。既存の `node:[x,y]` も引き続き有効（後方互換）
- `attribution` はプロバイダが返し、エンジンの `.ji-attrib` 枠が自動表示（実装済みの口をそのまま使用）
- フォールバック連鎖: `map-data` 未ロード/パース失敗 → abstract-v1 に自動降格（記事は絶対に壊れない）

### 12.4 パフォーマンス・スマホ
| 項目 | 方針 |
|---|---|
| データ量 | 4段LOD合計 ≤25KB gz。全記事共有・強キャッシュ（ファイル名にバージョン） |
| 描画 | SVGパスは静的。動くのは従来どおり transform/opacity のみ。パス点数は各ステージ ≤1,500点 |
| スマホ | vmin基準の既存レイアウトを踏襲。`(max-width:640px)` では最精細ステージのパスを間引き版に差替（LODをもう1段） |
| 低速回線 | map-data は `defer` 読込。間に合わなければ abstract-v1 で開始（降格戦略と同一経路） |
| 検証 | 決定論シーク＋ステージ境界時刻のゴールデン値をハーネスに追加 |

### 12.5 実装ステップ（次回）
1. `scripts/build-map-data.mjs` ＋ 生成データのコミット（要Node/mapshaper。**このリポ内で完結**）
2. `journey-intro.js` に `registerMapData` と緯度経度射影を追加（既存API不変・+2〜3KB）
3. vector-v2 プロバイダ実装 → ハーネスで abstract-v1 と切替比較（configの `route.map` 1行）
4. travel-17 のconfigへ `nodeGeo` 併記 → 見た目確認 → β

