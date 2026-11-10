import {
  SCHEMA_VERSION,
  SECTIONS,
  allFields,
  getField,
  isRequired,
  isVisible,
} from "./schema.js";
import { buildForm } from "./form-builder.js";
import { createDraftStore } from "./draft.js";
import { isBlank, validateField } from "./validators.js";
import {
  caretAfterMask,
  formatDateTimeRu,
  formatPhone,
  formatPolicyNumber,
  formatTimeRu,
  normalizeWhitespace,
  onlyDigits,
} from "./formatters.js";

const $ = (selector) => document.querySelector(selector);

const form = $("#intake-form");
const formRoot = $("#form-root");
const submitButton = $("#submit-button");
const saveDraftButton = $("#save-draft");
const clearFormButton = $("#clear-form");
const saveStatus = $("#save-status");
const draftBanner = $("#draft-banner");
const draftBannerText = $("#draft-banner-text");
const draftBannerClear = $("#draft-banner-clear");
const draftBannerHide = $("#draft-banner-hide");
const externalDraftBanner = $("#external-draft-banner");
const externalDraftReload = $("#external-draft-reload");
const draftEnabledInput = $("#draft-enabled");
const errorSummary = $("#error-summary");
const errorList = $("#error-list");
const progressText = $("#progress-text");
const progressTrack = $("#progress-track");
const progressBar = $("#progress-bar");
const success = $("#success");
const successReference = $("#success-reference");
const successSummary = $("#success-summary");
const clearDialog = $("#clear-dialog");
const privacyDialog = $("#privacy-dialog");
const srStatus = $("#sr-status");

const renderer = buildForm(formRoot, SECTIONS);
const draft = createDraftStore({ version: SCHEMA_VERSION });

let values = renderer.readValues();
let errors = new Map();
const touched = new Set();
let dirty = false;
let submitting = false;
let submitted = false;
let saveTimer = null;
let lastSaveOk = true;
let draftEnabled = true;

/* --------------------------------------------------------------------------
   Status + announcements
   -------------------------------------------------------------------------- */

function setSaveStatus(message, state = "") {
  saveStatus.textContent = message;
  saveStatus.className = "save-status" + (state ? ` is-${state}` : "");
}

function announce(message) {
  srStatus.textContent = "";
  window.setTimeout(() => {
    srStatus.textContent = message;
  }, 40);
}

