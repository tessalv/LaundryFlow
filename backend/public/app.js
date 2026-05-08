// ===========================
// State Management
// ===========================

const REFRESH_INTERVAL_MS = 10000;
const SESSION_TIMER_TICK_MS = 1000;
const CURRENT_USER_ID = 1;

const state = {
    machines: [],
    machineViewModels: [],
    issues: [],
    sessions: [],
    isInitialLoading: true,
    pendingSessionMachineIds: new Set(),
    activeIssueMachineId: null,
    timerNow: Date.now()
};

// ===========================
// DOM References
// ===========================

const dom = {
    availableCount: document.getElementById("available-count"),
    inUseCount: document.getElementById("inuse-count"),
    maintenanceCount: document.getElementById("maintenance-count"),
    totalCount: document.getElementById("total-count"),
    machinesGrid: document.getElementById("machines-grid"),
    issuesTable: document.getElementById("issues-table"),
    machinesLoading: document.getElementById("machines-loading"),
    issuesLoading: document.getElementById("issues-loading"),
    toastContainer: document.getElementById("toast-container"),
    issueModal: document.getElementById("issue-modal"),
    issueMachineLabel: document.getElementById("issue-machine-label"),
    issueDescription: document.getElementById("issue-description"),
    cancelIssueBtn: document.getElementById("cancel-issue-btn"),
    submitIssueBtn: document.getElementById("submit-issue-btn"),
    notificationCount: document.getElementById("notification-count"),
    notificationBtn: document.getElementById("notification-btn")
};

// ===========================
// API Layer
// ===========================

function sanitizeBaseUrl(value) {
    if (!value) {
        return "";
    }
    return String(value).trim().replace(/\/+$/, "");
}

function resolveConfiguredApiBaseUrl() {
    const fromWindow = sanitizeBaseUrl(window.LF_API_BASE_URL);
    if (fromWindow) {
        return fromWindow;
    }

    const queryParams = new URLSearchParams(window.location.search);
    const fromQuery = sanitizeBaseUrl(queryParams.get("apiBaseUrl"));
    if (fromQuery) {
        return fromQuery;
    }

    const fromStorage = sanitizeBaseUrl(window.localStorage.getItem("laundryflow_api_base_url"));
    if (fromStorage) {
        return fromStorage;
    }

    // file:// cannot resolve relative /api routes, so default to local backend.
    if (window.location.protocol === "file:") {
        return "http://localhost:3000";
    }

    return "";
}

const API_BASE_URL = resolveConfiguredApiBaseUrl();

function buildApiUrl(path) {
    if (/^https?:\/\//i.test(path)) {
        return path;
    }
    return `${API_BASE_URL}${path}`;
}

async function apiRequest(path, options = {}) {
    let response;
    try {
        response = await fetch(buildApiUrl(path), {
            headers: {
                "Content-Type": "application/json"
            },
            ...options
        });
    } catch (err) {
        const baseHint = API_BASE_URL || "same origin";
        throw new Error(`Network error. Ensure backend is reachable at ${baseHint}.`);
    }

    let payload = null;
    try {
        payload = await response.json();
    } catch (err) {
        payload = null;
    }

    if (!response.ok) {
        const message = payload && payload.error ? payload.error : "Request failed";
        throw new Error(message);
    }

    return payload;
}

const api = {
    getMachines: () => apiRequest("/api/machines"),
    getIssues: () => apiRequest("/api/issues"),
    getSessions: () => apiRequest("/api/sessions"),
    createSession: (machineId, userId) => apiRequest("/api/sessions", {
        method: "POST",
        body: JSON.stringify({ machineId, userId })
    }),
    createIssue: (machineId, description) => apiRequest("/api/issues", {
        method: "POST",
        body: JSON.stringify({ machineId, description })
    })
};

// ===========================
// Data Normalization
// ===========================

function getField(item, ...keys) {
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(item, key)) {
            return item[key];
        }
    }
    return undefined;
}

function normalizeMachine(machine) {
    return {
        id: Number(getField(machine, "Id", "id")),
        name: String(getField(machine, "Name", "name") || "Unknown machine"),
        type: String(getField(machine, "Type", "type") || "Unknown")
    };
}

function normalizeIssue(issue) {
    return {
        id: Number(getField(issue, "Id", "id") || Date.now()),
        machineId: Number(getField(issue, "MachineId", "machineId")),
        description: String(getField(issue, "Description", "description") || "No description"),
        createdAt: getField(issue, "CreatedAt", "createdAt") || null,
        isResolved: Boolean(getField(issue, "IsResolved", "isResolved"))
    };
}

function normalizeSession(session) {
    return {
        id: Number(getField(session, "Id", "id") || Date.now()),
        machineId: Number(getField(session, "MachineId", "machineId")),
        userId: Number(getField(session, "UserId", "userId")),
        startTime: getField(session, "StartTime", "startTime") || null,
        endTime: getField(session, "EndTime", "endTime") || null
    };
}

