/**
 * Category configuration — single source of truth for the multi-category
 * article pipeline (travel / yurulog / carwash / cooking).
 *
 * Used by:
 *   - tools/travel/form/  (browser: renders fields, builds draft JSON)
 *   - tools/generator/validate-common.js (shared validation)
 *   - tools/generator/generate.js (HTML generation)
 *   - tools/generator/next-id.js (id auto-suggestion)
 *
 * IMPORTANT: `travel` is described here for the form/next-id layer only.
 * travel draft/ready JSON keeps its EXISTING shape and is validated by the
 * original tools/travel/validate.js + validate-ready.js (see validate-common).
 * This config never changes how existing travel JSON is produced or checked.
 *
 * Field descriptor:
 *   { key, label, type, required, readyRequired, hint, placeholder, maxlength }
 *   type: 'text' | 'textarea' | 'date' | 'number' | 'list' | 'select'
 *   - required       : needed even for a draft (途中保存でも必須)
 *   - readyRequired  : additionally needed to reach status:"ready"
 *   Common fields (id/title/date/body/...) are defined in COMMON_FIELDS and
 *   shared by all non-travel categories; category `fields` are the extras.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CategoryConfig = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var SCHEMA_VERSION = 1;

  // Common fields shared by yurulog / carwash / cooking.
  // (travel is handled by its own legacy schema and is not rendered from this.)
  var COMMON_FIELDS = [
    {
      key: 'id',
      label: '記事番号',
      type: 'number',
      required: true,
      readyRequired: true,
      hint: '各カテゴリの最大番号＋1を自動提案（手入力も可）',
    },
    {
      key: 'title',
      label: 'タイトル',
      type: 'text',
      required: true,
      readyRequired: true,
      maxlength: 80,
      hint: '記事タイトル（1〜80文字）',
    },
    {
      key: 'date',
      label: '公開日',
      type: 'date',
      required: true,
      readyRequired: true,
    },
    {
      key: 'body',
      label: '本文',
      type: 'textarea',
      required: true,
      readyRequired: true,
      rows: 12,
      hint: 'セクション区切りは行全体が --- 。段落は空行で区切る。改行は <br>。',
      placeholder:
        '写真01のひとこと\n\n次の段落\n\n---\n\n写真02のひとこと\n\n---\n\n締めのテキスト',
    },
    {
      key: 'listingTitle',
      label: '一覧ページ用タイトル',
      type: 'text',
      required: false,
      readyRequired: true,
      maxlength: 120,
      hint: '一覧カードの見出し（未入力ならタイトルを流用）',
    },
    {
      key: 'listingDescription',
      label: '一覧ページ用説明文',
      type: 'textarea',
      required: false,
      readyRequired: true,
      rows: 3,
      maxlength: 300,
      hint: '一覧カードの本文（1〜300文字）',
    },
    {
      key: 'imageFolder',
      label: '画像フォルダ',
      type: 'text',
      required: false,
      readyRequired: true,
      hint: 'images/{category}/{ここ}/ のフォルダ名（通常はslug）',
      placeholder: '例: shimanoeki-miyako',
    },
    {
      key: 'thumbnail',
      label: '代表サムネイル',
      type: 'text',
      required: false,
      readyRequired: true,
      hint: '一覧/OGPに使う画像ファイル名（画像フォルダ内）',
      placeholder: '例: shimanoeki-miyako-1.webp',
    },
    {
      key: 'images',
      label: '画像情報（alt / caption）',
      type: 'imagelist',
      required: false,
      readyRequired: false,
      hint: '写真ごとの alt（必須）と caption（任意）。本文の写真セクション数と一致させる',
    },
  ];

  var CATEGORIES = {
    travel: {
      key: 'travel',
      label: 'トラベル',
      navLabel: '旅行',
      emoji: '✈️',
      slugPrefix: 'travel',
      imageBase: 'images/travel',
      listingFile: 'travel.html',
      canonicalBase: 'https://shumatsulog.com/travel-',
      layout: 'article',
      // travel uses the legacy form fields + legacy schema; see form/app.js
      legacy: true,
      fields: [],
    },

    yurulog: {
      key: 'yurulog',
      label: 'ゆるログ',
      navLabel: 'ゆるログ',
      emoji: '🗒️',
      slugPrefix: 'yurulog',
      imageBase: 'images/yurulog',
      listingFile: 'yurulog.html',
      canonicalBase: 'https://shumatsulog.com/yurulog-',
      breadcrumbName: 'ゆるログ',
      listingBase: 'https://shumatsulog.com/yurulog',
      titleSuffix: 'ゆるログ',
      headerH1: '🗒️ 週末ログ',
      locationLabel: '🗒️ ゆるログ',
      layout: 'article',
      bodyPhotos: true,
      // ゆるログの文章方針（自動生成・テンプレへ渡す注意書き）
      writingRules: [
        '写真を見れば分かる内容は詳しく説明しない',
        '店や商品の一般的な説明を増やしすぎない',
        '読者への解説より、自分が何を選び何をしたかを優先する',
        '「〜だった」より「〜した」を優先する',
        '短い文章と余白を残す（感想を盛りすぎない）',
        '「読ませる」より「思い出せる」を優先する',
      ],
      fields: [
        {
          key: 'catchCopy',
          label: 'キャッチコピー',
          type: 'text',
          required: false,
          readyRequired: false,
          maxlength: 120,
          hint: 'ヒーロー下の一行（任意）',
        },
      ],
    },

    carwash: {
      key: 'carwash',
      label: '洗車',
      navLabel: '洗車',
      emoji: '🚗',
      slugPrefix: 'carwash',
      imageBase: 'images/carwash',
      listingFile: 'carwash.html',
      canonicalBase: 'https://shumatsulog.com/carwash-',
      breadcrumbName: '洗車',
      listingBase: 'https://shumatsulog.com/carwash',
      titleSuffix: '週末ログ',
      headerH1: '🚗 週末ログ',
      layout: 'gallery',
      bodyPhotos: false,
      fields: [
        {
          key: 'washDate',
          label: '洗車日',
          type: 'text',
          required: false,
          readyRequired: false,
          hint: '本文/サイドバー表示用（任意・例: 2026/04）',
        },
        {
          key: 'vehicle',
          label: '車両情報',
          type: 'text',
          required: false,
          readyRequired: false,
        },
        {
          key: 'place',
          label: '洗車場所',
          type: 'text',
          required: false,
          readyRequired: false,
          hint: 'サイドバー「📍 場所」に表示',
        },
        {
          key: 'mapQuery',
          label: '場所のGoogleマップ検索語',
          type: 'text',
          required: false,
          readyRequired: false,
          hint: '例: D-Wash南町田,東京都町田市（未入力なら地図省略）',
        },
        {
          key: 'tools',
          label: '使った道具・ケミカル',
          type: 'list',
          required: false,
          readyRequired: false,
          hint: '1行1項目。サイドバー「🧰 使ったもの」に表示',
        },
        {
          key: 'work',
          label: '作業内容',
          type: 'textarea',
          required: false,
          readyRequired: false,
          rows: 4,
        },
        {
          key: 'summary',
          label: 'まとめ',
          type: 'textarea',
          required: false,
          readyRequired: false,
          rows: 3,
        },
      ],
    },

    cooking: {
      key: 'cooking',
      label: '料理',
      navLabel: '料理',
      emoji: '🍳',
      slugPrefix: 'cooking',
      imageBase: 'images/cooking',
      listingFile: 'cooking.html',
      canonicalBase: 'https://shumatsulog.com/cooking-',
      breadcrumbName: '料理',
      listingBase: 'https://shumatsulog.com/cooking',
      titleSuffix: '週末ログ',
      headerH1: '🍳 週末ログ',
      locationLabel: '🍳 料理',
      layout: 'article',
      bodyPhotos: true,
      // 料理の文章方針（推測補完しない・記録優先）
      writingRules: [
        '入力されていない事実を推測して追加しない',
        '材料の分量や調理時間を勝手に補完しない',
        '写真から断定できない食材や調理法を書かない',
        'SEO目的の前置きを長くしない',
        '実際に使った材料・工程・工夫・感想を優先する',
        '写真で分かる内容を過剰に説明しない（短文と余白）',
      ],
      fields: [
        {
          key: 'dishName',
          label: '料理名',
          type: 'text',
          required: true,
          readyRequired: true,
        },
        {
          key: 'catchCopy',
          label: 'キャッチコピー',
          type: 'text',
          required: false,
          readyRequired: false,
          maxlength: 120,
        },
        {
          key: 'servings',
          label: '何人分か',
          type: 'text',
          required: false,
          readyRequired: false,
          placeholder: '例: 2人分',
        },
        {
          key: 'cookTime',
          label: '調理時間',
          type: 'text',
          required: false,
          readyRequired: false,
          placeholder: '例: 30分',
        },
        {
          key: 'ingredients',
          label: '材料',
          type: 'list',
          required: false,
          readyRequired: false,
          hint: '1行1項目（材料 分量）。入力があればRecipe構造化データを生成',
        },
        {
          key: 'seasonings',
          label: '調味料',
          type: 'list',
          required: false,
          readyRequired: false,
          hint: '1行1項目',
        },
        {
          key: 'steps',
          label: '作り方・工程',
          type: 'list',
          required: false,
          readyRequired: false,
          hint: '1行1工程。入力があればRecipe構造化データを生成',
        },
        {
          key: 'cookTools',
          label: '使用した道具',
          type: 'list',
          required: false,
          readyRequired: false,
        },
        {
          key: 'plating',
          label: '盛り付け',
          type: 'textarea',
          required: false,
          readyRequired: false,
          rows: 2,
        },
        {
          key: 'taste',
          label: '食べた感想',
          type: 'textarea',
          required: false,
          readyRequired: false,
          rows: 3,
        },
        {
          key: 'arrange',
          label: 'アレンジ・代用品',
          type: 'textarea',
          required: false,
          readyRequired: false,
          rows: 2,
        },
        {
          key: 'nutrition',
          label: '栄養メモ',
          type: 'textarea',
          required: false,
          readyRequired: false,
          rows: 2,
        },
        {
          key: 'notes',
          label: '注意点',
          type: 'textarea',
          required: false,
          readyRequired: false,
          rows: 2,
        },
      ],
    },
  };

  var ORDER = ['travel', 'yurulog', 'carwash', 'cooking'];

  /**
   * @param {string} key
   * @returns {object|null}
   */
  function getCategory(key) {
    return Object.prototype.hasOwnProperty.call(CATEGORIES, key)
      ? CATEGORIES[key]
      : null;
  }

  /**
   * All fields (common + specific) for a non-legacy category.
   * @param {string} key
   * @returns {object[]}
   */
  function fieldsFor(key) {
    var cat = getCategory(key);
    if (!cat || cat.legacy) {
      return [];
    }
    return COMMON_FIELDS.concat(cat.fields || []);
  }

  return {
    SCHEMA_VERSION: SCHEMA_VERSION,
    COMMON_FIELDS: COMMON_FIELDS,
    CATEGORIES: CATEGORIES,
    ORDER: ORDER,
    getCategory: getCategory,
    fieldsFor: fieldsFor,
  };
});