function prefersReducedMotion() {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/* --------------------------------------------------------------------------
   Visibility, values, validation
   -------------------------------------------------------------------------- */

function syncVisibility() {
  let current = renderer.readValues();
  renderer.refresh(current);

  let cleared = false;
  for (const field of allFields()) {
    if (!isVisible(field, current) && renderer.hasValue(field.name)) {
      renderer.clearValue(field.name);
      renderer.clearError(field.name);
      errors.delete(field.name);
      touched.delete(field.name);
      cleared = true;
    }
  }

  if (cleared) {
    current = renderer.readValues();
    renderer.refresh(current);
  }

  values = current;
  return values;
}

function validateAndRender(name) {
  const field = getField(name);
  if (!field) return true;

  if (!isVisible(field, values)) {
    renderer.clearError(name);
    errors.delete(name);
    return true;
  }

  const message = validateField(field, renderer.readField(name), values);
  if (message) {
    errors.set(name, message);
    renderer.showError(name, message);
    return false;
  }

  errors.delete(name);
  renderer.clearError(name);
  return true;
}

function validateAll() {
  syncVisibility();
  errors.clear();

  for (const field of allFields()) {
    if (!isVisible(field, values)) {
      renderer.clearError(field.name);
      continue;
    }

    touched.add(field.name);
    const message = validateField(field, renderer.readField(field.name), values);
    if (message) {
      errors.set(field.name, message);
      renderer.showError(field.name, message);
    } else {
      renderer.clearError(field.name);
    }
  }

  return errors.size === 0;
}

function showErrorSummary() {
  errorList.replaceChildren();

  const ordered = allFields().filter((field) => errors.has(field.name));
  for (const field of ordered) {
    const state = renderer.fields.get(field.name);
    const target = state?.inputs[0];
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = `#${target?.id ?? `field-${field.name}`}`;
    link.textContent = `${field.label}: ${errors.get(field.name)}`;
    link.addEventListener("click", (event) => {
      event.preventDefault();
      renderer.focus(field.name);
    });
    item.append(link);
    errorList.append(item);
  }

  errorSummary.hidden = ordered.length === 0;
  if (ordered.length > 0) {
    errorSummary.focus({ preventScroll: true });
    errorSummary.scrollIntoView({
      block: "center",
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }
}

function hideErrorSummary() {
  errorSummary.hidden = true;
  errorList.replaceChildren();
}

function updateProgress() {
  const requiredFields = allFields().filter(
    (field) => isVisible(field, values) && isRequired(field, values),
  );
  const total = requiredFields.length;
  const filled = requiredFields.filter(
    (field) => !isBlank(renderer.readField(field.name)),
  ).length;
  const percent = total === 0 ? 0 : Math.round((filled / total) * 100);

  progressText.textContent = `${filled} из ${total}`;
  progressBar.style.width = `${percent}%`;
  progressTrack.setAttribute("aria-valuenow", String(percent));
  progressTrack.setAttribute(
    "aria-valuetext",
    `Заполнено ${filled} из ${total} обязательных полей`,
  );
}

/* --------------------------------------------------------------------------
   Draft persistence
   -------------------------------------------------------------------------- */

function collectDraftValues() {
  const all = renderer.readValues();
  const result = {};

  for (const field of allFields()) {
    if (field.name === "consent") continue;
    if (!isVisible(field, values)) continue;
    const value = all[field.name];
    if (typeof value === "string" || typeof value === "boolean") {
      result[field.name] = value;
    }
  }

  return result;
}

function saveNow({ manual = false } = {}) {
  if (!draftEnabled) {
    if (manual) {
      setSaveStatus("Автосохранение выключено. Включите его, чтобы сохранить черновик.", "info");
      announce("Автосохранение выключено.");
    }
    return;
  }

  if (!draft.available) {
    lastSaveOk = false;
    setSaveStatus("Не удалось сохранить: браузер блокирует локальное хранилище.", "error");
    return;
  }

  const result = draft.save(collectDraftValues());
  if (result.ok) {
    lastSaveOk = true;
    setSaveStatus(`Черновик сохранён в ${formatTimeRu(result.savedAt)}`, "saved");
    if (manual) announce("Черновик сохранён.");
  } else {
    lastSaveOk = false;
    setSaveStatus(
      result.reason === "quota"
        ? "Не удалось сохранить черновик: локальное хранилище переполнено."
        : "Не удалось сохранить черновик в этом браузере.",
      "error",
    );
  }
}

function scheduleSave() {
  if (!draftEnabled || !draft.available) return;
  if (saveTimer) window.clearTimeout(saveTimer);
  setSaveStatus("Сохраняем черновик…", "saving");
  saveTimer = window.setTimeout(() => {
    saveTimer = null;
    saveNow();
  }, 450);
}

function markDirty() {
  dirty = true;
  lastSaveOk = false;
}

function showDraftBanner(savedAt) {
  draftBannerText.textContent = `Данные от ${formatDateTimeRu(savedAt)} восстановлены. Проверьте их и продолжите заполнение.`;
  draftBanner.hidden = false;
}

function restoreDraft() {
  if (!draftEnabled || !draft.available) return;

  const result = draft.load();
  if (result.status === "ok") {
    renderer.writeValues(result.values);
    syncVisibility();
    updateProgress();
    showDraftBanner(result.savedAt);
    lastSaveOk = true;
    setSaveStatus(`Черновик восстановлен (${formatTimeRu(result.savedAt)})`, "info");
    return;
  }

  if (result.status === "stale") {
    setSaveStatus("Старый черновик удалён — начните заполнение заново.", "info");
  } else if (result.status === "expired") {
    setSaveStatus("Черновик старше 7 дней удалён.", "info");
  } else if (result.status === "corrupt") {
    setSaveStatus("Повреждённый черновик удалён.", "info");
  } else if (result.status === "unavailable") {
    setSaveStatus("Автосохранение недоступно в этом браузере.", "error");
  }
}

/* --------------------------------------------------------------------------
   Input masking + events
   -------------------------------------------------------------------------- */

function applyMask(input, mask, inputType = "") {
  const oldValue = input.value;
  const caret = input.selectionStart ?? oldValue.length;

  let formatted = mask === "phone" ? formatPhone(oldValue) : formatPolicyNumber(oldValue);
  if (mask === "phone" && inputType.startsWith("delete") && onlyDigits(oldValue).length <= 1) {
    formatted = "";
  }

  input.value = formatted;

  if (document.activeElement === input) {
    const position = caretAfterMask(oldValue, caret, formatted);
    input.setSelectionRange(position, position);
  }
}

function isFieldControl(target) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

function handleInput(event) {
  const input = event.target;
  if (!isFieldControl(input) || !input.name) return;

  const field = getField(input.name);
  if (!field) return;

  if (field.mask) applyMask(input, field.mask, event.inputType ?? "");

  syncVisibility();
  renderer.updateCounter(field.name);
  updateProgress();

  if (touched.has(field.name) || errors.has(field.name)) {
    validateAndRender(field.name);
  }

  markDirty();
  scheduleSave();
}

function handleChange(event) {
  const input = event.target;
  if (!isFieldControl(input) || !input.name) return;

  const field = getField(input.name);
  if (!field) return;

  syncVisibility();
  renderer.updateCounter(field.name);
  updateProgress();

  if (touched.has(field.name) || errors.has(field.name)) {
    validateAndRender(field.name);
  }

  markDirty();
  scheduleSave();
}

function handleFocusOut(event) {
  const input = event.target;
  if (!isFieldControl(input) || !input.name) return;

  const field = getField(input.name);
  if (!field) return;

  syncVisibility();

  if (field.validation === "name" || field.validation === "company") {
    const normalized = normalizeWhitespace(input.value);
    if (input.value !== normalized) {
      input.value = normalized;
      syncVisibility();
    }
  } else if (field.type === "email") {
    input.value = input.value.trim();
  }

  touched.add(field.name);
  validateAndRender(field.name);
  renderer.updateCounter(field.name);
  updateProgress();
  markDirty();
  scheduleSave();
}

/* --------------------------------------------------------------------------
   Submission
   -------------------------------------------------------------------------- */

function generateReference() {
  const year = new Date().getFullYear();
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `MF-${year}-${random}`;
}

function collectPayload() {
  const all = renderer.readValues();
  const payload = {};

  for (const field of allFields()) {
    if (!isVisible(field, values)) continue;
    let value = all[field.name];

    if (typeof value === "string") {
      if (field.validation === "name" || field.validation === "company") {
        value = normalizeWhitespace(value);
      } else if (field.type === "email") {
        value = value.trim();
      } else if (field.mask === "phone") {
        value = formatPhone(value);
      } else if (field.mask === "policy") {
        value = formatPolicyNumber(value);
      } else {
        value = value.trim();
      }
    }

    payload[field.name] = value;
  }

  payload.consent = true;
  return payload;
}

async function submitIntake(payload) {
  const endpoint = form.dataset.endpoint?.trim();

  if (endpoint) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json().catch(() => ({}));
    return typeof data.reference === "string" && data.reference
      ? data.reference
      : generateReference();
  }

  // Demo mode: there is no backend in this repository. The delay imitates a
  // network request; the integration point is the data-endpoint attribute.
  await new Promise((resolve) => window.setTimeout(resolve, 700));
  return generateReference();
}

function showSuccess(reference, payload) {
  form.hidden = true;
  draftBanner.hidden = true;
  externalDraftBanner.hidden = true;
  hideErrorSummary();

  successReference.textContent = reference;
  successSummary.replaceChildren();

  const rows = [
    ["Пациент", [payload.lastName, payload.firstName, payload.middleName].filter(Boolean).join(" ")],
    ["Дата рождения", payload.birthDate],
    ["Телефон", payload.phone],
    ["Email", payload.email],
    ["Желаемая дата", payload.preferredDate],
  ];

  for (const [label, value] of rows) {
    if (!value) continue;
    const term = document.createElement("dt");
    term.textContent = label;
    const description = document.createElement("dd");
    description.textContent = value;
    successSummary.append(term, description);
  }

  success.hidden = false;
  success.focus({ preventScroll: true });
  success.scrollIntoView({
    block: "start",
    behavior: prefersReducedMotion() ? "auto" : "smooth",
  });

  announce(`Анкета отправлена. Номер заявки ${reference}.`);
  document.dispatchEvent(
    new CustomEvent("intake:submitted", { detail: { reference } }),
  );
}

async function handleSubmit(event) {
  event.preventDefault();
  if (submitting) return;

  syncVisibility();
  const valid = validateAll();
  updateProgress();

  if (!valid) {
    showErrorSummary();
    setSaveStatus("Проверьте выделенные поля.", "error");
    announce("Форма содержит ошибки. Перейдите к первому полю.");
    return;
  }

  hideErrorSummary();
  submitting = true;
  submitButton.disabled = true;
  submitButton.setAttribute("aria-busy", "true");
  const label = submitButton.querySelector(".btn-label");
  if (label) label.textContent = "Отправляем…";
  setSaveStatus("Отправляем анкету…", "saving");

  try {
    const payload = collectPayload();
    const reference = await submitIntake(payload);
    submitted = true;
    if (saveTimer) {
      window.clearTimeout(saveTimer);
      saveTimer = null;
    }
    draft.clear();
    showSuccess(reference, payload);
  } catch {
    setSaveStatus(
      draftEnabled
        ? "Не удалось отправить анкету. Черновик сохранён — попробуйте ещё раз."
        : "Не удалось отправить анкету. Проверьте соединение и попробуйте ещё раз.",
      "error",
    );
    announce("Не удалось отправить анкету. Попробуйте ещё раз.");
  } finally {
    submitting = false;
    submitButton.disabled = false;
    submitButton.removeAttribute("aria-busy");
    if (label) label.textContent = "Отправить анкету";
  }
}

/* --------------------------------------------------------------------------
   Reset / dialogs
   -------------------------------------------------------------------------- */

function resetForm() {
  if (saveTimer) {
    window.clearTimeout(saveTimer);
    saveTimer = null;
  }

  for (const field of allFields()) {
    renderer.clearValue(field.name);
    renderer.clearError(field.name);
  }

  touched.clear();
  errors.clear();
  dirty = false;
  submitting = false;
  submitted = false;
  lastSaveOk = true;

  syncVisibility();
  updateProgress();
  hideErrorSummary();
  draft.clear();
  draftBanner.hidden = true;
  externalDraftBanner.hidden = true;
  setSaveStatus(
    draftEnabled ? "Черновик очищен. Автосохранение включено." : "Черновик очищен.",
    "info",
  );
  announce("Форма очищена.");
}

function openClearDialog() {
  if (typeof clearDialog.showModal === "function") {
    clearDialog.returnValue = "";
    clearDialog.showModal();
  } else if (window.confirm("Очистить анкету и удалить черновик?")) {
    resetForm();
  }
}

function openPrivacyDialog() {
  if (typeof privacyDialog.showModal === "function") {
    privacyDialog.showModal();
  } else {
    privacyDialog.setAttribute("open", "");
  }
}

function focusFirstField() {
  const first = allFields().find((field) => isVisible(field, values));
  if (first) renderer.focus(first.name);
}

/* --------------------------------------------------------------------------
   Navigation
   -------------------------------------------------------------------------- */

function initNavigation() {
  const navList = $("#section-nav-list");
  if (!navList) return;

  SECTIONS.forEach((section, index) => {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = `#section-${section.id}`;

    const number = document.createElement("span");
    number.className = "nav-index";
    number.setAttribute("aria-hidden", "true");
    number.textContent = String(index + 1).padStart(2, "0");

    link.append(number, document.createTextNode(section.title));
    item.append(link);
    navList.append(item);
  });

  navList.addEventListener("click", (event) => {
    const link = event.target.closest('a[href^="#section-"]');
    if (!link) return;
    const target = document.querySelector(link.getAttribute("href"));
    const heading = target?.querySelector("h2");
    if (heading) {
      window.setTimeout(() => heading.focus({ preventScroll: true }), 0);
    }
  });

  if (!("IntersectionObserver" in window)) return;

  const links = new Map(
    [...navList.querySelectorAll('a[href^="#section-"]')].map((link) => [
      link.getAttribute("href").slice(1),
      link,
    ]),
  );

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
      if (!visible) return;

      for (const [id, link] of links) {
        if (id === visible.target.id) {
          link.setAttribute("aria-current", "true");
        } else {
          link.removeAttribute("aria-current");
        }
      }
    },
    { rootMargin: "-20% 0px -65% 0px", threshold: [0, 0.1, 0.5] },
  );

  for (const section of renderer.sectionElements.values()) {
    observer.observe(section);
  }
}

