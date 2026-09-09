const el = (sel) => document.querySelector(sel);

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: options.body instanceof FormData ? {} : { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

let agents = [];
const agentById = (id) => agents.find((a) => a.id === id);
const agentName = (id) => (id === "you" ? "You" : agentById(id)?.name || id);
const agentColor = (id) => (id === "you" ? "#8899aa" : agentById(id)?.color || "#8899aa");

/** Pulls a bare sheet id out of a pasted Google Sheets URL. */
function extractSheetId(input) {
  const match = String(input).match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : String(input).trim();
}

async function loadAgents() {
  agents = await api("/api/agents");
  el("#agents-list").innerHTML = agents
    .map(
      (a) => `
      <div class="agent-chip" title="${escapeHtml(a.note || "")}">
        <span class="dot" style="background:${a.color}"></span>
        <span>${escapeHtml(a.name)}</span>
        ${a.disabled ? '<span class="hint">not wired</span>' : ""}
      </div>`
    )
    .join("");
}

async function loadSheetStatus() {
  try {
    const status = await api("/api/sheet/status");
    el("#sheet-status").textContent = status.credentialsConfigured
      ? "Google credentials found — sync is live."
      : "No Google credentials yet — see docs/google-sheets-setup.md";
    if (status.spreadsheetId) el("#f-sheet").value = status.spreadsheetId;
  } catch {
    el("#sheet-status").textContent = "Could not check sheet credentials.";
  }
}

async function loadTasks() {
  const tasks = await api("/api/tasks");
  const container = el("#tasks-list");
  if (!tasks.length) {
    container.innerHTML = '<p class="hint">No tasks yet — pull them from your sheet, or add one.</p>';
    return;
  }
  container.innerHTML = `
    <table>
      <thead><tr><th>Ref</th><th>Task</th><th>Council</th><th>Status</th></tr></thead>
      <tbody>
        ${tasks
          .map(
            (t) => `
          <tr class="task-row" data-id="${t.id}">
            <td class="ref">${escapeHtml(t.ref)}</td>
            <td>${escapeHtml(t.title)}</td>
            <td class="pipeline">
              ${t.platforms
                .map((p) => `<span class="dot" style="background:${agentColor(p)}" title="${escapeHtml(agentName(p))}"></span>`)
                .join('<span class="arrow">→</span>')}
              ${t.unknownPlatforms?.length ? `<span class="hint">?${escapeHtml(t.unknownPlatforms.join(","))}</span>` : ""}
            </td>
            <td><span class="badge ${t.status}">${t.status.replace(/_/g, " ")}</span></td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>`;
  container.querySelectorAll(".task-row").forEach((row) =>
    row.addEventListener("click", () => openDetail(row.dataset.id))
  );
}

/**
 * The Council view: every agent's turn and every note you sent, as one
 * chronological thread, colour-dotted by who said it.
 */
function renderThread(task) {
  if (!task.messages.length) {
    return '<p class="hint">Nothing yet — hit Run and the council goes to work.</p>';
  }
  return task.messages
    .map(
      (msg) => `
      <div class="msg ${msg.from === "you" ? "from-you" : ""} kind-${msg.kind}">
        <div class="msg-head">
          <span class="dot" style="background:${agentColor(msg.from)}"></span>
          <strong>${escapeHtml(agentName(msg.from))}</strong>
          <span class="hint">${msg.kind} · ${new Date(msg.at).toLocaleString()}</span>
        </div>
        <pre>${escapeHtml(msg.text)}</pre>
      </div>`
    )
    .join("");
}

async function openDetail(id) {
  const task = await api(`/api/tasks/${id}`);
  const content = el("#detail-content");

  const pipeline = task.platforms
    .map((p, i) => {
      const done = i < task.stageIndex;
      return `<span class="stage ${done ? "done" : ""}">
        <span class="dot" style="background:${agentColor(p)}"></span>${escapeHtml(agentName(p))}
      </span>`;
    })
    .join('<span class="arrow">→</span>');

  content.innerHTML = `
    <h2>${task.ref ? escapeHtml(task.ref) + " — " : ""}${escapeHtml(task.title)}</h2>
    <div class="pipeline-bar">${pipeline || '<span class="hint">no recognized platform</span>'}</div>
    <p class="brief">${escapeHtml(task.description)}</p>

    <div class="thread">${renderThread(task)}</div>

    <div class="action-row">
      <button id="btn-run">${task.messages.length ? "Re-run" : "Run"}</button>
      ${task.status === "awaiting_review" ? `
        <button id="btn-approve">Approve</button>
        <button id="btn-reject" class="danger">Send back with feedback</button>` : ""}
      ${task.spreadsheetId ? '<button id="btn-push" class="secondary">Write status to sheet</button>' : ""}
      <button id="btn-delete" class="secondary">Delete</button>
    </div>

    <div class="reply-box ${task.status === "needs_input" ? "" : "hidden"}" id="reply-box">
      <textarea id="reply-text" rows="3" placeholder="${
        task.status === "needs_input" ? "Answer the question above…" : "What should change?"
      }"></textarea>
      <button id="btn-send-reply">Send to ${escapeHtml(agentName(task.platforms[task.stageIndex] || task.platforms[0]))}</button>
    </div>
  `;

  const busy = (btn, label) => {
    btn.disabled = true;
    btn.textContent = label;
  };

  el("#btn-run").addEventListener("click", async (e) => {
    busy(e.target, "Running…");
    try {
      await api(`/api/tasks/${id}/run`, { method: "POST" });
      await Promise.all([openDetail(id), loadTasks()]);
    } catch (err) {
      alert(err.message);
      e.target.disabled = false;
    }
  });

  el("#btn-approve")?.addEventListener("click", async () => {
    await api(`/api/tasks/${id}/approve`, { method: "POST" });
    await Promise.all([openDetail(id), loadTasks()]);
  });

  el("#btn-reject")?.addEventListener("click", () => {
    el("#reply-box").classList.remove("hidden");
    el("#reply-text").focus();
  });

  el("#btn-push")?.addEventListener("click", async (e) => {
    busy(e.target, "Writing…");
    try {
      const result = await api(`/api/sheet/push-status/${id}`, { method: "POST" });
      alert(`Wrote "${result.status}" to ${result.cell}`);
    } catch (err) {
      alert(err.message);
    }
    e.target.disabled = false;
    e.target.textContent = "Write status to sheet";
  });

  el("#btn-send-reply").addEventListener("click", async (e) => {
    const text = el("#reply-text").value.trim();
    if (!text) return;
    busy(e.target, "Working…");
    const endpoint = task.status === "needs_input" ? "answer" : "reject";
    const body = task.status === "needs_input" ? { answer: text } : { feedback: text };
    try {
      await api(`/api/tasks/${id}/${endpoint}`, { method: "POST", body: JSON.stringify(body) });
      await Promise.all([openDetail(id), loadTasks()]);
    } catch (err) {
      alert(err.message);
      e.target.disabled = false;
    }
  });

  el("#btn-delete").addEventListener("click", async () => {
    if (!confirm("Delete this task?")) return;
    await api(`/api/tasks/${id}`, { method: "DELETE" });
    closeDetail();
    loadTasks();
  });

  el("#detail-overlay").classList.remove("hidden");
}

function closeDetail() {
  el("#detail-overlay").classList.add("hidden");
}

el("#close-detail").addEventListener("click", closeDetail);
el("#detail-overlay").addEventListener("click", (e) => {
  if (e.target.id === "detail-overlay") closeDetail();
});

el("#sync-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const spreadsheetId = extractSheetId(el("#f-sheet").value);
  if (!spreadsheetId) return;
  const btn = e.target.querySelector("button");
  btn.disabled = true;
  btn.textContent = "Pulling…";
  try {
    const result = await api("/api/sheet/sync", { method: "POST", body: JSON.stringify({ spreadsheetId }) });
    alert(`Imported ${result.created} task(s). Skipped ${result.skipped.length}.`);
    loadTasks();
  } catch (err) {
    alert(err.message);
  }
  btn.disabled = false;
  btn.textContent = "Pull pending tasks";
});

el("#task-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const description = el("#f-description").value.trim();
  const platforms = el("#f-platforms").value.split(",").map((p) => p.trim()).filter(Boolean);
  await api("/api/tasks", { method: "POST", body: JSON.stringify({ description, platforms }) });
  e.target.reset();
  loadTasks();
});

loadAgents().then(loadTasks);
loadSheetStatus();
setInterval(loadTasks, 8000);
