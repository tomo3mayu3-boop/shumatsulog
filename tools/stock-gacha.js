"use strict";

/* ============================================================
   株ガチャψ — 「知らない銘柄との出会いをゲーム化する」ツール
   ------------------------------------------------------------
   投資助言・銘柄の優劣付け・スコアリングは行わない。
   本番（Cloudflare Pages）のCSPが script-src 'self' のため、
   インラインではなく外部ファイルとして配置している。

   ■ モジュール構成（すべてこのファイル内・読み込み順に依存あり）
     GachaStore   … localStorage管理（安全な読み書き・キー一覧）
     GachaData    … 銘柄データ（CSV/JSON化はここだけ差し替える）
     GachaLottery … 抽選（フィルター・ランダム抽出）
     GachaEvents  … 季節イベント管理（期間判定 → 演出切替）
     GachaDex     … 演出図鑑・実績の記録（UIは将来実装）
     GachaFX      … 演出エンジン（ビート・バナー・待機・背景）
     GachaHistory … 出現履歴（＋将来の出現ランキング用の集計）
     GachaUI      … 結果カード・コメント・メモの描画
     GachaApp     … 全体の進行役（初期化・ガチャ実行・拡張フック）

   ■ 将来機能の拡張ポイント
     図鑑・実績・今日のガチャ → GachaApp.hooks.afterRoll に関数を登録
       （毎回のガチャ結果 {picked, effectType} を受け取れる）
     季節イベント → GachaEvents.SCHEDULE に期間を1行追加し、
       GachaFX.builders に演出を1関数追加するだけ
     出現ランキング → GachaHistory.topAppearances(n) が集計を返す
     今日のガチャ → GachaLottery.pickRandom(list, count, rng) の
       rng に日付シードの乱数関数を渡せば同日同結果にできる
     演出図鑑 → GachaDex.get() が「見た演出・回数・初回/最終日時」を返す
   ============================================================ */

/* ============================================================
   GachaStore — localStorage管理
   プライベートモード等で使えない環境でも、ガチャ本体は
   止まらないよう、すべて try/catch で包む。
   ============================================================ */
var GachaStore = (function () {
  // 保存キーは変更しない（既存ユーザーのデータを引き継ぐため）
  var KEYS = {
    HISTORY: "stockGachaHistory",          // 出現履歴
    MEMO: "stockGachaMemos",               // 銘柄ごとの一言メモ
    DEX: "stockGachaDex",                  // 見た演出の記録（将来の「演出図鑑」用）
    COLLECTION: "stockGachaCollection",    // 発見した銘柄（図鑑）
    STATS: "stockGachaStats",              // 回数などの累計（実績の判定材料）
    ACHIEVEMENTS: "stockGachaAchievements" // 解除済み実績（id→解除日時）
  };

  function available() {
    try {
      var testKey = "__stockGachaTest__";
      window.localStorage.setItem(testKey, "1");
      window.localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  }

  function load(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function save(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* 保存できなくても何もしない（ガチャ自体は継続） */
    }
  }

  function remove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (e) {
      /* 同上 */
    }
  }

  return { KEYS: KEYS, available: available, load: load, save: save, remove: remove };
})();

/* ============================================================
   GachaData — 銘柄データ
   実在する代表的な銘柄を中心にしたサンプル。
   市場区分・業種は作成時点の目安であり、正確性は保証しない。
   CSV/JSON読み込み版に拡張する場合は getAll() の中身だけを
   「読み込んで同じ形の配列を返す処理」に差し替えればよい。
   ============================================================ */
