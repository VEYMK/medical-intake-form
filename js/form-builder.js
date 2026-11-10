import { isRequired, isVisible } from "./schema.js";
import { formatPhone, formatPolicyNumber } from "./formatters.js";

function el(tag, attributes = {}, ...children) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(attributes)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "class") {
      node.className = value;
    } else if (key === "text") {
      node.textContent = value;
    } else if (key === "dataset") {
      Object.assign(node.dataset, value);
    } else if (key === "hidden") {
      if (value) node.hidden = true;
    } else if (value === true) {
      node.setAttribute(key, "");
    } else {
      node.setAttribute(key, String(value));
    }
  }

  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }

  return node;
}

function resolve(value) {
  return typeof value === "function" ? value() : value;
}

/**
 * Native Node.append() converts null/undefined into the text "null", which is
 * how optional hints used to leak into the DOM. This helper skips empty values.
 */
function appendAll(parent, ...children) {
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    parent.append(child);
  }
}

function prefersReducedMotion() {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function fieldSpan(field) {
  if (field.span) return field.span;
  if (field.type === "textarea" || field.type === "radio" || field.type === "checkbox") {
    return "full";
  }
  return "half";
}

function baseInputAttributes(field, id, describedBy) {
  const attributes = {
    id,
    name: field.name,
    type: field.type,
    "aria-describedby": describedBy,
    "aria-invalid": "false",
    "aria-required": "false",
  };

  if (field.autocomplete) attributes.autocomplete = field.autocomplete;
  if (field.inputmode) attributes.inputmode = field.inputmode;
  if (field.placeholder) attributes.placeholder = field.placeholder;
  if (field.maxLength) attributes.maxlength = field.maxLength;
  if (field.minLength) attributes.minlength = field.minLength;
  if (field.autocapitalize) attributes.autocapitalize = field.autocapitalize;
  if (field.spellcheck === false) attributes.spellcheck = "false";
  if (field.type === "date") {
    const min = resolve(field.min);
    const max = resolve(field.max);
    if (min) attributes.min = min;
    if (max) attributes.max = max;
  }
  return attributes;
}

function buildField(field) {
  const id = `field-${field.name}`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = field.hint ? `${hintId} ${errorId}` : errorId;
  const span = fieldSpan(field);
  const req = el("span", { class: "req", "aria-hidden": "true" }, "*");
  req.hidden = true;

  const error = el("p", {
    class: "field-error",
    id: errorId,
    hidden: true,
    "aria-live": "polite",
  });

  if (field.type === "radio") {
    const wrapper = el("fieldset", {
      class: `field field--radio field--${span}`,
      dataset: { field: field.name },
      "aria-describedby": describedBy,
    });
    const legend = el("legend", { class: "field-label" }, field.label, req);
    const hint = field.hint
      ? el("p", { class: "field-hint", id: hintId }, field.hint)
      : null;
    const choices = el("div", { class: "choices" });
    const inputs = [];

    for (const option of field.options ?? []) {
      const optionId = `${id}-${option.value}`;
      const input = el("input", {
        ...baseInputAttributes(field, optionId, describedBy),
        type: "radio",
        value: option.value,
      });
      inputs.push(input);
      choices.append(
        el(
          "label",
          { class: "choice", for: optionId },
          input,
          el("span", { class: "choice-label" }, option.label),
        ),
      );
    }

    appendAll(wrapper, legend, hint, choices, error);
    return {
      field,
      wrapper,
      input: inputs[0],
      inputs,
      error,
      hint,
      counter: null,
      req,
    };
  }

  if (field.type === "checkbox") {
    const wrapper = el("div", {
      class: `field field--checkbox field--${span}`,
      dataset: { field: field.name },
    });
    const input = el("input", {
      ...baseInputAttributes(field, id, describedBy),
      type: "checkbox",
    });
    const label = el(
      "label",
      { class: "check", for: id },
      input,
      el("span", {}, field.label, req),
    );
    const hint = field.hint
      ? el("p", { class: "field-hint", id: hintId }, field.hint)
      : null;
    appendAll(wrapper, label, hint, error);
    return {
      field,
      wrapper,
      input,
      inputs: [input],
      error,
      hint,
      counter: null,
      req,
    };
  }

  const wrapper = el("div", {
    class: `field field--${field.type} field--${span}`,
    dataset: { field: field.name },
  });
  const label = el("label", { class: "field-label", for: id }, field.label, req);
  const hint = field.hint
    ? el("p", { class: "field-hint", id: hintId }, field.hint)
    : null;
  let counter = null;

  let input;
  let counterHint = null;
  if (field.type === "select") {
    const attributes = baseInputAttributes(field, id, describedBy);
    delete attributes.type;
    input = el("select", attributes);
    input.append(
      el(
        "option",
        { value: "", disabled: true, selected: true },
        field.placeholder ?? "Выберите значение",
      ),
    );
    for (const option of field.options ?? []) {
      input.append(el("option", { value: option.value }, option.label));
    }
  } else if (field.type === "textarea") {
    const attributes = baseInputAttributes(field, id, describedBy);
    delete attributes.type;
    input = el("textarea", {
      ...attributes,
      rows: field.rows ?? 4,
    });
    if (field.counter) {
      counter = el(
        "span",
        { class: "counter", id: `${id}-counter` },
        `0 / ${field.maxLength ?? ""}`,
      );
      if (hint) {
        hint.append(counter);
      } else {
        counterHint = el("p", { class: "field-hint", id: hintId }, counter);
      }
    }
  } else {
    input = el("input", baseInputAttributes(field, id, describedBy));
  }

  if (!wrapper.contains(label)) wrapper.append(label);
  wrapper.append(input);
  if (hint && !wrapper.contains(hint)) wrapper.append(hint);
  else if (counterHint) wrapper.append(counterHint);
  wrapper.append(error);

  return {
    field,
    wrapper,
    input,
    inputs: [input],
    error,
    hint,
    counter,
    req,
  };
}

export function buildForm(root, sections) {
  const fields = new Map();
  const sectionElements = new Map();

  for (const section of sections) {
    const sectionEl = el("section", {
      class: "form-section",
      id: `section-${section.id}`,
      "aria-labelledby": `section-${section.id}-title`,
    });
    const header = el(
      "header",
      { class: "section-head" },
      el(
        "h2",
        { id: `section-${section.id}-title`, tabindex: "-1" },
        section.title,
      ),
      section.description
        ? el("p", { class: "section-description" }, section.description)
        : null,
    );
    const grid = el("div", { class: "field-grid" });

    for (const field of section.fields) {
      const state = buildField(field);
      fields.set(field.name, state);
      grid.append(state.wrapper);
    }

    sectionEl.append(header, grid);
    root.append(sectionEl);
    sectionElements.set(section.id, sectionEl);
  }

  function readField(name) {
    const state = fields.get(name);
    if (!state) return undefined;
    if (state.field.type === "checkbox") return state.input.checked;
    if (state.field.type === "radio") {
      const checked = state.inputs.find((input) => input.checked);
      return checked ? checked.value : "";
    }
    return state.input.value;
  }

  function readValues() {
    const values = {};
    for (const name of fields.keys()) values[name] = readField(name);
    return values;
  }

  function writeValues(values) {
    for (const [name, state] of fields) {
      if (!(name in values)) continue;
      const value = values[name];
      if (state.field.type === "checkbox") {
        state.input.checked = value === true;
      } else if (state.field.type === "radio") {
        for (const input of state.inputs) {
          input.checked = input.value === value;
        }
      } else {
        let next = value === null || value === undefined ? "" : String(value);
        if (state.field.mask === "phone") next = formatPhone(next);
        if (state.field.mask === "policy") next = formatPolicyNumber(next);
        state.input.value = next;
      }
      updateCounter(name);
    }
  }

  function clearValue(name) {
    const state = fields.get(name);
    if (!state) return;
    if (state.field.type === "checkbox") {
      state.input.checked = false;
    } else if (state.field.type === "radio") {
      for (const input of state.inputs) input.checked = false;
    } else {
      state.input.value = "";
    }
    updateCounter(name);
  }

  function hasValue(name) {
    const value = readField(name);
    if (typeof value === "boolean") return value;
    return String(value ?? "").trim() !== "";
  }

  function refresh(values) {
    for (const state of fields.values()) {
      const visible = isVisible(state.field, values);
      const required = isRequired(state.field, values);
      state.wrapper.hidden = !visible;
      state.req.hidden = !required;
      for (const input of state.inputs) {
        input.disabled = !visible;
        input.required = required && visible;
        input.setAttribute("aria-required", String(required && visible));
      }
    }
  }

  function showError(name, message) {
    const state = fields.get(name);
    if (!state) return;
    state.error.textContent = message;
    state.error.hidden = !message;
    state.wrapper.classList.toggle("has-error", Boolean(message));
    for (const input of state.inputs) {
      input.setAttribute("aria-invalid", message ? "true" : "false");
    }
  }

  function clearError(name) {
    showError(name, "");
  }

  function clearAllErrors() {
    for (const name of fields.keys()) clearError(name);
  }

  function focus(name) {
    const state = fields.get(name);
    if (!state || state.wrapper.hidden) return;
    const input = state.inputs.find((candidate) => !candidate.disabled);
    if (!input) return;
    input.focus({ preventScroll: true });
    state.wrapper.scrollIntoView({
      block: "center",
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }

  function updateCounter(name) {
    const state = fields.get(name);
    if (!state?.counter) return;
    const length = state.input.value.length;
    const max = state.field.maxLength ?? 0;
    state.counter.textContent = `${length} / ${max}`;
    state.counter.classList.toggle("is-near-limit", max > 0 && length >= max * 0.9);
  }

  return {
    fields,
    sectionElements,
    readField,
    readValues,
    writeValues,
    clearValue,
    hasValue,
    refresh,
    showError,
    clearError,
    clearAllErrors,
    focus,
    updateCounter,
  };
}
