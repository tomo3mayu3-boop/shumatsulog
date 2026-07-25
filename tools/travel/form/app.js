(function () {
  'use strict';

  var DEFAULT_NEXT_ID = 16;

  var form = document.getElementById('travel-form');
  var idInput = document.getElementById('id');
  var slugPreview = document.getElementById('slug-preview');
  var successMessage = document.getElementById('success-message');
  var errorSummary = document.getElementById('error-summary');
  var errorList = document.getElementById('error-list');
  var warningSummary = document.getElementById('warning-summary');
  var warningList = document.getElementById('warning-list');

  function hideMessages() {
    successMessage.hidden = true;
    errorSummary.hidden = true;
    warningSummary.hidden = true;
    errorList.innerHTML = '';
    warningList.innerHTML = '';
  }

  function showErrors(errors) {
    errorList.innerHTML = '';
    errors.forEach(function (msg) {
      var li = document.createElement('li');
      li.textContent = msg;
      errorList.appendChild(li);
    });
    errorSummary.hidden = false;
    errorSummary.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function showWarnings(warnings) {
    if (!warnings.length) {
      return;
    }
    warningList.innerHTML = '';
    warnings.forEach(function (msg) {
      var li = document.createElement('li');
      li.textContent = msg;
      warningList.appendChild(li);
    });
    warningSummary.hidden = false;
  }

  function updateSlugPreview() {
    var id = parseInt(idInput.value, 10);
    slugPreview.textContent = 'travel-' + (Number.isFinite(id) && id > 0 ? id : '?');
  }

  function getFormData() {
    return {
      id: parseInt(idInput.value, 10),
      title: document.getElementById('title').value,
      date: document.getElementById('date').value,
      locationTag: document.getElementById('locationTag').value,
      heroSubtitle: document.getElementById('heroSubtitle').value,
      body: document.getElementById('body').value,
      listingDescription: document.getElementById('listingDescription').value,
    };
  }

  function buildDraft(formData) {
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
      meta: {
        createdAt: now,
        updatedAt: now,
        source: 'iphone-form-v1',
      },
    };
  }

  function downloadJson(draft) {
    var filename = 'travel-' + draft.id + '.json';
    var blob = new Blob([JSON.stringify(draft, null, 2) + '\n'], {
      type: 'application/json;charset=utf-8',
    });
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  function loadNextId() {
    fetch('../next-id.json')
      .then(function (res) {
        if (!res.ok) {
          throw new Error('fetch failed');
        }
        return res.json();
      })
      .then(function (data) {
        if (data && typeof data.nextId === 'number' && data.nextId >= 1) {
          idInput.value = String(data.nextId);
        } else {
          idInput.value = String(DEFAULT_NEXT_ID);
        }
        updateSlugPreview();
      })
      .catch(function () {
        idInput.value = String(DEFAULT_NEXT_ID);
        updateSlugPreview();
      });
  }

  idInput.addEventListener('input', updateSlugPreview);

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    hideMessages();

    var formData = getFormData();
    var parsedBody = TravelParse.parseBody(formData.body);
    var validationInput = Object.assign({}, formData, { body: parsedBody });
    var result = TravelValidate.validateDraft(validationInput);

    if (!result.valid) {
      showErrors(result.errors);
      return;
    }

    var draft = buildDraft(formData);
    downloadJson(draft);

    showWarnings(result.warnings);
    successMessage.hidden = false;
    successMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  loadNextId();
})();
