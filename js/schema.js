import { addDaysIso, isMinor, todayIso } from "./formatters.js";

export const SCHEMA_VERSION = 1;

const yesNoOptions = [
  { value: "yes", label: "Да, есть полис" },
  { value: "no", label: "Нет, оплачу самостоятельно" },
];

const genderOptions = [
  { value: "female", label: "Женский" },
  { value: "male", label: "Мужской" },
  { value: "other", label: "Другой" },
  { value: "undisclosed", label: "Не хочу указывать" },
];

const contactOptions = [
  { value: "phone", label: "Телефонный звонок" },
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
];

const insurerOptions = [
  { value: "sogaz", label: "СОГАЗ" },
  { value: "alfa", label: "АльфаСтрахование" },
  { value: "ingos", label: "Ингосстрах" },
  { value: "vsk", label: "ВСК" },
  { value: "other", label: "Другая компания" },
];

const visitReasonOptions = [
  { value: "consultation", label: "Первичная консультация" },
  { value: "checkup", label: "Профилактический осмотр" },
  { value: "followup", label: "Повторный приём" },
  { value: "tests", label: "Сдача анализов" },
  { value: "other", label: "Другое" },
];

export function hasInsurance(values) {
  return values?.hasInsurance === "yes";
}

export function needsOtherInsurer(values) {
  return hasInsurance(values) && values?.insurer === "other";
}

