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

let agentsCache = [];

async function loadAgents() {
  agentsCache = await api("/api/agents");
  const select = el("#f-agent");
  select.innerHTML = '<option value="">Auto</option>' +
    agentsCache.filter((a) => !a.disabled).map((a) => `<option value="${a.id}">${a.name}</option>`).join("");

  const list = el("#agents-list");
  list.innerHTML = agentsCache.map((a) => `
    <div class="agent-chip" data-agent="${a.id}">
      <span class="dot" id="dot-${a.id}"></span>
      <span>${a.name}${a.disabled ? " (manual)" : ""}</span>
    </div>
  `).join("");

  for (const a of agentsCache) {
    if (a.disabled) continue;
    api(`/api/agents/${a.id}/status`)
      .then((s) => {
        const dot = el(`#dot-${a.id}`);
        if (dot) dot.className = "dot " + (s.loggedIn ? "ok" : "err");
      })
      .catch(() => {});
  }
}

function statusLabel(s) {
  return s.replace(/_/g, " ");
}

async function loadTasks() {
  const tasks = await api("/api/tasks");
  const container = el("#tasks-list");
  if (tasks.length === 0) {
    container.innerHTML = '<p class="hint">No tasks yet — create one on the left.</p>';
    return;
  }
  container.innerHTML = `
    <table>
      <thead><tr><th>Title</th><th>Agent</th><th>Status</th><th>Updated</th></tr></thead>
      <tbody>
        ${tasks.map((t) => `
          <tr class="task-row" data-id="${t.id}">
            <td>${escapeHtml(t.title)}</td>
            <td>${escapeHtml(t.agentId)}</td>
            <td><span class="badge ${t.status}">${statusLabel(t.status)}</span></td>
            <td>${new Date(t.updatedAt).toLocaleString()}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
  container.querySelectorAll(".task-row").forEach((row) => {
    row.addEventListener("click", () => openDetail(row.dataset.id));
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function openDetail(id) {
  const task = await api(`/api/tasks/${id}`);
  const overlay = el("#detail-overlay");
  const content = el("#detail-content");

  content.innerHTML = `
    <h2>${escapeHtml(task.title)}</h2>
    <p class="hint">Agent: ${escapeHtml(task.agentId)} · Status: <span class="badge ${task.status}">${statusLabel(task.status)}</span></p>
    <p>${escapeHtml(task.description)}</p>

    ${task.attempts.map((a, i) => `
      <div class="attempt">
        <strong>Attempt ${i + 1}</strong> <span class="hint">${new Date(a.at).toLocaleString()}</span>
        ${a.feedback ? `<p class="hint">Feedback sent: "${escapeHtml(a.feedback)}"</p>` : ""}
        ${a.error ? `<pre style="color:var(--err)">${escapeHtml(a.error)}</pre>` : `<pre>${escapeHtml(a.output)}</pre>`}
      </div>
    `).join("")}

    <div class="action-row">
      <button id="btn-run">${task.attempts.length === 0 ? "Run" : "Re-run"}</button>
      ${task.status === "awaiting_review" ? `
        <button id="btn-approve">Approve</button>
        <button id="btn-reject" class="danger">Reject &amp; send feedback</button>
      ` : ""}
      <button id="btn-delete" class="secondary">Delete task</button>
    </div>

    <div class="feedback-box hidden" id="feedback-box">
      <textarea id="feedback-text" rows="3" placeholder="What should change?"></textarea>
      <button id="btn-send-feedback">Send back to ${escapeHtml(task.agentId)}</button>
    </div>
  `;

  el("#btn-run").addEventListener("click", async (e) => {
    e.target.disabled = true;
    e.target.textContent = "Running...";
    try {
      await api(`/api/tasks/${id}/run`, { method: "POST" });
      await Promise.all([openDetail(id), loadTasks()]);
    } catch (err) {
      alert(err.message);
      e.target.disabled = false;
    }
  });

  const approveBtn = el("#btn-approve");
  if (approveBtn) {
    approveBtn.addEventListener("click", async () => {
      await api(`/api/tasks/${id}/approve`, { method: "POST" });
      closeDetail();
      loadTasks();
    });
  }

  const rejectBtn = el("#btn-reject");
  if (rejectBtn) {
    rejectBtn.addEventListener("click", () => {
      el("#feedback-box").classList.remove("hidden");
    });
  }

  const sendFeedbackBtn = el("#btn-send-feedback");
  if (sendFeedbackBtn) {
    sendFeedbackBtn.addEventListener("click", async () => {
      const feedback = el("#feedback-text").value.trim();
      if (!feedback) return;
      sendFeedbackBtn.disabled = true;
      sendFeedbackBtn.textContent = "Re-running...";
      try {
        await api(`/api/tasks/${id}/reject`, { method: "POST", body: JSON.stringify({ feedback }) });
        await Promise.all([openDetail(id), loadTasks()]);
      } catch (err) {
        alert(err.message);
        sendFeedbackBtn.disabled = false;
      }
    });
  }

  el("#btn-delete").addEventListener("click", async () => {
    if (!confirm("Delete this task?")) return;
    await api(`/api/tasks/${id}`, { method: "DELETE" });
    closeDetail();
    loadTasks();
  });

  overlay.classList.remove("hidden");
}

function closeDetail() {
  el("#detail-overlay").classList.add("hidden");
}

el("#close-detail").addEventListener("click", closeDetail);
el("#detail-overlay").addEventListener("click", (e) => {
  if (e.target.id === "detail-overlay") closeDetail();
});

el("#task-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = el("#f-title").value.trim();
  const description = el("#f-description").value.trim();
  const tags = el("#f-tags").value.split(",").map((t) => t.trim()).filter(Boolean);
  const agentId = el("#f-agent").value || undefined;

  await api("/api/tasks", { method: "POST", body: JSON.stringify({ title, description, tags, agentId }) });
  e.target.reset();
  loadTasks();
});

el("#upload-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const file = el("#f-file").files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append("file", file);
  try {
    const result = await api("/api/upload", { method: "POST", body: formData });
    alert(`Created ${result.created} task(s).${result.skipped.length ? ` Skipped ${result.skipped.length} row(s) — see console.` : ""}`);
    if (result.skipped.length) console.log("Skipped rows:", result.skipped);
    e.target.reset();
    loadTasks();
  } catch (err) {
    alert(err.message);
  }
});

loadAgents();
loadTasks();
setInterval(loadTasks, 8000);