var GachaData = (function () {
  var SAMPLE_STOCKS = [
    // --- 個別株（プライム） ---
    { code: "7203", name: "トヨタ自動車",             market: "プライム",     sector: "輸送用機器",   type: "個別株" },
    { code: "7267", name: "ホンダ",                   market: "プライム",     sector: "輸送用機器",   type: "個別株" },
    { code: "6902", name: "デンソー",                 market: "プライム",     sector: "輸送用機器",   type: "個別株" },
    { code: "6758", name: "ソニーグループ",           market: "プライム",     sector: "電気機器",     type: "個別株" },
    { code: "6501", name: "日立製作所",               market: "プライム",     sector: "電気機器",     type: "個別株" },
    { code: "6861", name: "キーエンス",               market: "プライム",     sector: "電気機器",     type: "個別株" },
    { code: "8035", name: "東京エレクトロン",         market: "プライム",     sector: "電気機器",     type: "個別株" },
    { code: "6954", name: "ファナック",               market: "プライム",     sector: "電気機器",     type: "個別株" },
    { code: "6594", name: "ニデック",                 market: "プライム",     sector: "電気機器",     type: "個別株" },
    { code: "6971", name: "京セラ",                   market: "プライム",     sector: "電気機器",     type: "個別株" },
    { code: "9432", name: "日本電信電話",             market: "プライム",     sector: "情報・通信業", type: "個別株" },
    { code: "9433", name: "KDDI",                     market: "プライム",     sector: "情報・通信業", type: "個別株" },
    { code: "9984", name: "ソフトバンクグループ",     market: "プライム",     sector: "情報・通信業", type: "個別株" },
    { code: "9613", name: "NTTデータグループ",        market: "プライム",     sector: "情報・通信業", type: "個別株" },
    { code: "8306", name: "三菱UFJフィナンシャル・グループ", market: "プライム", sector: "銀行業",   type: "個別株" },
    { code: "8316", name: "三井住友フィナンシャルグループ", market: "プライム", sector: "銀行業",    type: "個別株" },
    { code: "8766", name: "東京海上ホールディングス", market: "プライム",     sector: "保険業",       type: "個別株" },
    { code: "8591", name: "オリックス",               market: "プライム",     sector: "その他金融業", type: "個別株" },
    { code: "8058", name: "三菱商事",                 market: "プライム",     sector: "卸売業",       type: "個別株" },
    { code: "8001", name: "伊藤忠商事",               market: "プライム",     sector: "卸売業",       type: "個別株" },
    { code: "8031", name: "三井物産",                 market: "プライム",     sector: "卸売業",       type: "個別株" },
    { code: "9983", name: "ファーストリテイリング",   market: "プライム",     sector: "小売業",       type: "個別株" },
    { code: "3382", name: "セブン＆アイ・ホールディングス", market: "プライム", sector: "小売業",     type: "個別株" },
    { code: "9843", name: "ニトリホールディングス",   market: "プライム",     sector: "小売業",       type: "個別株" },
    { code: "4063", name: "信越化学工業",             market: "プライム",     sector: "化学",         type: "個別株" },
    { code: "4452", name: "花王",                     market: "プライム",     sector: "化学",         type: "個別株" },
    { code: "4901", name: "富士フイルムホールディングス", market: "プライム", sector: "化学",         type: "個別株" },
    { code: "4502", name: "武田薬品工業",             market: "プライム",     sector: "医薬品",       type: "個別株" },
    { code: "4568", name: "第一三共",                 market: "プライム",     sector: "医薬品",       type: "個別株" },
    { code: "4519", name: "中外製薬",                 market: "プライム",     sector: "医薬品",       type: "個別株" },
    { code: "2914", name: "日本たばこ産業",           market: "プライム",     sector: "食料品",       type: "個別株" },
    { code: "2802", name: "味の素",                   market: "プライム",     sector: "食料品",       type: "個別株" },
    { code: "7974", name: "任天堂",                   market: "プライム",     sector: "その他製品",   type: "個別株" },
    { code: "6098", name: "リクルートホールディングス", market: "プライム",   sector: "サービス業",   type: "個別株" },
    { code: "4661", name: "オリエンタルランド",       market: "プライム",     sector: "サービス業",   type: "個別株" },
    { code: "9020", name: "東日本旅客鉄道",           market: "プライム",     sector: "陸運業",       type: "個別株" },
    { code: "9022", name: "東海旅客鉄道",             market: "プライム",     sector: "陸運業",       type: "個別株" },
    { code: "9101", name: "日本郵船",                 market: "プライム",     sector: "海運業",       type: "個別株" },
    { code: "5401", name: "日本製鉄",                 market: "プライム",     sector: "鉄鋼",         type: "個別株" },
    { code: "6367", name: "ダイキン工業",             market: "プライム",     sector: "機械",         type: "個別株" },
    { code: "6273", name: "SMC",                      market: "プライム",     sector: "機械",         type: "個別株" },
    { code: "7011", name: "三菱重工業",               market: "プライム",     sector: "機械",         type: "個別株" },
    { code: "7741", name: "HOYA",                     market: "プライム",     sector: "精密機器",     type: "個別株" },
    { code: "5108", name: "ブリヂストン",             market: "プライム",     sector: "ゴム製品",     type: "個別株" },
    { code: "8801", name: "三井不動産",               market: "プライム",     sector: "不動産業",     type: "個別株" },

    // --- 個別株（スタンダード） ---
    { code: "7564", name: "ワークマン",               market: "スタンダード", sector: "小売業",       type: "個別株" },
    { code: "2782", name: "セリア",                   market: "スタンダード", sector: "小売業",       type: "個別株" },
    { code: "4816", name: "東映アニメーション",       market: "スタンダード", sector: "情報・通信業", type: "個別株" },
    { code: "2208", name: "ブルボン",                 market: "スタンダード", sector: "食料品",       type: "個別株" },
    { code: "2668", name: "タビオ",                   market: "スタンダード", sector: "繊維製品",     type: "個別株" },

    // --- 個別株（グロース） ---
    { code: "4478", name: "フリー",                   market: "グロース",     sector: "情報・通信業", type: "個別株" },
    { code: "5253", name: "カバー",                   market: "グロース",     sector: "情報・通信業", type: "個別株" },
    { code: "4375", name: "セーフィー",               market: "グロース",     sector: "情報・通信業", type: "個別株" },
    { code: "9348", name: "ispace",                   market: "グロース",     sector: "サービス業",   type: "個別株" },
    { code: "5595", name: "QPS研究所",                market: "グロース",     sector: "サービス業",   type: "個別株" },
    { code: "215A", name: "タイミー",                 market: "グロース",     sector: "サービス業",   type: "個別株" },

    // --- ETF（市場区分は「東証」として扱う） ---
    { code: "1306", name: "NEXT FUNDS TOPIX連動型上場投信",       market: "東証", sector: "指数連動型", type: "ETF" },
    { code: "1321", name: "NEXT FUNDS 日経225連動型上場投信",     market: "東証", sector: "指数連動型", type: "ETF" },
    { code: "2559", name: "MAXIS全世界株式上場投信",              market: "東証", sector: "指数連動型", type: "ETF" },
    { code: "1655", name: "iシェアーズ S&P500 米国株ETF",         market: "東証", sector: "指数連動型", type: "ETF" },
    { code: "1343", name: "NEXT FUNDS 東証REIT指数連動型上場投信", market: "東証", sector: "指数連動型", type: "ETF" },

    // --- REIT ---
    { code: "8951", name: "日本ビルファンド投資法人",         market: "東証", sector: "不動産投資信託", type: "REIT" },
    { code: "8952", name: "ジャパンリアルエステイト投資法人", market: "東証", sector: "不動産投資信託", type: "REIT" },
    { code: "3269", name: "アドバンス・レジデンス投資法人",   market: "東証", sector: "不動産投資信託", type: "REIT" },
    { code: "8960", name: "ユナイテッド・アーバン投資法人",   market: "東証", sector: "不動産投資信託", type: "REIT" },
    { code: "8984", name: "大和ハウスリート投資法人",         market: "東証", sector: "不動産投資信託", type: "REIT" }
  ];

  function getAll() {
    return SAMPLE_STOCKS;
  }

  /* データ内の業種一覧（登場順・重複なし）。業種フィルターの選択肢に使う */
  function sectors() {
    var seen = {};
    var list = [];
    getAll().forEach(function (s) {
      if (!seen[s.sector]) {
        seen[s.sector] = true;
        list.push(s.sector);
      }
    });
    return list;
  }

  /* 図鑑ナンバー（データ内の通し番号・1始まり）。"No.007" 形式で返す */
  var numberMap = null;
  function numberOf(code) {
    if (!numberMap) {
      numberMap = {};
      getAll().forEach(function (s, i) { numberMap[s.code] = i + 1; });
    }
    var n = numberMap[code];
    if (!n) return "";
    return "No." + (n < 10 ? "00" : (n < 100 ? "0" : "")) + n;
  }

  return { getAll: getAll, sectors: sectors, numberOf: numberOf };
})();

/* ============================================================
   GachaLottery — 抽選
   フィルターとランダム抽出だけを担当する純粋なロジック。
   演出・描画・保存には一切関知しない。
   ============================================================ */
var GachaLottery = (function () {

  function applyFilters(stocks, filters) {
    return stocks.filter(function (s) {
      if (filters.market && s.market !== filters.market) return false;
      if (filters.sector && s.sector !== filters.sector) return false;
      if (filters.type && s.type !== filters.type) return false;
      if (filters.excludeFund && (s.type === "ETF" || s.type === "REIT")) return false;
      return true;
    });
  }

  /* Fisher–Yates シャッフルの部分実行で、重複なく count 件選ぶ。
     rng は省略時 Math.random。将来「今日のガチャ」を作るときは
     日付シードの乱数関数を渡せば、同じ日は同じ結果にできる。 */
  function pickRandom(list, count, rng) {
    var random = rng || Math.random;
    var pool = list.slice();
    var n = Math.min(count, pool.length);
    for (var i = 0; i < n; i++) {
      var j = i + Math.floor(random() * (pool.length - i));
      var tmp = pool[i];
      pool[i] = pool[j];
      pool[j] = tmp;
    }
    return pool.slice(0, n);
  }

  return { applyFilters: applyFilters, pickRandom: pickRandom };
})();

/* ============================================================
   GachaEvents — 季節イベント管理
   SCHEDULE に期間（"MM-DD"）とイベント演出のidを並べるだけで、
   期間中はその演出が抽選候補に入る（GachaFX.chooseType が参照）。
   年またぎ（12-26〜01-05 等）にも対応。
   ============================================================ */
var GachaEvents = (function () {
  /* 季節イベントの期間表。期間中は chance の確率でイベント演出が出る
     （通常のビート群の枠と置き換わる。銘柄の抽選には影響しない）。
     バナー付き演出なので、頻度は控えめの6%にしてある */
  var SCHEDULE = [
    { id: "tanabata",  start: "07-01", end: "07-07", effect: "tanabata",  chance: 0.06 },
    { id: "halloween", start: "10-25", end: "10-31", effect: "halloween", chance: 0.06 },
    { id: "christmas", start: "12-20", end: "12-25", effect: "christmas", chance: 0.06 },
    { id: "newyear",   start: "12-31", end: "01-03", effect: "newyear",   chance: 0.06 }
  ];

  /* 今日が期間内のイベントを返す（なければ null）。now はテスト用 */
  function getActiveEvent(now) {
    var d = now || new Date();
    function pad(n) { return (n < 10 ? "0" : "") + n; }
    var today = pad(d.getMonth() + 1) + "-" + pad(d.getDate());
    for (var i = 0; i < SCHEDULE.length; i++) {
      var ev = SCHEDULE[i];
      if (ev.start <= ev.end) {
        if (today >= ev.start && today <= ev.end) return ev;
      } else {
        // 年またぎ（例: 12-26〜01-05）
        if (today >= ev.start || today <= ev.end) return ev;
      }
    }
    return null;
  }

  return { SCHEDULE: SCHEDULE, getActiveEvent: getActiveEvent };
})();