/* --------------------------------------------------------------------------
   Draft initialization + lifecycle
   -------------------------------------------------------------------------- */

function refreshDateConstraints() {
  for (const field of allFields()) {
    if (field.type !== "date") continue;
    const state = renderer.fields.get(field.name);
    if (!state) continue;

    const min = typeof field.min === "function" ? field.min() : field.min;
    const max = typeof field.max === "function" ? field.max() : field.max;

    if (min) state.input.min = min;
    else state.input.removeAttribute("min");

    if (max) state.input.max = max;
    else state.input.removeAttribute("max");
  }
}

function initDraft() {
  const prefs = draft.loadPrefs();
  draftEnabled = prefs.draftEnabled;
  draftEnabledInput.checked = draftEnabled;

  if (!draft.available) {
    draftEnabled = false;
    draftEnabledInput.checked = false;
    draftEnabledInput.disabled = true;
    lastSaveOk = false;
    setSaveStatus(
      "Автосохранение недоступно: браузер блокирует локальное хранилище.",
      "error",
    );
    return;
  }

  if (!draftEnabled) {
    setSaveStatus("Автосохранение выключено.", "info");
    return;
  }

  restoreDraft();
}

/* --------------------------------------------------------------------------
   Wiring
   -------------------------------------------------------------------------- */

