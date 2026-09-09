const assert = require("assert");
const { parseSheetValues, columnLetter } = require("../server/sources/googleSheets");
const { resolvePipeline } = require("../server/router");

// The real GradeNext TaskTracker layout, as read from the live sheet.
const REAL_SHEET = [
  ["S/n", "Task", "Platform", "Status"],
  ["T1", "Smart Lab", "Claude", "Pending"],
  ["T2", "404 flashcards (maths)", "ChatGPT", "Done"],
  ["T3", "Cognetry maths revieve", "Claude", "Pending"],
  ["T4", "3-8 slides", "Claude, ChatGPT", "Pending"],
  ["T5", "GN-Brosher", "ChatGPT", "verify"],
  ["T6", "Insta post", "ChatGPT", "Pending"],
  ["T7", "Math old questions", "ChatGPT", "Pending"],
  ["T8", "GenAI - 1,2 & python-L2 & webd - course slide fix", "ChatGPT, Canva", "Pending"],
  ["T9", "JAVA curriculum (priority-2) slides", "ChatGPT", "Pending"],
  ["T10", "Ppt sih", "Canva", "Pending"],
  ["T11", "Math content - image", "Claude", "Done"],
  ["T12", "gn-ppt(priority-1) & Gn-flyer", "ChatGPT", "Done"],
  ["T13", "Content should be provided in the advance version", "Claude", "Done"],
  ["T14", "Tshirt GN", "ChatGPT", "Pending"],
  ["T15", "Video GN", "Antigravity", "Pending"],
  ["T16", "", "", ""],
  [],
  ["Status", "Count", "", "Platform", "Count"],
  ["Done", "3", "", "Antigravity", "1"],
];

let passed = 0;
function check(name, fn) {
  fn();
  console.log(`  ok  ${name}`);
  passed++;
}

console.log("\nsheet parser");

check("finds the header row and maps all four columns", () => {
  const { columns, headerRowIndex } = parseSheetValues(REAL_SHEET);
  assert.strictEqual(headerRowIndex, 0);
  assert.deepStrictEqual(columns, { ref: 0, task: 1, platform: 2, status: 3 });
});

check("reads exactly the 15 real task rows, stopping before the summary table", () => {
  const { tasks } = parseSheetValues(REAL_SHEET);
  assert.strictEqual(tasks.length, 15);
  assert.strictEqual(tasks[0].ref, "T1");
  assert.strictEqual(tasks[14].ref, "T15");
});

check("keeps the real sheet row number so status can be written back", () => {
  const { tasks } = parseSheetValues(REAL_SHEET);
  // T1 is on spreadsheet row 2 (header is row 1).
  assert.strictEqual(tasks[0].sheetRow, 2);
  assert.strictEqual(tasks[14].sheetRow, 16);
});

check("splits a multi-platform cell into an ordered chain", () => {
  const { tasks } = parseSheetValues(REAL_SHEET);
  const t4 = tasks.find((t) => t.ref === "T4");
  assert.deepStrictEqual(t4.platforms, ["Claude", "ChatGPT"]);
  const t8 = tasks.find((t) => t.ref === "T8");
  assert.deepStrictEqual(t8.platforms, ["ChatGPT", "Canva"]);
});

check("does not split a task title that contains commas", () => {
  const { tasks } = parseSheetValues(REAL_SHEET);
  const t8 = tasks.find((t) => t.ref === "T8");
  assert.strictEqual(t8.task, "GenAI - 1,2 & python-L2 & webd - course slide fix");
});

check("handles a sheet with blank leading rows", () => {
  const shifted = [[], ["", "", ""], ...REAL_SHEET];
  const { tasks, headerRowIndex } = parseSheetValues(shifted);
  assert.strictEqual(headerRowIndex, 2);
  assert.strictEqual(tasks[0].sheetRow, 4);
});

check("throws a useful error when there is no task/platform header", () => {
  assert.throws(() => parseSheetValues([["Name", "Owner"], ["a", "b"]]), /Task.*Platform/i);
});

console.log("\ncolumn letters");

check("maps column indexes to spreadsheet letters", () => {
  assert.strictEqual(columnLetter(0), "A");
  assert.strictEqual(columnLetter(3), "D");
  assert.strictEqual(columnLetter(25), "Z");
  assert.strictEqual(columnLetter(26), "AA");
});

console.log("\nplatform routing");

check("routes every platform name used in the real sheet", () => {
  const { tasks } = parseSheetValues(REAL_SHEET);
  for (const task of tasks) {
    const { unknown } = resolvePipeline(task.platforms);
    assert.deepStrictEqual(unknown, [], `unrouted platform in ${task.ref}: ${unknown.join(",")}`);
  }
});

check("preserves chain order — Claude runs before ChatGPT on T4", () => {
  const { platforms } = resolvePipeline(["Claude", "ChatGPT"]);
  assert.deepStrictEqual(platforms, ["claude", "chatgpt"]);
});

check("matches platform names case-insensitively and with spacing variants", () => {
  assert.deepStrictEqual(resolvePipeline(["chatgpt"]).platforms, ["chatgpt"]);
  assert.deepStrictEqual(resolvePipeline(["chat gpt"]).platforms, ["chatgpt"]);
  assert.deepStrictEqual(resolvePipeline(["ANTIGRAVITY"]).platforms, ["antigravity"]);
});

check("reports an unrecognized platform instead of guessing", () => {
  const { platforms, unknown } = resolvePipeline(["Claude", "Midjourney"]);
  assert.deepStrictEqual(platforms, ["claude"]);
  assert.deepStrictEqual(unknown, ["Midjourney"]);
});

console.log(`\n${passed} passed\n`);