/* ============================================================
   GachaDex — 演出図鑑・実績の記録
   見た演出を localStorage に「回数・初回・最終」で記録する。
   UIは未実装だが、データは今から集めておく。
   実績（○回回した、全演出コンプ等）を作るときもこのモジュールに
   カウンタを足し、GachaApp.hooks.afterRoll から更新すればよい。
   ============================================================ */
var GachaDex = (function () {
  /* 演出の表示名。イベント演出を追加したらここに1行足す */
  var EFFECT_INFO = {
    normal:       { name: "通常ビート" },
    beet_group:   { name: "ビート群" },
    beet_storm:   { name: "ビート嵐" },
    golden_storm: { name: "黄金ビート嵐" },
    tanabata:     { name: "七夕ビート" },
    halloween:    { name: "ハロウィンビート" },
    christmas:    { name: "クリスマスビート" },
    newyear:      { name: "新春ビート" }
  };

  /* 記録に失敗してもガチャ自体は止めない */
  function recordEffectSeen(typeId) {
    try {
      var dex = GachaStore.load(GachaStore.KEYS.DEX, {});
      if (typeof dex !== "object" || dex === null) dex = {};
      var now = Date.now();
      var entry = dex[typeId] || { count: 0, firstSeen: now };
      entry.count = (typeof entry.count === "number" ? entry.count : 0) + 1;
      entry.lastSeen = now;
      if (!entry.firstSeen) entry.firstSeen = now;
      dex[typeId] = entry;
      GachaStore.save(GachaStore.KEYS.DEX, dex);
    } catch (e) { /* 図鑑記録は必須ではないので無視 */ }
  }

  /* 演出図鑑UIを作るときはこれを呼ぶ */
  function get() {
    var dex = GachaStore.load(GachaStore.KEYS.DEX, {});
    return (typeof dex === "object" && dex !== null) ? dex : {};
  }

  /* ---------- 銘柄図鑑（発見した銘柄の記録） ----------
     形式: { "7203": { firstSeen: エポックms, count: 出現回数 }, ... }
     将来「図鑑一覧」を作るときは getCollection() をUIから読むだけでよい */

  /* 記録して、今回「初めて発見した」銘柄コードの配列を返す
     （NEWバッジの表示判定に使う） */
  function recordStocks(stocks) {
    var newlyFound = [];
    try {
      var col = getCollection();
      var now = Date.now();
      stocks.forEach(function (s) {
        var entry = col[s.code];
        if (entry) {
          entry.count = (typeof entry.count === "number" ? entry.count : 0) + 1;
        } else {
          col[s.code] = { firstSeen: now, count: 1 };
          newlyFound.push(s.code);
        }
      });
      GachaStore.save(GachaStore.KEYS.COLLECTION, col);
    } catch (e) { /* 図鑑記録は必須ではないので無視 */ }
    return newlyFound;
  }

  function getCollection() {
    var col = GachaStore.load(GachaStore.KEYS.COLLECTION, {});
    return (typeof col === "object" && col !== null) ? col : {};
  }

  /* 発見した銘柄数（現在のデータに存在するものだけ数える。
     データ入替でコードが消えても「n / 総数」が矛盾しないように） */
  function countDiscoveredStocks() {
    var col = getCollection();
    var n = 0;
    GachaData.getAll().forEach(function (s) {
      if (col[s.code]) n++;
    });
    return n;
  }

  /* 発見した業種数（発見済み銘柄の業種を現在のデータから逆引き） */
  function countDiscoveredSectors() {
    var col = getCollection();
    var seen = {};
    var n = 0;
    GachaData.getAll().forEach(function (s) {
      if (col[s.code] && !seen[s.sector]) {
        seen[s.sector] = true;
        n++;
      }
    });
    return n;
  }

  /* ---------- 累計（実績の判定材料） ----------
     形式: { rolls: ガチャを回した累計回数 } */

  function recordRoll() {
    try {
      var stats = getStats();
      stats.rolls = (typeof stats.rolls === "number" ? stats.rolls : 0) + 1;
      GachaStore.save(GachaStore.KEYS.STATS, stats);
    } catch (e) { /* 同上 */ }
  }

  function getStats() {
    var stats = GachaStore.load(GachaStore.KEYS.STATS, {});
    return (typeof stats === "object" && stats !== null) ? stats : {};
  }

  /* ---------- 実績 ----------
     定義を1行足せば新しい実績になる。check は
     { stats, effects, collection } を受け取って true/false を返す。
     解除済みは { id: 解除日時 } で保存（将来「実績一覧」で使う） */
  var ACHIEVEMENTS = [
    { id: "first_roll", name: "初ガチャ",
      check: function (c) { return (c.stats.rolls || 0) >= 1; } },
    { id: "rolls_10", name: "10回ガチャ",
      check: function (c) { return (c.stats.rolls || 0) >= 10; } },
    { id: "rolls_50", name: "50回ガチャ",
      check: function (c) { return (c.stats.rolls || 0) >= 50; } },
    { id: "rolls_100", name: "100回ガチャ",
      check: function (c) { return (c.stats.rolls || 0) >= 100; } },
    { id: "saw_group", name: "ビート群を見た",
      check: function (c) { return !!c.effects.beet_group; } },
    { id: "saw_golden", name: "黄金ビート嵐を見た",
      check: function (c) { return !!c.effects.golden_storm; } },
    { id: "saw_event", name: "季節の演出を見た",
      check: function (c) {
        return !!(c.effects.tanabata || c.effects.halloween ||
                  c.effects.christmas || c.effects.newyear);
      } }
  ];

  /* 未解除の実績を判定し、新たに解除されたものを返す */
  function checkAchievements() {
    var newly = [];
    try {
      var unlocked = getAchievements();
      var ctx = { stats: getStats(), effects: get(), collection: getCollection() };
      ACHIEVEMENTS.forEach(function (a) {
        if (!unlocked[a.id] && a.check(ctx)) {
          unlocked[a.id] = Date.now();
          newly.push(a);
        }
      });
      if (newly.length > 0) GachaStore.save(GachaStore.KEYS.ACHIEVEMENTS, unlocked);
    } catch (e) { /* 同上 */ }
    return newly;
  }

  function getAchievements() {
    var a = GachaStore.load(GachaStore.KEYS.ACHIEVEMENTS, {});
    return (typeof a === "object" && a !== null) ? a : {};
  }

  function countAchievements() {
    var unlocked = getAchievements();
    var n = 0;
    ACHIEVEMENTS.forEach(function (a) { if (unlocked[a.id]) n++; });
    return n;
  }

  return {
    EFFECT_INFO: EFFECT_INFO,
    recordEffectSeen: recordEffectSeen,
    get: get,
    recordStocks: recordStocks,
    getCollection: getCollection,
    countDiscoveredStocks: countDiscoveredStocks,
    countDiscoveredSectors: countDiscoveredSectors,
    recordRoll: recordRoll,
    getStats: getStats,
    ACHIEVEMENTS: ACHIEVEMENTS,
    checkAchievements: checkAchievements,
    getAchievements: getAchievements,
    countAchievements: countAchievements
  };
})();

/* ============================================================
   GachaFX — 演出エンジン
   演出は「種類」ごとにパーティクル仕様を返すビルダー関数で定義。
     normal / beet_group / beet_storm / golden_storm
   イベント演出は builders に1関数追加し、GachaEvents.SCHEDULE に
   期間を書くだけで抽選候補に入る。
   バナー（finale）・待機メッセージ・暖色背景はデータ差し替えで
   使い回せる共通コンポーネント。
   ※演出は見た目だけのもので、銘柄の抽選結果には一切影響しない。
   ============================================================ */
