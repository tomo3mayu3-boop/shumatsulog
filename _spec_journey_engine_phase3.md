# Journey Engine Phase3 設計提案 — 見た目・ブランド体験の最終ブラッシュアップ

作成: 2026-08-01 ／ ステータス: **設計提案（未実装・レビュー待ち）** ／ branch: journey-engine-v3
前提: Phase1(テンプレート化)/Phase2(地域汎用化) 完了。engine v1.3.6-failsafe。技術基盤は完成。

---

## 0. 方針（重要）

- **新機能の大量追加はしない**。既存の Journey Intro を「より上品・気持ちよく」見せる**質感の底上げ**が目的。
- **保護不変（絶対に変えない）**: travel-17 の **タイミング／動画区間(startAt3.5・playSeconds16.0)／画質(720p mobile・1080p tablet/desktop・CRF20 slow)／`arrivalEase:false`（到着減速は復活させない）**。
- **Performance First**: 追加はコンポジタ処理（transform/opacity、必要時のみ軽量filter）に限定。**毎フレームJSを増やさない・初期表示を遅らせない・重いSVG/backdrop blurを増やさない**。
- config互換維持・記事HTML変更は原則ゼロ・各Step rollback可・全て `cfg.fx` 等でトグル可（既定は上品な新見た目、旧に戻せる）。

---

## 1. 項目別 比較（6軸）

軸: 見た目改善 / 実装コスト / 性能影響 / iPhone Safariリスク / travel-17保護不変への影響 / 採用優先度

| # | 項目 | 見た目 | 実装 | 性能 | iPhone | 保護不変 | 優先度 |
|---|---|---|---|---|---|---|---|
| A | ルート線の光り方・質感 | 中〜高 | 低 | なし（stroke属性・drop-shadow据置、per-frame増なし） | 低（重いSVG blur不使用） | なし（CSSのみ・タイミング不変） | **高** |
| B | 到着ピンのリップル洗練 | 中 | 低 | 微（既存driveCeremonyにtransform1要素程度） | 低 | なし | **中** |
| C | 座標表示の余韻 | 中 | 低 | なし（`.locked`のCSS transition） | 低 | なし | **中** |
| D | 地図→動画の接続 | 低〜中 | 中 | 微 | 中（接続の実機再確認要） | **注意**（crossfade/接続16.0sに触れやすい） | **低（原則見送り）** |
| E | 動画→Hero Dissolve+Scale | 高 | 中 | 微（WAAPI1本・**Hero側**scale） | 低〜中（大画像scale=GPU） | なし（**動画は不触**・heroCrossfadeMs維持） | **高** |
| F | スキップ/地図クレジットの見た目 | 中 | 低 | なし | 低（backdrop-filterは既存） | なし | **中** |
| G | iPhone/PC 見え方の統一 | 中 | 中 | なし〜微 | 低 | 微（PC動画フレーミングの見え方変更） | **中** |
| H | reduced-motion の自然な代替 | 中 | 低〜中 | なし | 低 | なし（reduced時のみ動作） | **中** |
| I | 週末ログらしいブランド感 | 中 | 低 | なし | 低 | なし | **中** |

---

## 2. 各案の具体（設計詳細）

### A. ルート線の光り方・質感（優先:高）
- 現状: `.ji-trail` = ターコイズstroke2.3 + `drop-shadow(0 0 3px)`、`.ji-trail-hl`(グリント)。
- 案: (a) trailに**ブランド色の微グラデーションstroke**（ターコイズ→シャンパン）でブランド感、(b) グリント幅/イージングの洗練、(c) 描画完了時の極短「定着」（stroke-width一瞬+0.2→戻し、WAAPI 1回）。**重いSVG filter(blur)は不使用**（iPhone負荷回避）。
- 効果: 線が上品に。コスト低・性能無影響・保護不変。

### B. 到着ピンのリップル洗練（優先:中）
- 現状: `.a-ring`×2、driveCeremonyでscale+opacityをJS駆動。
- 案: 2波のイージング/間隔/減衰を「Google Mapsの着地」風に微調整（要素追加は最小＝既存2波の質を上げる）。必要なら3波目を薄く（透明度低）。per-frameは既存範囲。
- 効果: 着地が気持ちよく。性能微・保護不変。

### C. 座標表示の余韻（優先:中）
- 現状: `.a-coord.locked` で色+glow、pauseMs 1280の余韻。
- 案: ロック時に**letter-spacingがすっと締まる**/微brightnessパルス（CSS transitionのみ）。数値ロールアップ完了の「カチッ」を上品に。
- 効果: 到着の実感。性能なし・保護不変。

### D. 地図→動画の接続（優先:低=原則見送り）
- 接続16.0s・crossfadeMs・progressComplete に触れると**実機の接続確認をやり直す必要**があり、保護不変（タイミング）に近い。今回は**据置**を推奨。zero-timing-riskの範囲（例: 動画レイヤのfade-inイージングのみ）に限るなら Step3 に微fold可。