form.addEventListener("input", handleInput);
form.addEventListener("change", handleChange);
form.addEventListener("focusout", handleFocusOut);
form.addEventListener("submit", handleSubmit);

saveDraftButton.addEventListener("click", () => {
  if (!draftEnabled) {
    setSaveStatus("Включите автосохранение, чтобы сохранить черновик.", "info");
    draftEnabledInput.focus();
    return;
  }
  saveNow({ manual: true });
});

clearFormButton.addEventListener("click", openClearDialog);
draftBannerClear.addEventListener("click", openClearDialog);
draftBannerHide.addEventListener("click", () => {
  draftBanner.hidden = true;
});
externalDraftReload.addEventListener("click", () => window.location.reload());

draftEnabledInput.addEventListener("change", () => {
  draftEnabled = draftEnabledInput.checked;
  draft.savePrefs({ draftEnabled });

  if (!draftEnabled) {
    if (saveTimer) {
      window.clearTimeout(saveTimer);
      saveTimer = null;
    }
    draft.clear();
    lastSaveOk = false;
    setSaveStatus("Автосохранение выключено. Черновик удалён.", "info");
    announce("Автосохранение выключено, черновик удалён.");
    return;
  }

  saveNow({ manual: true });
});

clearDialog.addEventListener("close", () => {
  if (clearDialog.returnValue === "confirm") resetForm();
});

