// Validates data/themes.json and every data/questions/*.json file.
// No dependencies: run with `node scripts/validate.mjs` (also runs in CI).
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const errors = [];
const fail = (where, msg) => errors.push(`${where}: ${msg}`);
const isText = (v) => typeof v === "string" && v.trim().length > 0;

const themes = JSON.parse(readFileSync(join(root, "data/themes.json"), "utf8"));
const groups = new Set(themes.groups.map((g) => g.id));
const themeIds = new Set();
for (const t of themes.themes) {
  if (!/^[a-z0-9-]+$/.test(t.id)) fail(`theme ${t.id}`, "id must be kebab-case");
  if (themeIds.has(t.id)) fail(`theme ${t.id}`, "duplicate theme id");
  if (!groups.has(t.group)) fail(`theme ${t.id}`, `unknown group "${t.group}"`);
  if (!isText(t.title) || !isText(t.description)) fail(`theme ${t.id}`, "title and description required");
  themeIds.add(t.id);
}

const seenIds = new Set();
const counts = {};
const files = readdirSync(join(root, "data/questions")).filter((f) => f.endsWith(".json"));
for (const file of files) {
  const data = JSON.parse(readFileSync(join(root, "data/questions", file), "utf8"));
  if (!themeIds.has(data.theme)) fail(file, `unknown theme "${data.theme}"`);
  if (file !== `${data.theme}.json`) fail(file, `file name must be ${data.theme}.json`);
  counts[data.theme] = { mcq: 0, order: 0 };

  for (const q of data.questions) {
    const where = `${file} › ${q.id ?? "(no id)"}`;
    if (!isText(q.id) || !q.id.startsWith(`${data.theme}-`)) fail(where, `id must start with "${data.theme}-"`);
    if (seenIds.has(q.id)) fail(where, "duplicate question id");
    seenIds.add(q.id);
    if (!isText(q.question)) fail(where, "question text required");
    if (!isText(q.explanation)) fail(where, "explanation required");
    if (![1, 2, 3].includes(q.level)) fail(where, "level must be 1, 2 or 3");

    if (q.type === "mcq") {
      counts[data.theme].mcq++;
      const n = Array.isArray(q.options) ? q.options.length : 0;
      if (n < 2 || n > 6) fail(where, "mcq needs 2–6 options");
      if (n && new Set(q.options).size !== n) fail(where, "duplicate options");
      if (n && !q.options.every(isText)) fail(where, "empty option");
      const answers = Array.isArray(q.answer) ? q.answer : [q.answer];
      if (!answers.length || !answers.every((a) => Number.isInteger(a) && a >= 0 && a < n))
        fail(where, "answer must be valid option index(es)");
      if (new Set(answers).size !== answers.length) fail(where, "duplicate answer index");
      if (Array.isArray(q.answer) && q.answer.length > 1 && !/select all|which two|which three/i.test(q.question))
        fail(where, 'multiple-answer questions must say "Select all that apply" (or "Which two…")');
    } else if (q.type === "order") {
      counts[data.theme].order++;
      const n = Array.isArray(q.steps) ? q.steps.length : 0;
      if (n < 3 || n > 8) fail(where, "order needs 3–8 steps");
      if (n && new Set(q.steps).size !== n) fail(where, "duplicate steps");
      if (n && !q.steps.every(isText)) fail(where, "empty step");
    } else {
      fail(where, `unknown type "${q.type}"`);
    }
  }
}

for (const id of themeIds) if (!counts[id]) fail(`theme ${id}`, "has no question file");

if (errors.length) {
  console.error(`✗ ${errors.length} problem(s):\n  ${errors.join("\n  ")}`);
  process.exit(1);
}
const total = Object.values(counts).reduce((s, c) => s + c.mcq + c.order, 0);
console.log(`✓ ${themeIds.size} themes, ${total} questions`);
for (const [id, c] of Object.entries(counts)) console.log(`  ${id.padEnd(16)} ${c.mcq} mcq · ${c.order} order`);