### E. 動画→Hero Dissolve+Scale（優先:高）
- 現状: travel-17 は `fx.heroZoom:false`（以前、**動画をscaleすると拡大で軟化**したためOFF）。
- 案: **Scaleの対象を動画→Hero画像に変更**（`fx.heroScaleIn`・新規・既定は控えめ）。Dissolve(heroCrossfadeMs 1000)中に**Hero画像を1.00→1.03へKen Burns**。動画は等倍のまま＝**画質軟化ゼロ**、接続タイミング不変。以前OFFにした理由（動画の軟化）を回避しつつ「Dissolve+Scale」の上質さを獲得。
- 効果: 高。WAAPI1本（compositor transform）。iPhoneは大画像scaleだがGPUで軽い。保護不変（動画画質・尺・timing不触）。

### F. スキップ/地図クレジット（優先:中）
- 現状: `.ji-skip`(pill+backdrop blur3px)、`.ji-attrib`(左下)。
- 案: タイポ/余白/不透明度の精緻化、明暗どちらの映像上でも可読なよう微scrim(text-shadow)。フェードインの上品化。backdrop-filterは**新規追加せず据置**。
- 効果: 情報系が上品に。性能なし。

### G. iPhone/PC 見え方の統一（優先:中）
- 現状: 縦動画をPC横画面で `object-fit:cover`＝中央帯クロップ（iPhoneは縦で自然）。
- 案: PCでは**中央に縦フレーム（max-width）**で見せる等、フレーミングを統一（object-positionの微調整でも可）。地図/UIの余白もブレークポイントで揃える。
- 効果: 端末間の一貫性。保護不変への影響は「PCの見え方」のみ（動画画質・尺・timing不触）。

### H. reduced-motion の自然な代替（優先:中）
- 現状: `@media (prefers-reduced-motion) .ji-overlay{display:none}`＝**イントロ完全スキップ**（記事/Heroへ直行）。
- 案: 動きを最小化した**静的な到着カット**（目的地ラベル＋座標を短く静止表示→Heroへ soft fade）か、最低限 **Heroの穏やかなopacityフェード**（transformなし＝reduced-motion的に許容）。無音・無モーションで上品に締める。
- 効果: reduced環境でもブランド体験。reduced時のみ動作＝通常系は無影響。

### I. 週末ログらしいブランド感（優先:中）
- 現状: `.ji-brand` "週末ログ · Journey"（uppercase・低不透明度）。
- 案: 週末ログのブランド色（シャンパン/ターコイズ既出）とタイポの整合、署名モーメントの微調整（例: サイトヘッダ "✈️ 週末ログ" との一貫性）。過剰にしない。
- 効果: 全体の締まり。性能なし。

---

## 3. Step 分解（案・小さく・各Step rollback可）

| Step | 内容(項目) | 種別 | 性能 | リスク |
|---|---|---|---|---|
| **1** | 静的質感の底上げ（A ルート線 / F スキップ・クレジット / I ブランド / grain・vignette微調整） | 純CSS（＋WAAPI極小） | 追加コスト0（コンポジタ） | 最小 |
| **2** | 到着セレモニーの余韻（B ピンのリップル / C 座標ロックの余韻） | 既存driveCeremony微調整＋CSS | 微 | 小 |
| **3** | 動画→Hero Dissolve+Scale（E・**Hero側**Ken Burns / `fx.heroScaleIn`） | WAAPI compositor | 微 | 小（タイミング不変を検証） |
| **4** | reduced-motion の自然な代替（H） | CSS＋分岐 | なし | 小（reduced時のみ） |
| **5** | iPhone/PC 見え方の統一（G） | CSSブレークポイント | なし〜微 | 中（PC見え方変更） |
| **6** | 総回帰＋ブランド最終調整 | 検証中心 | — | — |

- **D（地図→動画接続）は原則見送り**（保護不変=タイミングに近い）。必要ならStep3でzero-timing-riskの範囲のみ。
- 推奨順: **1→2→3→4→5→6**（低リスク・高効果順）。各Step完了時に 変更ファイル/見た目差分/性能(JS・CSSサイズ, init, seek, rAF, GC)/iPhone体感/travel-17保護不変の維持/rollback を報告。

---

## 4. 全Step共通の担保
- 保護不変（timing/動画区間/画質/arrivalEase:false）に触れない。触れる必要が出た項目は**そのStepで実装せず代替案提示**。
- 追加演出は `cfg.fx.*` トグルで**既定新・旧に戻せる**＝config互換・rollback容易。
- 毎フレームJS/割当を増やさない。重いfilter/backdrop-blurを新規追加しない。初期表示(LCP/CLS)に影響する要素を足さない。

## 5. 要相談
1. Step分解（上記6分割）と**推奨順1→2→3…**でよいか
2. E（Hero側Scale）の方向でよいか（動画は不触＝以前の軟化を回避）
3. D（地図→動画接続）は**見送り**でよいか
4. 特に優先したい/後回しにしたい項目があるか