$("#clear-cancel").addEventListener("click", () => {
  clearDialog.returnValue = "cancel";
  clearDialog.close();
});

$("#clear-confirm").addEventListener("click", () => {
  clearDialog.returnValue = "confirm";
  clearDialog.close();
});

for (const selector of ["#privacy-open", "#privacy-open-footer"]) {
  const button = $(selector);
  if (button) button.addEventListener("click", openPrivacyDialog);
}
$("#privacy-close").addEventListener("click", () => privacyDialog.close());

$("#success-new").addEventListener("click", () => {
  resetForm();
  success.hidden = true;
  form.hidden = false;
  focusFirstField();
});

$("#success-print").addEventListener("click", () => window.print());

window.addEventListener("beforeunload", (event) => {
  if (submitted) return;
  if (!dirty) return;
  if (draftEnabled && draft.available && lastSaveOk) return;

  event.preventDefault();
  event.returnValue = "";
});

window.addEventListener("pagehide", () => {
  if (submitted || !dirty || !draftEnabled || !draft.available) return;
  if (saveTimer) {
    window.clearTimeout(saveTimer);
    saveTimer = null;
  }
  const result = draft.save(collectDraftValues());
  if (result.ok) lastSaveOk = true;
});

window.addEventListener("storage", (event) => {
  if (event.key !== draft.key || submitted || !draftEnabled) return;
  if (event.newValue === null) return;
  externalDraftBanner.hidden = false;
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (dirty && draftEnabled && draft.available && !submitted) {
      if (saveTimer) {
        window.clearTimeout(saveTimer);
        saveTimer = null;
      }
      saveNow();
    }
    return;
  }
  refreshDateConstraints();
});

window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    setSaveStatus("Страница восстановлена из кэша. Проверьте актуальность данных.", "info");
  }
});

/* --------------------------------------------------------------------------
   Boot
   -------------------------------------------------------------------------- */

renderer.refresh(values);
refreshDateConstraints();
initNavigation();
initDraft();
updateProgress();