var GachaFX = (function () {

  /* 演出の出現率など（コンソールから調整して動作確認できる） */
  var config = {
    GOLDEN_CHANCE: 0.001, // 黄金ビート嵐（超々レア・フィナーレバナー付き）
    STORM_CHANCE: 0.01,   // ビート嵐（超レア・約30個）
    GROUP_CHANCE: 0.15,   // ビート群（レア）
    EMOJI: "🫜",
    SOUND_TEXT: " ﾋﾞｭｰﾝ"
  };

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  /* 1粒分の仕様を作る。
     開始位置は「上端のどこか」or「右端のどこか」。どちらも画面外から入る。
     深度 depth（0=奥 〜 1=手前）を1つ引き、そこから
     大きさ(scale 0.6〜1.6)・濃さ(opacity)・速度（手前ほど速い）を
     連動して決めることで、自然な流星群の遠近感を出す */
  function buildParticle(opts) {
    var fromTop = Math.random() < 0.5;
    var depth = Math.random();
    var scale = 0.6 + depth; // 0.6〜1.6
    return {
      emoji: opts.emoji,
      text: opts.text || "",
      shiftX: fromTop ? -rand(0, opts.spread) : 0,       // vw（左へずらす＝上端の途中から）
      shiftY: fromTop ? 0 : rand(0, opts.spread * 0.6),  // vh（下へずらす＝右端の途中から）
      delay: rand(0, opts.maxDelay || 0),                // 秒
      duration: opts.maxDur - depth * (opts.maxDur - opts.minDur), // 手前(大)ほど速い
      size: Math.round(opts.baseSize * scale),           // px（CSS側でスマホ上限あり）
      opacity: +(0.55 + depth * 0.45).toFixed(2),        // 奥ほど薄い
      rot: Math.round(rand(-720, 720)),                  // 飛行中の総回転量（速度もランダムになる）
      sparkles: opts.sparkles || 0                       // 通過あとに残す✨の数
    };
  }

  /* フィナーレバナーの共通データを作る。
     イベント演出は icon / lead / main / loading / color / bg / glow を
     渡すだけで見た目を差し替えられる。 */
  function makeFinale(opts) {
    opts = opts || {};
    // loading は文字列でも配列でもよい。配列なら毎回ランダムに1つ選ぶ
    // （何度回しても少し新鮮＝「もう一回」に効く）。
    var loading = (opts.loading != null) ? opts.loading : "未知の銘柄を探索中...";
    if (Array.isArray(loading)) {
      loading = loading[Math.floor(Math.random() * loading.length)];
    }
    return {
      icon: opts.icon || "🌈",
      lead: opts.lead || "",                  // 小さめの前置き（無くてよい）
      main: opts.main || opts.text || "",     // 主役の大きな文字
      loading: loading,                       // バナー後の待機メッセージ
      color: opts.color || null,              // 文字色（未指定なら既定）
      bg: opts.bg || null,                    // 下地パネル色
      glow: opts.glow || null                 // text-shadow（発光）
    };
  }

  var builders = {
    normal: function () {
      return { particles: [buildParticle({
        emoji: config.EMOJI, text: config.SOUND_TEXT,
        spread: 15, minDur: 0.8, maxDur: 1.2, baseSize: 40, sparkles: 3
      })] };
    },
    beet_group: function () {
      var n = 5 + Math.floor(Math.random() * 6); // 5〜10個
      var list = [];
      for (var i = 0; i < n; i++) {
        list.push(buildParticle({
          emoji: config.EMOJI,
          spread: 40, maxDelay: 0.35, minDur: 0.7, maxDur: 1.1, baseSize: 40, sparkles: 2
        }));
      }
      return { particles: list };
    },
    beet_storm: function () {
      var n = 28 + Math.floor(Math.random() * 5); // 28〜32個
      var list = [];
      for (var i = 0; i < n; i++) {
        list.push(buildParticle({
          emoji: config.EMOJI,
          spread: 60, maxDelay: 0.7, minDur: 0.8, maxDur: 1.3, baseSize: 40, sparkles: 1
        }));
      }
      return { particles: list };
    },
    golden_storm: function () {
      var n = 28 + Math.floor(Math.random() * 5); // 28〜32個
      var list = [];
      for (var i = 0; i < n; i++) {
        list.push(buildParticle({
          emoji: "✨🫜✨",
          // 超レアなのでキラキラをほんの少し増やす
          spread: 60, maxDelay: 0.7, minDur: 0.8, maxDur: 1.3, baseSize: 40, sparkles: 3
        }));
      }
      // 全粒が流れ終わったあと中央にバナー→待機メッセージ→結果表示。
      // warmBg: true で演出中だけ画面全体をほんのり暖色にする
      return {
        particles: list,
        warmBg: true,
        finale: makeFinale({
          icon: "🌈",
          lead: "SUPER",
          main: "BEET STORM!!",
          loading: ["未知の銘柄を探索中...", "市場をスキャン中...", "銘柄を抽選中..."],
          glow: "0 0 12px rgba(255,205,60,0.95), 0 0 34px rgba(255,205,60,0.6)"
        })
      };
    },

    /* ---- 季節イベント演出（GachaEvents.SCHEDULE の期間中だけ出る） ---- */
    tanabata: function () {
      return eventStorm("🎋", {
        icon: "🎋", lead: "HAPPY", main: "TANABATA!!",
        loading: ["星に願いを記入中...", "天の川をスキャン中..."],
        color: "#3a5a7a", bg: "rgba(235,242,250,0.9)",
        glow: "0 0 12px rgba(120,180,255,0.8), 0 0 30px rgba(255,230,120,0.5)"
      });
    },
    halloween: function () {
      return eventStorm("🎃", {
        icon: "🎃", lead: "HAPPY", main: "HALLOWEEN!!",
        loading: ["お菓子を選定中...", "夜の市場を探索中..."],
        color: "#7a3b00", bg: "rgba(255,244,230,0.9)",
        glow: "0 0 12px rgba(255,140,0,0.8), 0 0 30px rgba(120,40,160,0.5)"
      });
    },
    christmas: function () {
      return eventStorm("🎄", {
        icon: "🎄", lead: "MERRY", main: "CHRISTMAS!!",
        loading: ["プレゼントを包装中...", "聖夜の市場を探索中..."],
        color: "#1f5c3d", bg: "rgba(240,248,242,0.92)",
        glow: "0 0 12px rgba(220,60,60,0.7), 0 0 30px rgba(80,180,120,0.5)"
      });
    },
    newyear: function () {
      return eventStorm("🎍", {
        icon: "🎍", lead: "HAPPY", main: "NEW YEAR!!",
        loading: ["初夢を集計中...", "新春の市場を探索中..."],
        color: "#8a3a3a", bg: "rgba(252,244,238,0.92)",
        glow: "0 0 12px rgba(230,180,80,0.85), 0 0 30px rgba(220,80,80,0.45)"
      });
    }
  };

  /* イベント演出の共通形: テーマ絵文字が10〜16個流れて、
     バナー→待機→結果になる（黄金ビート嵐より少し控えめ） */
  function eventStorm(emoji, finaleOpts) {
    var n = 10 + Math.floor(Math.random() * 7); // 10〜16個
    var list = [];
    for (var i = 0; i < n; i++) {
      list.push(buildParticle({
        emoji: emoji,
        spread: 50, maxDelay: 0.5, minDur: 0.8, maxDur: 1.2, baseSize: 40, sparkles: 2
      }));
    }
    return { particles: list, warmBg: true, finale: makeFinale(finaleOpts) };
  }

  /* どの演出を出すか決める（レアな順に判定）。
     季節イベント期間中は、ビート群の枠がイベント演出に置き換わる。
     ※演出の抽選であって、銘柄の抽選には一切影響しない */
  function chooseType() {
    var r = Math.random();
    if (r < config.GOLDEN_CHANCE) return "golden_storm";
    if (r < config.GOLDEN_CHANCE + config.STORM_CHANCE) return "beet_storm";
    var ev = GachaEvents.getActiveEvent();
    if (ev && builders[ev.effect]) {
      var evChance = (typeof ev.chance === "number") ? ev.chance : config.GROUP_CHANCE;
      if (r < config.GOLDEN_CHANCE + config.STORM_CHANCE + evChance) return ev.effect;
      return "normal";
    }
    if (r < config.GOLDEN_CHANCE + config.STORM_CHANCE + config.GROUP_CHANCE) return "beet_group";
    return "normal";
  }

  /* 演出を再生し、終わったら done(演出id) を呼ぶ。戻り値も同じid。
     （doneが同期で呼ばれる環境でも演出idを確実に受け取れるよう、
       戻り値ではなくコールバック引数で渡す）
     prefers-reduced-motion: reduce の場合は演出せず即 done()。 */
  function play(done) {
    var type = chooseType();
    GachaDex.recordEffectSeen(type); // 演出図鑑（将来）用に記録

    var reduceMotion = window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      done(type);
      return type;
    }

    var builder = builders[type] || builders.normal;
    var spec = builder();
    if (Array.isArray(spec)) spec = { particles: spec }; // 配列を返すビルダーも許容

    // 粒・✨はすべて専用レイヤーに入れ、終了時にレイヤーごと削除する（残留DOMなし）
    var layer = document.createElement("div");
    layer.className = "gacha-fx-layer";
    layer.setAttribute("aria-hidden", "true"); // 装飾なのでスクリーンリーダーには読ませない

    var flightsLeft = spec.particles.length;
    var maxEndMs = 0; // 粒と✨すべての終了時刻（保険タイマー用）

    spec.particles.forEach(function (p) {
      var el = document.createElement("span");
      el.className = "gacha-fx";
      var emoji = document.createElement("span");
      emoji.className = "fx-emoji";
      emoji.textContent = p.emoji;
      el.appendChild(emoji);
      if (p.text) {
        var t = document.createElement("span");
        t.className = "fx-text";
        t.textContent = p.text;
        el.appendChild(t);
      }
      el.style.setProperty("--fx-shift-x", p.shiftX + "vw");
      el.style.setProperty("--fx-shift-y", p.shiftY + "vh");
      el.style.setProperty("--fx-delay", p.delay + "s");
      el.style.setProperty("--fx-duration", p.duration + "s");
      el.style.setProperty("--fx-size", p.size + "px");
      el.style.setProperty("--fx-opacity", p.opacity);
      el.style.setProperty("--fx-rot", p.rot + "deg");
      layer.appendChild(el);
      maxEndMs = Math.max(maxEndMs, (p.delay + p.duration) * 1000);

      // ✨: 飛行経路上の点に、粒が通過するタイミングで一瞬だけ出す
      for (var i = 0; i < p.sparkles; i++) {
        var f = rand(0.2, 0.75); // 経路上の位置（0=開始側）
        var sp = document.createElement("span");
        sp.className = "gacha-sparkle";
        sp.textContent = "✨";
        sp.style.setProperty("--sp-x", (100 + p.shiftX - f * 105).toFixed(1) + "vw");
        sp.style.setProperty("--sp-y", (-5 + p.shiftY + f * 105).toFixed(1) + "vh");
        sp.style.setProperty("--sp-delay", (p.delay + f * p.duration).toFixed(2) + "s");
        sp.style.setProperty("--sp-size", Math.round(p.size * 0.35 + 6) + "px");
        layer.appendChild(sp);
        maxEndMs = Math.max(maxEndMs, (p.delay + f * p.duration + 0.6) * 1000);
      }
    });

    var FINALE_MS = 3000;  // 中央バナーの表示時間。CSS側 bannerPop の長さ(3s)と合わせること
    var LOADING_MS = 450;  // 待機メッセージの表示時間（0.3〜0.5秒）

    var doneCalled = false;
    var finaleShown = false;
    var banner = null;      // フィナーレバナー（粒レイヤーとは別に body 直下へ付ける）
    var loadingEl = null;   // 待機メッセージ
    var warmEl = null;      // 画面全体の暖色オーバーレイ（超レア時のみ）
    var timers = [];

    function removeNode(n) { if (n && n.parentNode) n.parentNode.removeChild(n); }

    // 暖色オーバーレイ: 開始でふわっと点け、結果表示に合わせて白へ戻す。
    // 点灯/消灯ともCSSアニメーションなので、背景タブでも確実に動く。
    function startWarm() {
      warmEl = document.createElement("div");
      warmEl.className = "gacha-warm"; // warmIn が自動再生され opacity 1 で保持
      document.body.appendChild(warmEl);
    }
    function endWarm() {
      if (!warmEl) return;
      var w = warmEl; warmEl = null;
      w.classList.add("is-off"); // warmOut で0.3秒かけて白へ戻す
      // 独立タイマーで削除（cleanupAllのclearTimeoutの影響を受けない）
      window.setTimeout(function () { removeNode(w); }, 350);
    }

    function callDone() {
      if (doneCalled) return; // 二重呼び出し防止
      doneCalled = true;
      endWarm();  // 結果カード召喚に合わせて暖色を白へ戻す
      done(type);
    }
    function cleanupAll() {
      timers.forEach(function (t) { window.clearTimeout(t); });
      removeNode(layer);
      removeNode(banner);
      removeNode(loadingEl);
      endWarm(); // 念のため（通常は callDone で戻し済み）
    }

    // バナーが消えたあと、短い待機メッセージを挟んでから結果を出す
    function showLoadingThenDone(text) {
      removeNode(banner);
      if (!text) { callDone(); cleanupAll(); return; }
      loadingEl = document.createElement("div");
      loadingEl.className = "gacha-fx-loading";
      loadingEl.textContent = text;
      document.body.appendChild(loadingEl);
      timers.push(window.setTimeout(function () {
        callDone();
        cleanupAll();
      }, LOADING_MS));
    }

    function showFinale() {
      if (finaleShown) return; // 二重表示防止
      finaleShown = true;
      var f = spec.finale;
      banner = document.createElement("div");
      banner.className = "gacha-fx-banner";
      // 色・背景・発光はデータから差し替え（イベント演出の拡張点）
      if (f.color) banner.style.setProperty("--banner-color", f.color);
      if (f.bg)    banner.style.setProperty("--banner-bg", f.bg);
      if (f.glow)  banner.style.setProperty("--banner-glow", f.glow);
      var icon = document.createElement("span");
      icon.className = "banner-icon";
      icon.textContent = f.icon;
      banner.appendChild(icon);
      if (f.lead) {
        var lead = document.createElement("span");
        lead.className = "banner-lead";
        lead.textContent = f.lead;
        banner.appendChild(lead);
      }
      var main = document.createElement("span");
      main.className = "banner-main";
      main.textContent = f.main;
      banner.appendChild(main);
      // 粒レイヤーの削除タイミングに左右されないよう body 直下に付ける
      document.body.appendChild(banner);
      // 実機で発火を確認できるように1行だけログ（超レア演出時のみ）
      if (window.console && console.info) console.info("[gacha] finale banner shown");
      // 粒レイヤーはもう不要なので先に片付ける（バナーは残す）
      removeNode(layer);
      // 表示（約3秒でフェードアウト）→待機メッセージ→結果表示
      timers.push(window.setTimeout(function () {
        showLoadingThenDone(f.loading);
      }, FINALE_MS));
    }

    // animationendはバブリングするのでレイヤーで一括受信。
    // finale なしの演出では、全粒が流れ終わった時点で結果を出す。
    layer.addEventListener("animationend", function (e) {
      if (e.animationName !== "beanFly") return; // fxSpin / sparklePop は無視
      if (spec.finale) return;                   // finale付きはタイマー駆動
      flightsLeft -= 1;
      if (flightsLeft > 0) return;
      callDone(); // 結果は即表示。残りの✨が消えた頃にレイヤーを削除
      timers.push(window.setTimeout(cleanupAll, 800));
    });

    if (spec.finale) {
      // バナーは「全粒が流れ終わる頃」にタイマーで必ず出す。
      // 個々の animationend の受信数には一切依存させない
      // （1個でも欠けるとバナーが出ない、という事故を根本から防ぐ）。
      var flightsEndMs = 0;
      spec.particles.forEach(function (p) {
        flightsEndMs = Math.max(flightsEndMs, (p.delay + p.duration) * 1000);
      });
      // 上限を設けて、粒の計算が異常でも必ず出るようにする
      var showAt = Math.min(flightsEndMs + 100, 2200);
      timers.push(window.setTimeout(showFinale, showAt));
    }

    // 何かの理由でタイマー/イベントが動かなくても必ず結果を出す最終保険
    var safetyMs = maxEndMs + (spec.finale ? FINALE_MS + LOADING_MS + 900 : 0) + 800;
    timers.push(window.setTimeout(function () { callDone(); cleanupAll(); }, safetyMs));

    // 超レア時のみ、画面全体をほんのり暖色に（粒レイヤーより先に敷く）
    if (spec.warmBg) startWarm();

    document.body.appendChild(layer);
    return type;
  }

  return {
    config: config,
    builders: builders,
    makeFinale: makeFinale,
    buildParticle: buildParticle,
    chooseType: chooseType,
    play: play
  };
})();

