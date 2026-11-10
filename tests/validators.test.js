import test from "node:test";
import assert from "node:assert/strict";

import {
  isBlank,
  validateBirthDate,
  validateEmail,
  validateField,
  validateName,
  validatePhone,
  validatePolicyNumber,
  validatePreferredDate,
  validateSymptoms,
} from "../js/validators.js";
import { getField } from "../js/schema.js";

const TODAY = "2026-11-09";

function field(name) {
  return getField(name);
}

test("isBlank treats whitespace, null and false as empty", () => {
  assert.equal(isBlank(""), true);
  assert.equal(isBlank("   "), true);
  assert.equal(isBlank(null), true);
  assert.equal(isBlank(false), true);
  assert.equal(isBlank("x"), false);
  assert.equal(isBlank(true), false);
});

test("names allow Cyrillic, hyphens, apostrophes and spaces", () => {
  assert.equal(validateName("Иванов"), null);
  assert.equal(validateName("Анна-Мария"), null);
  assert.equal(validateName("О'Брайен"), null);
  assert.equal(validateName("ван дер Берг"), null);
  assert.equal(validateName("  Анна   Мария  "), null);
  assert.match(validateName("И"), /2 до 60/);
  assert.match(validateName("Иванов2"), /только буквы/);
  assert.match(validateName("Иванов!"), /только буквы/);
});

test("email accepts common valid formats", () => {
  assert.equal(validateEmail("name@example.com"), null);
  assert.equal(validateEmail("name+tag@example.co.uk"), null);
  assert.equal(validateEmail("иван@example.рф"), null);
  assert.equal(validateEmail("first.last@sub.example.com"), null);
});

test("email rejects malformed addresses", () => {
  assert.match(validateEmail("a@b"), /формате/);
  assert.match(validateEmail("a..b@example.com"), /формате/);
  assert.match(validateEmail(".a@example.com"), /формате/);
  assert.match(validateEmail("a.@example.com"), /формате/);
  assert.match(validateEmail("a@-example.com"), /домен/);
  assert.match(validateEmail("a@example..com"), /домен/);
  assert.match(validateEmail("a b@example.com"), /пробелы/);
  assert.match(validateEmail("a@example.c"), /домен/);
  assert.match(validateEmail(`${"a".repeat(65)}@example.com`), /до @/);
});

test("phone requires 11 digits and accepts different input formats", () => {
  assert.equal(validatePhone("+7 (999) 123-45-67"), null);
  assert.equal(validatePhone("8 999 123 45 67"), null);
  assert.equal(validatePhone("9991234567"), null);
  assert.match(validatePhone("+7 (999) 123-45"), /полностью/);
  assert.match(validatePhone(""), /полностью/);
});

test("birth date rejects future, impossible and too old dates", () => {
  assert.equal(validateBirthDate("2000-05-10", TODAY), null);
  assert.match(validateBirthDate("2027-01-01", TODAY), /будущем/);
  assert.match(validateBirthDate("2026-02-30", TODAY), /корректную/);
  assert.match(validateBirthDate("1899-12-31", TODAY), /Проверьте/);
  assert.match(validateBirthDate("", TODAY), /корректную/);
});

test("preferred date is limited to the next 90 days", () => {
  assert.equal(validatePreferredDate(TODAY, TODAY), null);
  assert.equal(validatePreferredDate("2027-02-07", TODAY), null);
  assert.match(validatePreferredDate("2026-11-08", TODAY), /сегодняшнюю/);
  assert.match(validatePreferredDate("2027-02-08", TODAY), /90 дней/);
});

test("policy number requires exactly 16 digits", () => {
  assert.equal(validatePolicyNumber("1234 5678 9012 3456"), null);
  assert.match(validatePolicyNumber("1234 5678 9012 345"), /16 цифр/);
  assert.match(validatePolicyNumber("1234 5678 9012 34567"), /16 цифр/);
});

test("symptoms require at least 10 characters and respect max length", () => {
  assert.equal(validateSymptoms("Болит голова"), null);
  assert.match(validateSymptoms("Болит"), /минимум 10/);
  assert.match(validateSymptoms("а".repeat(1001)), /Не более 1000/);
});

test("required fields produce friendly messages by control type", () => {
  const lastName = field("lastName");
  assert.match(validateField(lastName, "", {}, { today: TODAY }), /Заполните/);

  const gender = field("gender");
  assert.match(validateField(gender, "", {}, { today: TODAY }), /один из вариантов/);

  const contact = field("preferredContact");
  assert.match(validateField(contact, "", {}, { today: TODAY }), /из списка/);

  const consent = field("consent");
  assert.match(validateField(consent, false, {}, { today: TODAY }), /согласие/);
  assert.equal(validateField(consent, true, {}, { today: TODAY }), null);
});

test("optional fields stay optional", () => {
  assert.equal(validateField(field("middleName"), "", {}, { today: TODAY }), null);
  assert.equal(validateField(field("address"), "", {}, { today: TODAY }), null);
});

test("guardian fields are required only for a minor patient", () => {
  const guardian = field("guardianName");
  assert.match(
    validateField(guardian, "", { birthDate: "2015-01-01" }, { today: TODAY }),
    /Заполните/,
  );
  assert.equal(
    validateField(guardian, "", { birthDate: "1990-01-01" }, { today: TODAY }),
    null,
  );
});

test("insurance fields are required only when a policy exists", () => {
  const policy = field("policyNumber");
  assert.match(
    validateField(policy, "", { hasInsurance: "yes" }, { today: TODAY }),
    /Заполните/,
  );
  assert.equal(
    validateField(policy, "", { hasInsurance: "no" }, { today: TODAY }),
    null,
  );
  assert.match(
    validateField(policy, "123", { hasInsurance: "yes" }, { today: TODAY }),
    /16 цифр/,
  );
});

test("other insurer name is required only for the 'other' option", () => {
  const other = field("insurerOther");
  assert.match(
    validateField(
      other,
      "",
      { hasInsurance: "yes", insurer: "other" },
      { today: TODAY },
    ),
    /Заполните/,
  );
  assert.equal(
    validateField(
      other,
      "",
      { hasInsurance: "yes", insurer: "sogaz" },
      { today: TODAY },
    ),
    null,
  );
});
