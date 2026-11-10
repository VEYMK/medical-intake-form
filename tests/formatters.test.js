import test from "node:test";
import assert from "node:assert/strict";

import {
  addDaysIso,
  calculateAge,
  caretAfterMask,
  formatDateTimeRu,
  formatPhone,
  formatPolicyNumber,
  isMinor,
  normalizePhone,
  normalizeWhitespace,
  parseIsoDate,
  todayIso,
} from "../js/formatters.js";

test("normalizeWhitespace trims and collapses spaces", () => {
  assert.equal(normalizeWhitespace("  Анна   Мария  "), "Анна Мария");
  assert.equal(normalizeWhitespace(null), "");
});

test("normalizePhone accepts +7, 8 and bare 10-digit numbers", () => {
  assert.equal(normalizePhone("+7 (999) 123-45-67"), "79991234567");
  assert.equal(normalizePhone("8 999 123 45 67"), "79991234567");
  assert.equal(normalizePhone("9991234567"), "79991234567");
  assert.equal(normalizePhone(""), "");
  assert.equal(normalizePhone("abc"), "");
});

test("formatPhone builds the mask progressively", () => {
  assert.equal(formatPhone(""), "");
  assert.equal(formatPhone("7"), "+7");
  assert.equal(formatPhone("9"), "+7 (9");
  assert.equal(formatPhone("999"), "+7 (999)");
  assert.equal(formatPhone("9991"), "+7 (999) 1");
  assert.equal(formatPhone("89991234567"), "+7 (999) 123-45-67");
  assert.equal(formatPhone("+7 999 123 45 67"), "+7 (999) 123-45-67");
});

test("formatPhone limits the number to 11 digits", () => {
  assert.equal(formatPhone("799912345679999"), "+7 (999) 123-45-67");
});

test("formatPolicyNumber groups digits by four", () => {
  assert.equal(formatPolicyNumber("1234567890123456"), "1234 5678 9012 3456");
  assert.equal(formatPolicyNumber("1234 5678 9012 3456"), "1234 5678 9012 3456");
  assert.equal(formatPolicyNumber("12345"), "1234 5");
  assert.equal(formatPolicyNumber("12345678901234567"), "1234 5678 9012 3456");
});

test("parseIsoDate rejects impossible dates", () => {
  assert.ok(parseIsoDate("2026-02-28"));
  assert.ok(parseIsoDate("2024-02-29"));
  assert.equal(parseIsoDate("2026-02-30"), null);
  assert.equal(parseIsoDate("2026-13-01"), null);
  assert.equal(parseIsoDate("09.11.2026"), null);
});

test("calculateAge compares local date parts", () => {
  const now = new Date(2026, 4, 9);
  assert.equal(calculateAge("2000-05-10", now), 25);
  assert.equal(calculateAge("2000-05-09", now), 26);
  assert.equal(calculateAge("2026-05-10", now), null);
  assert.equal(calculateAge("bad", now), null);
});

test("isMinor uses the 18th birthday boundary", () => {
  const now = new Date(2026, 4, 9);
  assert.equal(isMinor("2008-05-10", now), true);
  assert.equal(isMinor("2008-05-09", now), false);
  assert.equal(isMinor("", now), false);
});

test("date helpers stay in local time", () => {
  const fixed = new Date(2026, 10, 9);
  assert.equal(todayIso(fixed), "2026-11-09");
  assert.equal(addDaysIso(90, fixed), "2027-02-07");
});

test("caretAfterMask keeps the caret after the typed digit", () => {
  assert.equal(caretAfterMask("9", 1, "+7 (9"), 5);
  assert.equal(caretAfterMask("+7 (999) 1", 11, "+7 (999) 1"), 10);
});

test("formatDateTimeRu produces a non-empty localized value", () => {
  const formatted = formatDateTimeRu(new Date(2026, 10, 9, 14, 5));
  assert.match(formatted, /09\.11\.2026/);
  assert.match(formatted, /14:05/);
});
