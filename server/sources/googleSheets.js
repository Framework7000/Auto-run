const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

const SERVICE_ACCOUNT_PATH = path.join(__dirname, "..", "..", "data", "google-service-account.json");
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

const COLUMN_ALIASES = {
  ref: ["s/n", "sn", "id", "ref", "#"],
  task: ["task", "description", "work", "task description"],
  platform: ["platform", "tool", "agent", "ai"],
  status: ["status", "state"],
};

function columnLetter(index) {
  let letter = "";
  let n = index;
  while (n >= 0) {
    letter = String.fromCharCode((n % 26) + 65) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}

function matchColumn(headerCell, aliases) {
  const normalized = String(headerCell || "").trim().toLowerCase();
  return aliases.includes(normalized);
}

/**
 * Finds the header row and maps our logical fields onto real column
 * indexes. Sheets in the wild have blank leading rows, extra columns,
 * and summary tables further down — so we locate the header by looking
 * for a row that has both a "task" and a "platform" column rather than
 * assuming row 1.
 */
function findHeader(values) {
  for (let rowIndex = 0; rowIndex < values.length; rowIndex++) {
    const row = values[rowIndex] || [];
    const columns = {};
    for (let col = 0; col < row.length; col++) {
      for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
        if (columns[field] === undefined && matchColumn(row[col], aliases)) {
          columns[field] = col;
        }
      }
    }
    if (columns.task !== undefined && columns.platform !== undefined) {
      return { headerRowIndex: rowIndex, columns };
    }
  }
  return null;
}

/**
 * Pure parser over raw sheet values — kept separate from any network
 * call so it can be tested against real exported sheet data.
 * Returns rows with their 1-based sheet row number, which is what
 * writeStatus needs to target the right cell later.
 */
function parseSheetValues(values) {
  const header = findHeader(values);
  if (!header) {
    throw new Error(
      'Could not find a header row with both a "Task" and a "Platform" column. ' +
        "Check that the sheet has those column headings."
    );
  }

  const { headerRowIndex, columns } = header;
  const tasks = [];

  for (let rowIndex = headerRowIndex + 1; rowIndex < values.length; rowIndex++) {
    const row = values[rowIndex] || [];
    const taskText = String(row[columns.task] || "").trim();
    const platformText = String(row[columns.platform] || "").trim();

    // A row with no task text is the end of the task table (or a gap
    // before an unrelated summary table) — stop rather than scooping
    // up whatever else lives further down the sheet.
    if (!taskText) break;

    tasks.push({
      ref: columns.ref !== undefined ? String(row[columns.ref] || "").trim() : "",
      task: taskText,
      platforms: platformText
        ? platformText.split(",").map((p) => p.trim()).filter(Boolean)
        : [],
      status: columns.status !== undefined ? String(row[columns.status] || "").trim() : "",
      sheetRow: rowIndex + 1,
    });
  }

  return { tasks, columns, headerRowIndex };
}

function getAuth() {
  if (fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    return new google.auth.GoogleAuth({ keyFile: SERVICE_ACCOUNT_PATH, scopes: SCOPES });
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return new google.auth.GoogleAuth({ scopes: SCOPES });
  }
  throw new Error(
    "No Google credentials found. Put a service-account key at data/google-service-account.json " +
      "(and share your sheet with that service account's email), or set GOOGLE_APPLICATION_CREDENTIALS. " +
      "See docs/google-sheets-setup.md"
  );
}

async function getSheetsClient() {
  const auth = getAuth();
  return google.sheets({ version: "v4", auth: await auth.getClient() });
}

async function readTasks(spreadsheetId, range = "A1:Z500") {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  return parseSheetValues(res.data.values || []);
}

/**
 * Writes a single Status cell back to the sheet. This is the half that
 * closes the loop — a task finishing in Auto-Run flips its row in the
 * same sheet the team already looks at.
 */
async function writeStatus(spreadsheetId, sheetRow, statusColumnIndex, status) {
  const sheets = await getSheetsClient();
  const cell = `${columnLetter(statusColumnIndex)}${sheetRow}`;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: cell,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[status]] },
  });
  return cell;
}

function hasCredentials() {
  return fs.existsSync(SERVICE_ACCOUNT_PATH) || Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);
}

module.exports = {
  parseSheetValues,
  readTasks,
  writeStatus,
  columnLetter,
  hasCredentials,
  SERVICE_ACCOUNT_PATH,
};