/* ============================================================
   GachaHistory — 出現履歴
   履歴の形式: [{ code, name, count, lastSeen }]  lastSeen はエポックms。
   将来の「出現ランキング」は topAppearances() をUIから呼ぶだけでよい。
   ============================================================ */
var GachaHistory = (function () {
  var HISTORY_MAX = 100; // 履歴の最大保持件数

  function loadAll() {
    var history = GachaStore.load(GachaStore.KEYS.HISTORY, []);
    return Array.isArray(history) ? history : [];
  }

  function save(stocks) {
    var history = loadAll();
    var now = Date.now();

    stocks.forEach(function (s) {
      var found = null;
      for (var i = 0; i < history.length; i++) {
        if (history[i] && history[i].code === s.code) { found = history[i]; break; }
      }
      if (found) {
        found.count = (typeof found.count === "number" ? found.count : 0) + 1;
        found.lastSeen = now;
        found.name = s.name; // 名称が変わっていた場合に追従
      } else {
        history.push({ code: s.code, name: s.name, count: 1, lastSeen: now });
      }
    });

    // 最終出現が新しい順に並べ、最大件数を超えた分は古いものから削除
    history.sort(function (a, b) { return b.lastSeen - a.lastSeen; });
    if (history.length > HISTORY_MAX) {
      history = history.slice(0, HISTORY_MAX);
    }

    GachaStore.save(GachaStore.KEYS.HISTORY, history);
  }

  /* 出現回数の多い順に上位n件を返す（将来の「出現ランキング」用）。
     ※銘柄の優劣ではなく「ガチャで何回出たか」の記録にすぎない */
  function topAppearances(n) {
    var list = loadAll().slice();
    list.sort(function (a, b) {
      if (b.count !== a.count) return b.count - a.count;
      return b.lastSeen - a.lastSeen;
    });
    return list.slice(0, n || 10);
  }

  function render() {
    var tbody = document.getElementById("history-body");
    var history = loadAll();
    tbody.innerHTML = "";

    if (history.length === 0) {
      var tr = document.createElement("tr");
      var td = document.createElement("td");
      td.colSpan = 4;
      td.textContent = "まだ履歴はありません。";
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    history.forEach(function (h) {
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" + GachaUI.escapeHtml(h.code) + "</td>" +
        "<td>" + GachaUI.escapeHtml(h.name) + "</td>" +
        "<td>" + GachaUI.escapeHtml(h.count) + "回</td>" +
        "<td>" + GachaUI.escapeHtml(formatDateTime(h.lastSeen)) + "</td>";
      tbody.appendChild(tr);
    });
  }

  function clear() {
    if (!window.confirm("出現履歴をすべて消します。よろしいですか？（メモは残ります）")) return;
    GachaStore.remove(GachaStore.KEYS.HISTORY);
    render();
  }

  function formatDateTime(epochMs) {
    var d = new Date(epochMs);
    if (isNaN(d.getTime())) return "-";
    function pad(n) { return (n < 10 ? "0" : "") + n; }
    return d.getFullYear() + "/" + pad(d.getMonth() + 1) + "/" + pad(d.getDate()) +
           " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  return { save: save, render: render, clear: clear, topAppearances: topAppearances };
})();

/* ============================================================
   GachaUI — 結果カード・コメント・メモの描画
   演出（GachaFX）とは独立。抽選結果を受け取って表示するだけ。
   ============================================================ */
var GachaUI = (function () {

  /* 外部リンクのURLテンプレート（{code} を銘柄コードに置換）。
     文言は「調べる」「確認する」などの中立表現のみ使う */
  var LINKS = [
    { label: "株探で調べる",            url: "https://kabutan.jp/stock/?code={code}" },
    { label: "Yahoo!ファイナンスで確認", url: "https://finance.yahoo.co.jp/quote/{code}.T" },
    { label: "IR BANKで確認",           url: "https://irbank.net/{code}" },
    { label: "TradingViewで確認",       url: "https://jp.tradingview.com/symbols/TSE-{code}/" }
  ];

  /* ガチャ結果の上に出す一言。投資を促す表現は入れない */
  var GACHA_COMMENTS = [
    "今日の未知との遭遇",
    "理性を外した銘柄散歩",
    "ウヒョーではなく、まずは観察",
    "偏り破壊モード",
    "まず読め、そして調べる",
    "株式市場のランダム散歩",
    "いつもの好みから一歩外へ",
    "知らない会社を見に行く日"
  ];

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* 外部リンク一式のHTMLを銘柄コードから生成（結果カード・今日の1社で共用） */
  function linksHtml(code) {
    return LINKS.map(function (l) {
      var url = l.url.replace("{code}", encodeURIComponent(code));
      return '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' +
             escapeHtml(l.label) + "</a>";
    }).join("");
  }

  function renderComment() {
    var el = document.getElementById("gacha-comment");
    var idx = Math.floor(Math.random() * GACHA_COMMENTS.length);
    el.textContent = "― " + GACHA_COMMENTS[idx] + " ―";
  }

  function saveMemo(code, text) {
    if (!code) return;
    var memos = GachaStore.load(GachaStore.KEYS.MEMO, {});
    if (typeof memos !== "object" || memos === null) memos = {};
    if (text === "") {
      delete memos[code];
    } else {
      memos[code] = text;
    }
    GachaStore.save(GachaStore.KEYS.MEMO, memos);
  }

  function renderResults(stocks) {
    var container = document.getElementById("results");
    container.innerHTML = "";

    if (stocks.length === 0) {
      var p = document.createElement("p");
      p.className = "empty-message";
      p.textContent = "条件に合う銘柄がありませんでした。フィルターを変えて試してください。";
      container.appendChild(p);
      return;
    }

    var memos = GachaStore.load(GachaStore.KEYS.MEMO, {});

    stocks.forEach(function (s, index) {
      var card = document.createElement("article");
      card.className = "stock-card";
      // 上辺の色分け用（市場区分＝属性の色。優劣ではない）
      card.setAttribute("data-market", s.market);
      // カードを1枚ずつ順に「召喚」する（CSS側 cardIn と組み合わせ）
      card.style.animationDelay = (index * 0.06) + "s";

      var memoId = "memo-" + escapeHtml(s.code);

      card.innerHTML =
        '<div class="stock-head">' +
          '<span class="dex-no">' + escapeHtml(GachaData.numberOf(s.code)) + "</span>" +
          '<span class="stock-code">' + escapeHtml(s.code) + "</span>" +
          '<h3 class="stock-name">' + escapeHtml(s.name) + "</h3>" +
        "</div>" +
        '<div class="stock-tags">' +
          '<span class="tag">' + escapeHtml(s.market) + "</span>" +
          '<span class="tag">' + escapeHtml(s.sector) + "</span>" +
          '<span class="tag tag-type-' + escapeHtml(s.type) + '">' + escapeHtml(s.type) + "</span>" +
        "</div>" +
        '<div class="stock-links">' + linksHtml(s.code) + "</div>" +
        '<label class="memo-label" for="' + memoId + '">一言メモ（この端末にのみ保存）</label>' +
        '<textarea class="memo" id="' + memoId + '" data-code="' + escapeHtml(s.code) + '" ' +
          'placeholder="気づいたこと、調べたいことなど"></textarea>';

      container.appendChild(card);

      // textareaの値はHTML文字列に埋め込まず、プロパティで安全にセットする
      var textarea = card.querySelector(".memo");
      textarea.value = (memos && typeof memos[s.code] === "string") ? memos[s.code] : "";
      textarea.addEventListener("input", function (e) {
        saveMemo(e.target.getAttribute("data-code"), e.target.value);
      });
    });
  }

  /* 業種フィルターの選択肢をデータから自動生成 */
  function buildSectorOptions() {
    var select = document.getElementById("sector-select");
    GachaData.sectors().forEach(function (sector) {
      var opt = document.createElement("option");
      opt.value = sector;
      opt.textContent = sector;
      select.appendChild(opt);
    });
  }

  /* localStorage が使えない環境では、履歴の注記に一言添える */
  function showStorageNote() {
    var note = document.querySelector(".history-note");
    if (note) {
      note.textContent = "この環境では保存機能（履歴・メモ）が使えないため、ガチャのみ利用できます。";
    }
  }

  return {
    escapeHtml: escapeHtml,
    linksHtml: linksHtml,
    renderComment: renderComment,
    renderResults: renderResults,
    saveMemo: saveMemo,
    buildSectorOptions: buildSectorOptions,
    showStorageNote: showStorageNote
  };
})();

/* ============================================================
   GachaApp — 全体の進行役
   初期化・ガチャ実行の流れ（抽選→演出→描画→履歴→フック）だけを持つ。
   将来機能（図鑑UI・実績・今日のガチャ等）は hooks.afterRoll に
   関数を登録すれば、本体のコードに触れずに反応できる。
   ============================================================ */
var GachaApp = (function () {
  var rolling = false; // 演出中フラグ（連打による重複起動を防ぐ）

  /* 拡張フック。登録例:
     GachaApp.hooks.afterRoll.push(function (info) {
       // info.picked = 出た銘柄配列, info.effectType = 演出id
     }); */
  var hooks = { afterRoll: [] };

  function runHooks(name, payload) {
    (hooks[name] || []).forEach(function (fn) {
      try { fn(payload); } catch (e) { /* フックの失敗で本体は止めない */ }
    });
  }

  function readFilters() {
    return {
      market: document.getElementById("market-select").value,
      sector: document.getElementById("sector-select").value,
      type: document.getElementById("type-select").value,
      excludeFund: document.getElementById("exclude-fund").checked
    };
  }

  function roll() {
    if (rolling) return; // 演出中の連打は無視
    rolling = true;

    var count = parseInt(document.getElementById("count-select").value, 10) || 5;
    var candidates = GachaLottery.applyFilters(GachaData.getAll(), readFilters());
    var picked = GachaLottery.pickRandom(candidates, count);

    // 演出が終わってから結果を描画する
    GachaFX.play(function (effectType) {
      GachaUI.renderComment();
      GachaUI.renderResults(picked);
      if (picked.length > 0) {
        GachaHistory.save(picked);
        GachaHistory.render();
      }
      rolling = false;
      runHooks("afterRoll", { picked: picked, effectType: effectType });
    });
  }

  function init() {
    GachaUI.buildSectorOptions();
    GachaHistory.render();

    document.getElementById("gacha-button").addEventListener("click", roll);
    document.getElementById("clear-history-button").addEventListener("click", GachaHistory.clear);

    if (!GachaStore.available()) {
      GachaUI.showStorageNote();
    }
  }

  return { init: init, roll: roll, hooks: hooks, runHooks: runHooks };
})();

/* ============================================================
   図鑑・実績（最小版）
   afterRoll フックで動く最初の拡張機能。本体（GachaApp.roll）には
   一切手を入れていない。将来「図鑑一覧」「実績一覧」を作るときは、
   GachaDex.getCollection() / getAchievements() / ACHIEVEMENTS を
   読むUIをここに足すだけでよい。
   ============================================================ */
var GachaMeta = (function () {

  function fmtDate(epochMs) {
    var d = new Date(epochMs);
    if (isNaN(d.getTime())) return "-";
    function pad(n) { return (n < 10 ? "0" : "") + n; }
    return d.getFullYear() + "/" + pad(d.getMonth() + 1) + "/" + pad(d.getDate());
  }

  /* 銘柄図鑑一覧: 業種ごとにグループ化し、
     見出しに進捗（n/m・あと◯社）、行に発見済み情報 or ???? を出す */
  function renderStockDex() {
    var box = document.getElementById("dex-list");
    if (!box) return;
    var esc = GachaUI.escapeHtml;
    var col = GachaDex.getCollection();

    // 業種 → 銘柄リスト（データの登場順を保つ）
    var groups = {};
    var order = [];
    GachaData.getAll().forEach(function (s) {
      if (!groups[s.sector]) { groups[s.sector] = []; order.push(s.sector); }
      groups[s.sector].push(s);
    });

    var html = "";
    order.forEach(function (sector) {
      var list = groups[sector];
      var found = list.filter(function (s) { return col[s.code]; }).length;
      var remain = list.length - found;
      html += '<p class="dex-group-title">' + esc(sector) + "　" + found + " / " + list.length;
      html += (remain === 0)
        ? '　<span class="dex-complete">✔ コンプリート</span>'
        : '　<span class="dex-remain">（あと' + remain + '社）</span>';
      html += "</p>";
      list.forEach(function (s) {
        var entry = col[s.code];
        var no = '<span class="dex-no">' + esc(GachaData.numberOf(s.code)) + "</span>";
        if (entry) {
          html += '<div class="dex-row">' + no +
            '<span class="stock-code">' + esc(s.code) + "</span>" +
            "<span>" + esc(s.name) + "</span>" +
            '<span class="tag">' + esc(s.market) + "</span>" +
            '<span class="dex-meta">発見 ' + esc(fmtDate(entry.firstSeen)) +
            "・出現" + esc(entry.count) + "回</span>" +
            "</div>";
        } else {
          // 未発見でも番号だけは見える（空きスロット感を出す）
          html += '<div class="dex-row">' + no +
            '<span class="dex-undiscovered">？？？？</span></div>';
        }
      });
    });
    box.innerHTML = html;
  }

  /* 演出図鑑: 見たことのある演出は名前と記録、未見は ????? */
  function renderEffectDex() {
    var box = document.getElementById("effect-dex-list");
    if (!box) return;
    var esc = GachaUI.escapeHtml;
    var seen = GachaDex.get();
    var html = "";
    Object.keys(GachaDex.EFFECT_INFO).forEach(function (id) {
      var info = GachaDex.EFFECT_INFO[id];
      var entry = seen[id];
      if (entry) {
        html += '<div class="dex-row">' +
          "<span>" + esc(info.name) + "</span>" +
          '<span class="dex-meta">初回 ' + esc(fmtDate(entry.firstSeen)) +
          "・" + esc(entry.count) + "回</span>" +
          "</div>";
      } else {
        html += '<div class="dex-row"><span class="dex-undiscovered">？？？？？</span></div>';
      }
    });
    box.innerHTML = html;
  }

  /* 画面上部の「発見した銘柄／業種・解除済み実績」カウンタと図鑑を更新 */
  function render() {
    var el = function (id) { return document.getElementById(id); };
    // 表示要素がないページ構成でも動くように黙って抜ける
    if (!el("dex-stocks")) return;
    el("dex-stocks").textContent = GachaDex.countDiscoveredStocks();
    el("dex-stocks-total").textContent = GachaData.getAll().length;
    el("dex-sectors").textContent = GachaDex.countDiscoveredSectors();
    el("dex-sectors-total").textContent = GachaData.sectors().length;
    el("dex-achievements").textContent = GachaDex.countAchievements();
    el("dex-achievements-total").textContent = GachaDex.ACHIEVEMENTS.length;
    renderStockDex();
    renderEffectDex();
  }

  /* 初発見の銘柄カードに NEW バッジを付ける（2回目以降は付かない） */
  function markNewCards(newCodes) {
    newCodes.forEach(function (code) {
      var memo = document.querySelector('#results .memo[data-code="' + code + '"]');
      if (!memo) return;
      var card = memo.closest(".stock-card");
      var head = card ? card.querySelector(".stock-head") : null;
      if (!head) return;
      var badge = document.createElement("span");
      badge.className = "new-badge";
      badge.textContent = "NEW";
      head.appendChild(badge);
    });
  }

  /* 実績解除トースト（画面下に控えめに出て自動で消える） */
  function showToast(text) {
    var area = document.querySelector(".gacha-toast-area");
    if (!area) {
      area = document.createElement("div");
      area.className = "gacha-toast-area";
      area.setAttribute("aria-live", "polite");
      document.body.appendChild(area);
    }
    var toast = document.createElement("div");
    toast.className = "gacha-toast";
    toast.textContent = text;
    area.appendChild(toast);
    // CSSアニメ（2.6秒）終了後にDOMごと片付ける
    window.setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
      if (area.parentNode && area.children.length === 0) area.parentNode.removeChild(area);
    }, 2800);
  }

  /* 毎回のガチャで記録→実績判定→表示更新 */
  GachaApp.hooks.afterRoll.push(function (info) {
    var newCodes = (info.picked.length > 0) ? GachaDex.recordStocks(info.picked) : [];
    GachaDex.recordRoll(); // 0件でも「回した」ことは数える
    var newAchievements = GachaDex.checkAchievements();
    render();
    markNewCards(newCodes);
    newAchievements.forEach(function (a) {
      showToast("🏅 実績解除：" + a.name);
    });
  });

  // 初期表示（GachaApp.init のリスナーが先に登録されているので、
  // ここが実行される時点で他の初期化は完了している）
  document.addEventListener("DOMContentLoaded", render);

  return { render: render, showToast: showToast };
})();