function buildMachineViewModels() {
    const unresolvedIssueByMachine = new Set(
        state.issues
            .filter(issue => !issue.isResolved)
            .map(issue => issue.machineId)
    );

    const activeSessionMap = new Map();
    state.sessions
        .filter(session => !session.endTime)
        .forEach(session => {
            activeSessionMap.set(session.machineId, session);
        });

    state.machineViewModels = state.machines.map(machine => {
        const activeSession = activeSessionMap.get(machine.id) || null;
        const hasIssue = unresolvedIssueByMachine.has(machine.id);

        let status = "available";
        if (hasIssue) {
            status = "maintenance";
        } else if (activeSession) {
            status = "in-use";
        }

        return {
            ...machine,
            status,
            activeSessionStart: activeSession ? activeSession.startTime : null
        };
    });
}

// ===========================
// Rendering
// ===========================

function getStatusLabel(status) {
    if (status === "in-use") {
        return "In Use";
    }
    if (status === "maintenance") {
        return "Maintenance";
    }
    return "Available";
}

function getMachineHint(status) {
    if (status === "in-use") {
        return "Currently occupied";
    }
    if (status === "maintenance") {
        return "Under maintenance";
    }
    return "Ready to use";
}

function formatDuration(startTime) {
    if (!startTime) {
        return "";
    }

    const elapsedMs = Math.max(0, state.timerNow - new Date(startTime).getTime());
    const totalSeconds = Math.floor(elapsedMs / 1000);
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
}

function renderStats() {
    const available = state.machineViewModels.filter(machine => machine.status === "available").length;
    const inUse = state.machineViewModels.filter(machine => machine.status === "in-use").length;
    const maintenance = state.machineViewModels.filter(machine => machine.status === "maintenance").length;

    dom.availableCount.textContent = String(available);
    dom.inUseCount.textContent = String(inUse);
    dom.maintenanceCount.textContent = String(maintenance);
    dom.totalCount.textContent = String(state.machineViewModels.length);
}

function renderMachines() {
    if (state.isInitialLoading) {
        dom.machinesLoading.style.display = "block";
        dom.machinesGrid.innerHTML = "";
        return;
    }

    dom.machinesLoading.style.display = "none";

    if (!state.machineViewModels.length) {
        dom.machinesGrid.innerHTML = '<div class="loading-state">No machines found.</div>';
        return;
    }

    dom.machinesGrid.innerHTML = state.machineViewModels.map(machine => {
        const isSessionPending = state.pendingSessionMachineIds.has(machine.id);
        const isStartDisabled = machine.status !== "available" || isSessionPending;
        const headerClass = `status-${machine.status}`;
        const timerMarkup = machine.status === "in-use" && machine.activeSessionStart
            ? `<p class="session-timer">Session running: ${formatDuration(machine.activeSessionStart)}</p>`
            : "";

        return `
    <div class="machine-card ${isSessionPending ? "loading" : ""}">
    <div class="machine-header ${headerClass}">
      <div>
      <h3>${machine.name}</h3>
      <p>${machine.type}</p>
      </div>
      <span class="machine-status ${machine.status}">${getStatusLabel(machine.status)}</span>
    </div>

    <p>${getMachineHint(machine.status)}</p>
    ${timerMarkup}

    <div class="machine-actions">
      <button
      class="start-btn"
      data-action="start"
      data-machine-id="${machine.id}"
      ${isStartDisabled ? "disabled" : ""}
      >
      ${isSessionPending ? "Starting..." : "Start"}
      </button>

      <button
      class="report-btn"
      data-action="report"
      data-machine-id="${machine.id}"
      >
      Report
      </button>
    </div>
    </div>
  `;
    }).join("");
}

function renderIssues() {
    if (state.isInitialLoading) {
        dom.issuesLoading.style.display = "block";
        dom.issuesTable.innerHTML = "";
        return;
    }

    dom.issuesLoading.style.display = "none";

    if (!state.issues.length) {
        dom.issuesTable.innerHTML = '<tr><td colspan="3">No issues reported.</td></tr>';
        return;
    }

    const machineNameById = new Map(state.machines.map(machine => [machine.id, machine.name]));

    dom.issuesTable.innerHTML = state.issues.map(issue => {
        const machineName = machineNameById.get(issue.machineId) || `Machine #${issue.machineId}`;
        return `
    <tr>
    <td>${machineName}</td>
    <td>${issue.description}</td>
    <td>${issue.isResolved ? "Resolved" : "Open"}</td>
    </tr>
  `;
    }).join("");
}

function renderNotificationCount() {
    const unresolvedCount = state.issues.filter(issue => !issue.isResolved).length;
    dom.notificationCount.textContent = String(unresolvedCount);
}

function renderAll() {
    renderStats();
    renderMachines();
    renderIssues();
    renderNotificationCount();
}

// ===========================
// UI Feedback
// ===========================

