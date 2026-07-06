"use strict";

/* ============================================================
   株ガチャψ
   ランダムに銘柄と出会うための学習・調査補助ツール。
   投資助言・銘柄の優劣付け・スコアリングは行わない。

   ※ 本番（Cloudflare Pages）のCSPが script-src 'self' のため、
      インラインではなく外部ファイルとして配置している。
   ============================================================ */

/* ---------------- 設定 ---------------- */
var CONFIG = {
  HISTORY_KEY: "stockGachaHistory",   // 履歴の保存キー
  MEMO_KEY: "stockGachaMemos",        // メモの保存キー
  HISTORY_MAX: 100,                   // 履歴の最大保持件数
  // 外部リンクのURLテンプレート（{code} を銘柄コードに置換）
  LINKS: [
    { label: "株探で調べる",            url: "https://kabutan.jp/stock/?code={code}" },
    { label: "Yahoo!ファイナンスで確認", url: "https://finance.yahoo.co.jp/quote/{code}.T" },
    { label: "IR BANKで確認",           url: "https://irbank.net/{code}" },
    { label: "TradingViewで確認",       url: "https://jp.tradingview.com/symbols/TSE-{code}/" }
  ]
};

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

/* ---------------- サンプル銘柄データ ----------------
   実在する代表的な銘柄を中心にしたサンプル。
   市場区分・業種は作成時点の目安であり、正確性は保証しない。
   CSV読み込み版に拡張する場合は、getStockData() を
   CSVパース処理に差し替えるだけで済む構造にしてある。 */
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

/* ---------------- データ取得 ----------------
   将来CSV読み込みに切り替える場合は、この関数の中身だけを
   「CSVを読んで同じ形の配列を返す処理」に差し替えればよい。 */
function getStockData() {
  return SAMPLE_STOCKS;
}

/* ---------------- localStorage 読み書き ----------------
   プライベートモード等で localStorage が使えない環境でも、
   ガチャ本体は動くように try/catch で包む。 */
function storageAvailable() {
  try {
    var testKey = "__stockGachaTest__";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
}

function storageLoad(key, fallback) {
  try {
    var raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

function storageSave(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    /* 保存できなくても何もしない（ガチャ自体は継続） */
  }
}

function storageRemove(key) {
  try {
    window.localStorage.removeItem(key);
  } catch (e) {
    /* 同上 */
  }
}

/* ---------------- フィルター ---------------- */
function applyFilters(stocks, filters) {
  return stocks.filter(function (s) {
    if (filters.market && s.market !== filters.market) return false;
    if (filters.sector && s.sector !== filters.sector) return false;
    if (filters.type && s.type !== filters.type) return false;
    if (filters.excludeFund && (s.type === "ETF" || s.type === "REIT")) return false;
    return true;
  });
}

/* ---------------- ランダム抽出 ----------------
   Fisher–Yates シャッフルの部分実行で、重複なく count 件選ぶ。 */
function pickRandom(list, count) {
  var pool = list.slice();
  var n = Math.min(count, pool.length);
  for (var i = 0; i < n; i++) {
    var j = i + Math.floor(Math.random() * (pool.length - i));
    var tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }
  return pool.slice(0, n);
}

/* ---------------- HTMLエスケープ ---------------- */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ---------------- 結果描画 ---------------- */
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

  var memos = storageLoad(CONFIG.MEMO_KEY, {});

  stocks.forEach(function (s, index) {
    var card = document.createElement("article");
    card.className = "stock-card";
    card.style.animationDelay = (index * 0.06) + "s";

    // 外部リンクを銘柄コードから自動生成
    var linksHtml = CONFIG.LINKS.map(function (l) {
      var url = l.url.replace("{code}", encodeURIComponent(s.code));
      return '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' +
             escapeHtml(l.label) + "</a>";
    }).join("");

    var memoId = "memo-" + escapeHtml(s.code);
    var memoValue = (memos && typeof memos[s.code] === "string") ? memos[s.code] : "";

    card.innerHTML =
      '<div class="stock-head">' +
        '<span class="stock-code">' + escapeHtml(s.code) + "</span>" +
        '<h3 class="stock-name">' + escapeHtml(s.name) + "</h3>" +
      "</div>" +
      '<div class="stock-tags">' +
        '<span class="tag">' + escapeHtml(s.market) + "</span>" +
        '<span class="tag">' + escapeHtml(s.sector) + "</span>" +
        '<span class="tag tag-type-' + escapeHtml(s.type) + '">' + escapeHtml(s.type) + "</span>" +
      "</div>" +
      '<div class="stock-links">' + linksHtml + "</div>" +
      '<label class="memo-label" for="' + memoId + '">一言メモ（この端末にのみ保存）</label>' +
      '<textarea class="memo" id="' + memoId + '" data-code="' + escapeHtml(s.code) + '" ' +
        'placeholder="気づいたこと、調べたいことなど"></textarea>';

    container.appendChild(card);

    // textareaの値はHTML文字列に埋め込まず、プロパティで安全にセットする
    var textarea = card.querySelector(".memo");
    textarea.value = memoValue;
    textarea.addEventListener("input", function (e) {
      saveMemo(e.target.getAttribute("data-code"), e.target.value);
    });
  });
}

/* ---------------- ランダムコメント描画 ---------------- */
function renderComment() {
  var el = document.getElementById("gacha-comment");
  var idx = Math.floor(Math.random() * GACHA_COMMENTS.length);
  el.textContent = "― " + GACHA_COMMENTS[idx] + " ―";
}

/* ---------------- メモ保存 ---------------- */
function saveMemo(code, text) {
  if (!code) return;
  var memos = storageLoad(CONFIG.MEMO_KEY, {});
  if (typeof memos !== "object" || memos === null) memos = {};
  if (text === "") {
    delete memos[code];
  } else {
    memos[code] = text;
  }
  storageSave(CONFIG.MEMO_KEY, memos);
}

/* ---------------- 履歴保存 ----------------
   履歴の形式: [{ code, name, count, lastSeen }]  lastSeen はエポックms */
function saveHistory(stocks) {
  var history = storageLoad(CONFIG.HISTORY_KEY, []);
  if (!Array.isArray(history)) history = [];
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
  if (history.length > CONFIG.HISTORY_MAX) {
    history = history.slice(0, CONFIG.HISTORY_MAX);
  }

  storageSave(CONFIG.HISTORY_KEY, history);
}

/* ---------------- 履歴描画 ---------------- */
function renderHistory() {
  var tbody = document.getElementById("history-body");
  var history = storageLoad(CONFIG.HISTORY_KEY, []);
  tbody.innerHTML = "";

  if (!Array.isArray(history) || history.length === 0) {
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
      "<td>" + escapeHtml(h.code) + "</td>" +
      "<td>" + escapeHtml(h.name) + "</td>" +
      "<td>" + escapeHtml(h.count) + "回</td>" +
      "<td>" + escapeHtml(formatDateTime(h.lastSeen)) + "</td>";
    tbody.appendChild(tr);
  });
}

