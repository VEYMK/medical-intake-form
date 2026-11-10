import { readFile } from "node:fs/promises";
import { access } from "node:fs/promises";
import { constants } from "node:fs";

const html = await readFile("index.html", "utf8");
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

check(/<html lang="ru">/.test(html), "index.html must declare lang=\"ru\"");
check(/<main\b/.test(html), "index.html must contain a <main> landmark");
check((html.match(/<h1\b/g) ?? []).length === 1, "index.html must contain exactly one <h1>");
check(/<form[^>]+novalidate/.test(html), "the form must use novalidate and custom validation");
check(/aria-live="polite"/.test(html), "a polite live region is required for status messages");

const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
check(new Set(ids).size === ids.length, "element IDs must be unique");

const localAssets = [
  "css/styles.css",
  "js/app.js",
  "js/schema.js",
  "js/form-builder.js",
  "js/validators.js",
  "js/formatters.js",
  "js/draft.js",
  "assets/favicon.svg",
];

for (const asset of localAssets) {
  try {
    await access(asset, constants.R_OK);
  } catch {
    failures.push(`missing asset: ${asset}`);
  }
}

const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>/g)];
check(inlineScripts.length === 0, "inline <script> blocks are blocked by the CSP; use external modules");

const inlineStyles = [...html.matchAll(/\sstyle="/g)];
check(inlineStyles.length === 0, "inline style attributes are blocked by the CSP");

const refs = [...html.matchAll(/aria-(?:labelledby|describedby)="([^"]+)"/g)]
  .flatMap((match) => match[1].split(/\s+/))
  .filter(Boolean);

for (const ref of refs) {
  if (!ids.includes(ref)) failures.push(`aria reference points to missing id: ${ref}`);
}

if (failures.length > 0) {
  console.error("Static checks failed:");
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log(`Static checks passed (${ids.length} unique IDs, ${localAssets.length} assets).`);