function showToast(message, type = "success") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;

    dom.toastContainer.appendChild(toast);

    window.setTimeout(() => {
        toast.remove();
    }, 3200);
}

function openIssueModal(machineId) {
    const machine = state.machineViewModels.find(item => item.id === machineId);
    if (!machine) {
        return;
    }

    state.activeIssueMachineId = machineId;
    dom.issueMachineLabel.textContent = `Machine: ${machine.name}`;
    dom.issueDescription.value = "";
    dom.issueModal.classList.add("open");
    dom.issueModal.setAttribute("aria-hidden", "false");
    dom.issueDescription.focus();
}

function closeIssueModal() {
    state.activeIssueMachineId = null;
    dom.issueModal.classList.remove("open");
    dom.issueModal.setAttribute("aria-hidden", "true");
}

// ===========================
// Data Loading
// ===========================

async function refreshDashboardData({ initial = false } = {}) {
    if (initial) {
        state.isInitialLoading = true;
        renderAll();
    }

    try {
        const [machines, issues, sessions] = await Promise.all([
            api.getMachines(),
            api.getIssues(),
            api.getSessions()
        ]);

        state.machines = machines.map(normalizeMachine);
        state.issues = issues.map(normalizeIssue);
        state.sessions = sessions.map(normalizeSession);

        buildMachineViewModels();
    } catch (err) {
        showToast(`Unable to refresh dashboard: ${err.message}`, "error");
    } finally {
        state.isInitialLoading = false;
        renderAll();
    }
}

// ===========================
// User Actions
// ===========================

async function startSession(machineId) {
    const machine = state.machineViewModels.find(item => item.id === machineId);
    if (!machine) {
        showToast("Machine not found.", "error");
        return;
    }

    if (machine.status !== "available") {
        showToast("This machine cannot be started right now.", "error");
        return;
    }

    if (state.pendingSessionMachineIds.has(machineId)) {
        return;
    }

    state.pendingSessionMachineIds.add(machineId);
    renderMachines();

    try {
        await api.createSession(machineId, CURRENT_USER_ID);

        // Optimistic local update so the UI reacts immediately after the request.
        state.sessions.unshift({
            id: Date.now(),
            machineId,
            userId: CURRENT_USER_ID,
            startTime: new Date().toISOString(),
            endTime: null
        });

        buildMachineViewModels();
        renderAll();
        showToast(`Session started for ${machine.name}.`, "success");

        // Follow up with a real refresh to stay aligned with server truth.
        await refreshDashboardData();
    } catch (err) {
        showToast(`Could not start session: ${err.message}`, "error");
    } finally {
        state.pendingSessionMachineIds.delete(machineId);
        renderMachines();
    }
}

async function submitIssueReport() {
    if (!state.activeIssueMachineId) {
        return;
    }

    const description = dom.issueDescription.value.trim();
    if (!description) {
        showToast("Please add an issue description.", "error");
        return;
    }

    dom.submitIssueBtn.disabled = true;

    try {
        await api.createIssue(state.activeIssueMachineId, description);

        state.issues.unshift({
            id: Date.now(),
            machineId: state.activeIssueMachineId,
            description,
            createdAt: new Date().toISOString(),
            isResolved: false
        });

        buildMachineViewModels();
        renderAll();
        closeIssueModal();
        showToast("Issue reported successfully.", "success");

        await refreshDashboardData();
    } catch (err) {
        showToast(`Could not report issue: ${err.message}`, "error");
    } finally {
        dom.submitIssueBtn.disabled = false;
    }
}

// ===========================
// Event Listeners
// ===========================

function attachEventListeners() {
    dom.machinesGrid.addEventListener("click", event => {
        const target = event.target;
        if (!(target instanceof HTMLButtonElement)) {
            return;
        }

        const machineId = Number(target.dataset.machineId);
        const action = target.dataset.action;

        if (!machineId || !action) {
            return;
        }

        if (action === "start") {
            startSession(machineId);
        }

        if (action === "report") {
            openIssueModal(machineId);
        }
    });

    dom.cancelIssueBtn.addEventListener("click", closeIssueModal);
    dom.submitIssueBtn.addEventListener("click", submitIssueReport);

    dom.issueModal.addEventListener("click", event => {
        if (event.target === dom.issueModal) {
            closeIssueModal();
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && dom.issueModal.classList.contains("open")) {
            closeIssueModal();
        }
    });

    dom.notificationBtn.addEventListener("click", () => {
        const unresolved = state.issues.filter(issue => !issue.isResolved).length;
        showToast(`You have ${unresolved} open maintenance issue(s).`, "success");
    });
}

// ===========================
// App Bootstrapping
// ===========================

async function initApp() {
    attachEventListeners();
    await refreshDashboardData({ initial: true });

    window.setInterval(() => {
        refreshDashboardData();
    }, REFRESH_INTERVAL_MS);

    window.setInterval(() => {
        state.timerNow = Date.now();
        renderMachines();
    }, SESSION_TIMER_TICK_MS);
}

initApp();