export const SECTIONS = [
  {
    id: "personal",
    title: "Личные данные",
    description:
      "Укажите данные так, как они записаны в паспорте или свидетельстве о рождении.",
    fields: [
      {
        name: "lastName",
        label: "Фамилия",
        type: "text",
        required: true,
        validation: "name",
        autocomplete: "family-name",
        autocapitalize: "words",
        placeholder: "Иванов",
        maxLength: 60,
        span: "half",
      },
      {
        name: "firstName",
        label: "Имя",
        type: "text",
        required: true,
        validation: "name",
        autocomplete: "given-name",
        autocapitalize: "words",
        placeholder: "Иван",
        maxLength: 60,
        span: "half",
      },
      {
        name: "middleName",
        label: "Отчество",
        type: "text",
        required: false,
        validation: "name",
        autocomplete: "additional-name",
        autocapitalize: "words",
        placeholder: "Иванович",
        maxLength: 60,
        span: "half",
      },
      {
        name: "birthDate",
        label: "Дата рождения",
        type: "date",
        required: true,
        validation: "birthDate",
        autocomplete: "bday",
        min: "1900-01-01",
        max: () => todayIso(),
        span: "half",
        hint: "Если пациенту меньше 18 лет, понадобятся данные представителя.",
      },
      {
        name: "gender",
        label: "Пол",
        type: "radio",
        required: true,
        options: genderOptions,
        span: "full",
      },
      {
        name: "guardianName",
        label: "ФИО законного представителя",
        type: "text",
        required: (values) => isMinor(values?.birthDate),
        visibleWhen: (values) => isMinor(values?.birthDate),
        validation: "name",
        autocomplete: "name",
        autocapitalize: "words",
        placeholder: "Петрова Анна Сергеевна",
        maxLength: 120,
        span: "half",
        hint: "Заполняется, если пациент младше 18 лет.",
      },
      {
        name: "guardianPhone",
        label: "Телефон представителя",
        type: "tel",
        required: (values) => isMinor(values?.birthDate),
        visibleWhen: (values) => isMinor(values?.birthDate),
        validation: "phone",
        mask: "phone",
        autocomplete: "tel",
        inputmode: "tel",
        placeholder: "+7 (999) 123-45-67",
        maxLength: 18,
        span: "half",
      },
    ],
  },
  {
    id: "contacts",
    title: "Контакты",
    description:
      "По этим контактам администратор подтвердит запись. Телефон обязателен.",
    fields: [
      {
        name: "phone",
        label: "Телефон",
        type: "tel",
        required: true,
        validation: "phone",
        mask: "phone",
        autocomplete: "tel",
        inputmode: "tel",
        placeholder: "+7 (999) 123-45-67",
        maxLength: 18,
        span: "half",
        hint: "Можно вставить номер в любом формате — он приведётся к +7 (999) 123-45-67.",
      },
      {
        name: "email",
        label: "Email",
        type: "email",
        required: true,
        validation: "email",
        autocomplete: "email",
        inputmode: "email",
        autocapitalize: "none",
        spellcheck: false,
        placeholder: "name@example.com",
        maxLength: 254,
        span: "half",
      },
      {
        name: "preferredContact",
        label: "Предпочтительный способ связи",
        type: "select",
        required: true,
        autocomplete: "off",
        options: contactOptions,
        placeholder: "Выберите способ связи",
        span: "half",
      },
      {
        name: "address",
        label: "Адрес проживания",
        type: "textarea",
        required: false,
        validation: "address",
        autocomplete: "street-address",
        placeholder: "Город, улица, дом, квартира",
        maxLength: 300,
        rows: 2,
        span: "full",
        hint: "Необязательно. Нужен только для выезда врача на дом.",
      },
    ],
  },
  {
    id: "insurance",
    title: "Страхование",
    description:
      "Если у вас есть полис ОМС или ДМС, укажите его — это ускорит оформление.",
    fields: [
      {
        name: "hasInsurance",
        label: "Есть ли у вас полис?",
        type: "radio",
        required: true,
        options: yesNoOptions,
        span: "full",
      },
      {
        name: "policyNumber",
        label: "Номер полиса",
        type: "text",
        required: true,
        visibleWhen: hasInsurance,
        validation: "policyNumber",
        mask: "policy",
        inputmode: "numeric",
        autocomplete: "off",
        placeholder: "1234 5678 9012 3456",
        maxLength: 19,
        span: "half",
        hint: "16 цифр полиса ОМС. Пробелы расставляются автоматически.",
      },
      {
        name: "insurer",
        label: "Страховая компания",
        type: "select",
        required: true,
        visibleWhen: hasInsurance,
        options: insurerOptions,
        placeholder: "Выберите компанию",
        span: "half",
      },
      {
        name: "insurerOther",
        label: "Название страховой компании",
        type: "text",
        required: true,
        visibleWhen: needsOtherInsurer,
        validation: "company",
        autocomplete: "organization",
        placeholder: "Например, «Медстрах»",
        maxLength: 100,
        span: "half",
      },
    ],
  },
  {
    id: "visit",
    title: "Визит",
    description:
      "Расскажите, что вас беспокоит, и выберите удобную дату. Врач ознакомится с ответами заранее.",
    fields: [
      {
        name: "visitReason",
        label: "Причина обращения",
        type: "select",
        required: true,
        options: visitReasonOptions,
        placeholder: "Выберите причину",
        span: "half",
      },
      {
        name: "preferredDate",
        label: "Желаемая дата приёма",
        type: "date",
        required: true,
        validation: "preferredDate",
        min: () => todayIso(),
        max: () => addDaysIso(90),
        span: "half",
        hint: "Можно выбрать дату в течение ближайших 90 дней.",
      },
      {
        name: "symptoms",
        label: "Что вас беспокоит?",
        type: "textarea",
        required: true,
        validation: "symptoms",
        placeholder: "Коротко опишите жалобы, когда они начались и что уже принимали",
        minLength: 10,
        maxLength: 1000,
        rows: 5,
        span: "full",
        counter: true,
        hint: "Минимум 10 символов. Не указывайте данные, не относящиеся к визиту.",
      },
      {
        name: "consent",
        label:
          "Я согласен(на) на обработку персональных данных и подтверждаю достоверность сведений",
        type: "checkbox",
        required: true,
        validation: "consent",
        span: "full",
        hint: "Согласие не сохраняется в черновике — после перезагрузки его нужно подтвердить заново.",
      },
    ],
  },
];

const ALL_FIELDS = SECTIONS.flatMap((section) => section.fields);

export function allFields() {
  return ALL_FIELDS;
}

export function getField(name) {
  return ALL_FIELDS.find((field) => field.name === name) ?? null;
}

export function isVisible(field, values) {
  return field.visibleWhen ? Boolean(field.visibleWhen(values)) : true;
}

export function isRequired(field, values) {
  return typeof field.required === "function"
    ? Boolean(field.required(values))
    : Boolean(field.required);
}
