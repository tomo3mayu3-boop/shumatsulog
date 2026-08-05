(function () {
  'use strict';

  var CC = window.CategoryConfig;
  var VC = window.ValidateCommon;

  var DEFAULT_NEXT_IDS = { travel: 18, yurulog: 6, carwash: 3, cooking: 1 };
  var nextIds = Object.assign({}, DEFAULT_NEXT_IDS);

  var form = document.getElementById('article-form');
  var categorySelect = document.getElementById('category');
  var statusField = document.getElementById('status-field');
  var statusSelect = document.getElementById('status');
  var travelFields = document.getElementById('travel-fields');
  var dynamicFields = document.getElementById('dynamic-fields');

  var idInput = document.getElementById('id');
  var slugPreview = document.getElementById('slug-preview');

  var successMessage = document.getElementById('success-message');
  var errorSummary = document.getElementById('error-summary');
  var errorList = document.getElementById('error-list');
  var warningSummary = document.getElementById('warning-summary');
  var warningList = document.getElementById('warning-list');

  // ---- messages -----------------------------------------------------------
  function hideMessages() {
    successMessage.hidden = true;
    errorSummary.hidden = true;
    warningSummary.hidden = true;
    errorList.innerHTML = '';
    warningList.innerHTML = '';
  }

  function showList(container, listEl, messages) {
    listEl.innerHTML = '';
    messages.forEach(function (msg) {
      var li = document.createElement('li');
      li.textContent = msg;
      listEl.appendChild(li);
    });
    container.hidden = false;
  }

  function showErrors(errors) {
    showList(errorSummary, errorList, errors);
    errorSummary.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function showWarnings(warnings) {
    if (!warnings.length) return;
    showList(warningSummary, warningList, warnings);
  }

  // ---- helpers ------------------------------------------------------------
  function currentCategory() {
    return categorySelect.value || 'travel';
  }

  function el(id) {
    return document.getElementById(id);
  }

  function dynId(key) {
    return 'dyn-' + key;
  }

  function linesToArray(text) {
    return String(text || '')
      .split(/\r?\n/)
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s.length > 0; });
  }

  // "alt | caption" per line → [{index, alt, caption}]
  function parseImageList(text) {
    return linesToArray(text).map(function (line, i) {
      var parts = line.split(/\s*[|｜]\s*/);
      var alt = (parts[0] || '').trim();
      var caption = (parts.slice(1).join(' | ') || '').trim();
      var img = { index: i + 1, alt: alt };
      if (caption) img.caption = caption;
      return img;
    });
  }

  // ---- dynamic field rendering (non-travel) -------------------------------
  function buildFieldNode(field) {
    var wrap = document.createElement('div');
    wrap.className = 'field';

    var label = document.createElement('label');
    label.setAttribute('for', dynId(field.key));
    label.textContent = field.label + (field.required ? ' *' : '');
    wrap.appendChild(label);

    var input;
    if (field.type === 'textarea' || field.type === 'list' || field.type === 'imagelist') {
      input = document.createElement('textarea');
      input.rows = field.rows || (field.type === 'list' ? 5 : field.type === 'imagelist' ? 5 : 3);
      input.spellcheck = false;
    } else if (field.type === 'select') {
      input = document.createElement('select');
      (field.options || []).forEach(function (opt) {
        var o = document.createElement('option');
        o.value = opt.value; o.textContent = opt.label;
        input.appendChild(o);
      });
    } else if (field.type === 'number') {
      input = document.createElement('input');
      input.type = 'number'; input.min = '1'; input.step = '1';
      input.setAttribute('inputmode', 'numeric');
    } else if (field.type === 'date') {
      input = document.createElement('input');
      input.type = 'date';
    } else {
      input = document.createElement('input');
      input.type = 'text';
      input.autocomplete = 'off';
      if (field.maxlength) input.maxLength = field.maxlength;
    }

    input.id = dynId(field.key);
    input.name = field.key;
    if (field.placeholder) input.placeholder = field.placeholder;
    if (field.type === 'imagelist') {
      input.placeholder = input.placeholder || 'alt ｜ caption（1行1枚・captionは任意）';
    }
    wrap.appendChild(input);

    if (field.hint) {
      var hint = document.createElement('p');
      hint.className = 'hint';
      hint.textContent = field.hint;
      wrap.appendChild(hint);
    }
    return wrap;
  }

  function renderDynamicFields(catKey) {
    dynamicFields.innerHTML = '';
    var fields = CC.fieldsFor(catKey);
    fields.forEach(function (field) {
      dynamicFields.appendChild(buildFieldNode(field));
    });

    // slug preview (readonly) at the end
    var slugWrap = document.createElement('div');
    slugWrap.className = 'field field-readonly';
    var slugLabel = document.createElement('label');
    slugLabel.textContent = 'スラッグ（自動）';
    var slugOut = document.createElement('output');
    slugOut.id = 'dyn-slug-preview';
    slugWrap.appendChild(slugLabel);
    slugWrap.appendChild(slugOut);
    dynamicFields.appendChild(slugWrap);

    var dynIdInput = el(dynId('id'));
    if (dynIdInput) {
      dynIdInput.addEventListener('input', function () {
        updateDynSlug(catKey);
      });
    }
    updateDynSlug(catKey);
  }

  function updateDynSlug(catKey) {
    var cat = CC.getCategory(catKey);
    var out = el('dyn-slug-preview');
    if (!out || !cat) return;
    var v = el(dynId('id'));
    var id = v ? parseInt(v.value, 10) : NaN;
    out.textContent = cat.slugPrefix + '-' + (Number.isFinite(id) && id > 0 ? id : '?');
  }

  // ---- travel path (UNCHANGED output) -------------------------------------
  function updateSlugPreview() {
    var id = parseInt(idInput.value, 10);
    slugPreview.textContent = 'travel-' + (Number.isFinite(id) && id > 0 ? id : '?');
  }

  function getTravelFormData() {
    return {
      id: parseInt(idInput.value, 10),
      title: el('title').value,
      date: el('date').value,
      locationTag: el('locationTag').value,
      heroSubtitle: el('heroSubtitle').value,
      body: el('body').value,
      listingDescription: el('listingDescription').value,
    };
  }

  function buildTravelDraft(formData) {
    var id = formData.id;
    var now = new Date().toISOString();
    var parsedBody = TravelParse.parseBody(formData.body);
    return {
      schemaVersion: 1,
      status: 'draft',
      category: 'travel',
      id: id,
      slug: 'travel-' + id,
      title: formData.title.trim(),
      date: formData.date.trim(),
      locationTag: formData.locationTag.trim(),
      heroSubtitle: formData.heroSubtitle.trim(),
      listingDescription: formData.listingDescription.trim(),
      body: parsedBody,
      build: null,
      meta: { createdAt: now, updatedAt: now, source: 'iphone-form-v1' },
    };
  }

  // ---- generic path (yurulog / carwash / cooking) -------------------------
  function collectValue(field) {
    var node = el(dynId(field.key));
    if (!node) return field.type === 'list' || field.type === 'imagelist' ? [] : '';
    if (field.type === 'list') return linesToArray(node.value);
    if (field.type === 'imagelist') return parseImageList(node.value);
    if (field.type === 'number') {
      var n = parseInt(node.value, 10);
      return Number.isFinite(n) ? n : null;
    }
    return node.value;
  }

  function buildGenericDraft(catKey) {
    var cat = CC.getCategory(catKey);
    var now = new Date().toISOString();
    var draft = {
      schemaVersion: 1,
      status: statusSelect.value === 'ready' ? 'ready' : 'draft',
      category: catKey,
      build: null,
      meta: { createdAt: now, updatedAt: now, source: 'iphone-form-v1' },
    };

    // common fields → top level
    CC.COMMON_FIELDS.forEach(function (field) {
      var v = collectValue(field);
      if (field.key === 'body') {
        draft.body = TravelParse.parseBody(typeof v === 'string' ? v : '');
      } else if (typeof v === 'string') {
        draft[field.key] = v.trim();
      } else {
        draft[field.key] = v;
      }
    });

    var id = draft.id;
    draft.slug = cat.slugPrefix + '-' + id;

    // category-specific fields → categoryData
    var categoryData = {};
    (cat.fields || []).forEach(function (field) {
      categoryData[field.key] = collectValue(field);
    });
    draft.categoryData = categoryData;

    return draft;
  }

  // ---- download -----------------------------------------------------------
  function downloadJson(obj, filename) {
    var blob = new Blob([JSON.stringify(obj, null, 2) + '\n'], {
      type: 'application/json;charset=utf-8',
    });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename; a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ---- category switch ----------------------------------------------------
  function applyCategory(catKey) {
    var isTravel = catKey === 'travel';
    travelFields.hidden = !isTravel;
    dynamicFields.hidden = isTravel;
    statusField.hidden = isTravel;

    if (isTravel) {
      idInput.value = String(nextIds.travel || DEFAULT_NEXT_IDS.travel);
      updateSlugPreview();
    } else {
      renderDynamicFields(catKey);
      var dynIdInput = el(dynId('id'));
      if (dynIdInput) {
        dynIdInput.value = String(nextIds[catKey] || 1);
      }
      updateDynSlug(catKey);
    }
  }

  // ---- submit -------------------------------------------------------------
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    hideMessages();

    var catKey = currentCategory();

    if (catKey === 'travel') {
      var formData = getTravelFormData();
      var parsedBody = TravelParse.parseBody(formData.body);
      var result = TravelValidate.validateDraft(
        Object.assign({}, formData, { body: parsedBody })
      );
      if (!result.valid) { showErrors(result.errors); return; }
      var draft = buildTravelDraft(formData);
      downloadJson(draft, 'travel-' + draft.id + '.json');
      showWarnings(result.warnings);
      successMessage.hidden = false;
      successMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }

    var obj = buildGenericDraft(catKey);
    var res = VC.validateAny(obj);
    if (!res.valid) { showErrors(res.errors); return; }
    downloadJson(obj, obj.slug + '.json');
    showWarnings(res.warnings);
    successMessage.hidden = false;
    successMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  // ---- init ---------------------------------------------------------------
  idInput.addEventListener('input', updateSlugPreview);
  categorySelect.addEventListener('change', function () {
    hideMessages();
    applyCategory(currentCategory());
  });

  function loadNextIds() {
    fetch('../../generator/next-ids.json')
      .then(function (res) { if (!res.ok) throw new Error('fetch failed'); return res.json(); })
      .then(function (data) {
        if (data && typeof data === 'object') {
          Object.keys(DEFAULT_NEXT_IDS).forEach(function (k) {
            if (typeof data[k] === 'number' && data[k] >= 1) nextIds[k] = data[k];
          });
        }
      })
      .catch(function () { /* keep defaults */ })
      .then(function () { applyCategory(currentCategory()); });
  }

  loadNextIds();
})();
