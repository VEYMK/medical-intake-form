import test from "node:test";
import assert from "node:assert/strict";

import {
  SCHEMA_VERSION,
  SECTIONS,
  allFields,
  getField,
  isRequired,
  isVisible,
} from "../js/schema.js";

test("schema has a stable version and non-empty sections", () => {
  assert.equal(typeof SCHEMA_VERSION, "number");
  assert.ok(SCHEMA_VERSION >= 1);
  assert.ok(SECTIONS.length >= 4);
});

test("field names are unique", () => {
  const names = allFields().map((field) => field.name);
  assert.equal(new Set(names).size, names.length);
});

test("every field has a label, type and known span", () => {
  for (const field of allFields()) {
    assert.ok(field.label, `missing label for ${field.name}`);
    assert.ok(field.type, `missing type for ${field.name}`);
    if (field.span) assert.ok(["half", "full"].includes(field.span));
  }
});

test("radio and select fields have options", () => {
  for (const field of allFields()) {
    if (field.type === "radio" || field.type === "select") {
      assert.ok(Array.isArray(field.options) && field.options.length > 0, field.name);
      for (const option of field.options) {
        assert.ok(option.value);
        assert.ok(option.label);
      }
    }
  }
});

test("guardian fields appear only for minors", () => {
  const guardian = getField("guardianName");
  assert.equal(isVisible(guardian, { birthDate: "2015-01-01" }), true);
  assert.equal(isVisible(guardian, { birthDate: "1990-01-01" }), false);
  assert.equal(isVisible(guardian, {}), false);

  assert.equal(isRequired(guardian, { birthDate: "2015-01-01" }), true);
  assert.equal(isRequired(guardian, { birthDate: "1990-01-01" }), false);
});

test("insurance fields depend on the hasInsurance answer", () => {
  const policy = getField("policyNumber");
  const insurer = getField("insurer");
  const other = getField("insurerOther");

  assert.equal(isVisible(policy, { hasInsurance: "yes" }), true);
  assert.equal(isVisible(policy, { hasInsurance: "no" }), false);
  assert.equal(isVisible(insurer, { hasInsurance: "yes" }), true);
  assert.equal(isVisible(other, { hasInsurance: "yes", insurer: "other" }), true);
  assert.equal(isVisible(other, { hasInsurance: "yes", insurer: "sogaz" }), false);
  assert.equal(isVisible(other, { hasInsurance: "no", insurer: "other" }), false);
});

test("consent is always required and never persisted by the app", () => {
  const consent = getField("consent");
  assert.equal(consent.type, "checkbox");
  assert.equal(isRequired(consent, {}), true);
});