/* ---------------- 履歴削除 ---------------- */
function clearHistory() {
  if (!window.confirm("出現履歴をすべて消します。よろしいですか？（メモは残ります）")) return;
  storageRemove(CONFIG.HISTORY_KEY);
  renderHistory();
}

/* ---------------- 日時フォーマット ---------------- */
function formatDateTime(epochMs) {
  var d = new Date(epochMs);
  if (isNaN(d.getTime())) return "-";
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  return d.getFullYear() + "/" + pad(d.getMonth() + 1) + "/" + pad(d.getDate()) +
         " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
}

/* ---------------- 業種フィルターの選択肢を自動生成 ---------------- */
function populateSectorFilter() {
  var select = document.getElementById("sector-select");
  var seen = {};
  getStockData().forEach(function (s) {
    if (!seen[s.sector]) {
      seen[s.sector] = true;
      var opt = document.createElement("option");
      opt.value = s.sector;
      opt.textContent = s.sector;
      select.appendChild(opt);
    }
  });
}

/* ---------------- ガチャ演出 ----------------
   🫜 が右上から左下へ流れたあとに done() を呼ぶ。
   prefers-reduced-motion: reduce の場合は演出せず即 done()。 */
var fxRunning = false; // 演出中フラグ（連打による重複起動を防ぐ）

function playGachaEffect(done) {
  var reduceMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) {
    done();
    return;
  }

  var el = document.createElement("span");
  el.className = "gacha-fx";
  el.setAttribute("aria-hidden", "true"); // 装飾なのでスクリーンリーダーには読ませない
  el.textContent = "🫜";
  var text = document.createElement("span");
  text.className = "fx-text";
  text.textContent = " ﾋﾞｭｰﾝ";
  el.appendChild(text);
  document.body.appendChild(el);

  var finished = false;
  function finish() {
    if (finished) return; // animationendとタイマーの二重呼び出しを防ぐ
    finished = true;
    if (el.parentNode) el.parentNode.removeChild(el);
    done();
  }
  el.addEventListener("animationend", finish);
  // animationendが発火しない環境（CSS未適用等）でも必ず結果を出す保険
  window.setTimeout(finish, 1200);
}

/* ---------------- ガチャ実行 ---------------- */
function runGacha() {
  if (fxRunning) return; // 演出中の連打は無視
  fxRunning = true;

  var filters = {
    market: document.getElementById("market-select").value,
    sector: document.getElementById("sector-select").value,
    type: document.getElementById("type-select").value,
    excludeFund: document.getElementById("exclude-fund").checked
  };
  var count = parseInt(document.getElementById("count-select").value, 10) || 5;

  var candidates = applyFilters(getStockData(), filters);
  var picked = pickRandom(candidates, count);

  // 演出が終わってから結果を描画する
  playGachaEffect(function () {
    renderComment();
    renderResults(picked);
    if (picked.length > 0) {
      saveHistory(picked);
      renderHistory();
    }
    fxRunning = false;
  });
}

/* ---------------- 初期化 ---------------- */
function init() {
  populateSectorFilter();
  renderHistory();

  document.getElementById("gacha-button").addEventListener("click", runGacha);
  document.getElementById("clear-history-button").addEventListener("click", clearHistory);

  // localStorage が使えない環境では、履歴の注記に一言添える
  if (!storageAvailable()) {
    var note = document.querySelector(".history-note");
    if (note) {
      note.textContent = "この環境では保存機能（履歴・メモ）が使えないため、ガチャのみ利用できます。";
    }
  }
}

document.addEventListener("DOMContentLoaded", init);