/* ============================================================
   今日の1社（日替わりガチャ）
   日付シードの乱数で選ぶので、同じ日は誰が何回開いても同じ1社。
   通常ガチャとは別枠で、ページを開くだけで表示される。
   表示した銘柄は1日1回だけ図鑑に記録される（回数は増やさない）。
   ============================================================ */
var GachaDaily = (function () {

  /* 日付から決まる擬似乱数（mulberry32）。
     「今日のガチャ」を拡張するときもこの rng を使い回せる */
  function seededRng(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function dateKey(d) {
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }

  /* 今日の1社を返す（now はテスト用） */
  function pickToday(now) {
    var rng = seededRng(dateKey(now || new Date()));
    return GachaLottery.pickRandom(GachaData.getAll(), 1, rng)[0];
  }

  function render() {
    var card = document.getElementById("daily-card");
    if (!card) return;
    var s = pickToday();
    var esc = GachaUI.escapeHtml;

    // ラベル以外を作り直す（再描画しても増殖しないように）
    card.querySelectorAll(".daily-generated").forEach(function (n) { n.remove(); });
    var body = document.createElement("span");
    body.className = "daily-generated";
    body.innerHTML =
      '<span class="stock-code">' + esc(s.code) + '</span> ' +
      '<span class="daily-name">' + esc(s.name) + '</span> ' +
      '<span class="tag">' + esc(s.market) + '</span>' +
      '<span class="tag">' + esc(s.sector) + '</span>';
    card.appendChild(body);
    var links = document.createElement("div");
    links.className = "stock-links daily-generated";
    links.innerHTML = GachaUI.linksHtml(s.code);
    card.appendChild(links);
    var note = document.createElement("p");
    note.className = "daily-note daily-generated";
    note.textContent = "日替わりで1社を表示しています。調査の入口としてどうぞ。";
    card.appendChild(note);

    // 図鑑への記録は1日1回だけ
    try {
      var stats = GachaDex.getStats();
      var key = dateKey(new Date());
      if (stats.dailyLast !== key) {
        stats.dailyLast = key;
        GachaStore.save(GachaStore.KEYS.STATS, stats);
        GachaDex.recordStocks([s]);
        GachaDex.checkAchievements();
        GachaMeta.render();
      }
    } catch (e) { /* 記録できなくても表示は続ける */ }
  }

  document.addEventListener("DOMContentLoaded", render);

  return { render: render, pickToday: pickToday, seededRng: seededRng };
})();

/* ============================================================
   今週の探索テーマ
   週替わりで「今週はこの業種を見てみよう」という視点だけを提示する。
   排出率・抽選内容には一切影響しない（ボタンは業種フィルターを
   セットするだけで、回すかどうかはユーザー次第）。
   ============================================================ */
var GachaTheme = (function () {

  /* テーマは実在の業種のみ（優劣や有望さの示唆はしない）。
     コピーは「知る・見る」の視点に限定する */
  var THEMES = [
    { sector: "海運業",       copy: "船の会社、いくつ知ってる？" },
    { sector: "食料品",       copy: "毎日食べてるあの味も上場企業" },
    { sector: "機械",         copy: "世界を組み立てる裏方たち" },
    { sector: "医薬品",       copy: "研究開発の世界をのぞいてみる" },
    { sector: "小売業",       copy: "いつもの店の裏側を見てみる" },
    { sector: "銀行業",       copy: "お金の流れの土台を知る" },
    { sector: "化学",         copy: "素材から世界を見てみる" },
    { sector: "陸運業",       copy: "運ぶ会社たちの世界" },
    { sector: "情報・通信業", copy: "つながりを支える会社を知る" },
    { sector: "電気機器",     copy: "ものづくりの最前線を見る" },
    { sector: "不動産業",     copy: "街をつくる会社を見てみる" },
    { sector: "精密機器",     copy: "小さな部品の大きな世界" }
  ];

  /* 週番号（月曜起点）からテーマを決める。now はテスト用 */
  function themeOfWeek(now) {
    var d = now || new Date();
    var days = Math.floor(d.getTime() / 86400000); // エポックからの日数
    var week = Math.floor((days + 3) / 7);         // 1970-01-01は木曜なので月曜起点に+3
    return THEMES[week % THEMES.length];
  }

  function render() {
    var card = document.getElementById("theme-card");
    if (!card) return;
    var t = themeOfWeek();
    card.innerHTML = "";
    var label = document.createElement("span");
    label.className = "theme-label";
    label.textContent = "🧭 今週の探索テーマ：" + t.sector;
    card.appendChild(label);
    var copy = document.createElement("span");
    copy.className = "theme-copy";
    copy.textContent = t.copy;
    card.appendChild(copy);
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "theme-btn";
    btn.textContent = "この業種に絞って回してみる";
    btn.addEventListener("click", function () {
      var select = document.getElementById("sector-select");
      if (select) select.value = t.sector;
      var gachaBtn = document.getElementById("gacha-button");
      if (gachaBtn) gachaBtn.focus(); // 回すかどうかはユーザーに委ねる
    });
    card.appendChild(btn);
  }

  document.addEventListener("DOMContentLoaded", render);

  return { render: render, themeOfWeek: themeOfWeek, THEMES: THEMES };
})();

/* ============================================================
   互換エイリアス
   これまでコンソールでの動作確認に使ってきた名前を残す。
   （例: FX.GOLDEN_CHANCE = 1 で黄金ビート嵐を強制）
   ============================================================ */
var FX = GachaFX.config;
var EFFECT_BUILDERS = GachaFX.builders;
var EFFECT_INFO = GachaDex.EFFECT_INFO;
var makeFinale = GachaFX.makeFinale;
var chooseEffectType = GachaFX.chooseType;
var runGacha = GachaApp.roll;

document.addEventListener("DOMContentLoaded", GachaApp.init);
