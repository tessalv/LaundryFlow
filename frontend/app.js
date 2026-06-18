/**
 * =========================================================
 * LaundryFlow Frontend Application
 * =========================================================
 * Main browser application responsible for:
 * - Fetching and normalizing backend data
 * - Rendering machine, issue, and session views
 * - Managing modal forms and user interactions
 * =========================================================
 */

// =========================================================
// STATE MANAGEMENT
// =========================================================

/** Refresh interval used to keep dashboard data current. */
const REFRESH_INTERVAL_MS = 10000;

/** Timer tick interval used to update countdowns on screen. */
const SESSION_TIMER_TICK_MS = 1000;

/** Local storage key used to persist session countdown metadata. */
const SESSION_META_STORAGE_KEY = "laundryflow_session_meta_v1";

/** Moderator code required for repair and unlock actions. */
const MODERATOR_CODE = "0000";

/**
 * In-memory application state used by rendering and form handlers.
 */
const state = {
    machines: [],
    machineViewModels: [],
    issues: [],
    sessions: [],
    users: [],
    rooms: [],
    isInitialLoading: true,
    pendingSessionMachineIds: new Set(),
    pendingSessionCompletionIds: new Set(),
    activeIssueMachineId: null,
    activeRepairMachineId: null,
    activeRepairAction: "repair",
    activeStartMachineId: null,
    activeStopMachineId: null,
    activeStopAction: "stop",
    activeModeratorAction: "add",
    activeModeratorMachineId: null,
    activeModeratorMachineName: "",
    activeUsageRange: "7d",
    activeUsageMachineId: "all",
    activeMaintenanceMachineId: "all",
    timerNow: Date.now(),
    sessionMetaByMachineId: loadSessionMetaStore()
};

// =========================================================
// DOM REFERENCES
// =========================================================

/** Cached DOM nodes used throughout the application. */
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
    repairModal: document.getElementById("repair-modal"),
    repairModalTitle: document.getElementById("repair-modal-title"),
    repairMachineLabel: document.getElementById("repair-machine-label"),
    repairForm: document.getElementById("repair-form"),
    repairFormError: document.getElementById("repair-form-error"),
    repairCodeInputs: Array.from(document.querySelectorAll("[data-repair-code-digit]")),
    cancelRepairBtn: document.getElementById("cancel-repair-btn"),
    submitRepairBtn: document.getElementById("submit-repair-btn"),
    addMachineButton: document.getElementById("add-machine-btn"),
    addMachineModal: document.getElementById("add-machine-modal"),
    addMachineForm: document.getElementById("add-machine-form"),
    addMachineFormError: document.getElementById("add-machine-form-error"),
    addMachineType: document.getElementById("add-machine-type"),
    addMachineBrand: document.getElementById("add-machine-brand"),
    addMachineReference: document.getElementById("add-machine-reference"),
    addMachineInstalledAt: document.getElementById("add-machine-installed-at"),
    addMachinePreview: document.getElementById("add-machine-preview"),
    cancelAddMachineBtn: document.getElementById("cancel-add-machine-btn"),
    submitAddMachineBtn: document.getElementById("submit-add-machine-btn"),
    // Moderator code modal elements
    moderatorCodeModal: document.getElementById("moderator-code-modal"),
    moderatorCodeForm: document.getElementById("moderator-code-form"),
    moderatorFormError: document.getElementById("moderator-form-error"),
    moderatorCodeSubtitle: document.getElementById("moderator-code-subtitle"),
    moderatorCodeInputs: Array.from(document.querySelectorAll("[data-mod-digit]")),
    cancelModeratorCodeBtn: document.getElementById("cancel-moderator-code"),
    submitModeratorCodeBtn: document.getElementById("submit-moderator-code"),
    usageStatsButton: document.getElementById("usage-stats-btn"),
    usageStatsModal: document.getElementById("usage-stats-modal"),
    closeUsageStatsBtn: document.getElementById("close-usage-stats-btn"),
    usageMachineSelect: document.getElementById("usage-machine-select"),
    usageTotalCount: document.getElementById("usage-total-count"),
    usagePeakCount: document.getElementById("usage-peak-count"),
    usageAverageCount: document.getElementById("usage-average-count"),
    usageChart: document.getElementById("usage-chart"),
    wattageChart: document.getElementById("wattage-chart"),
    apartmentWattageList: document.getElementById("apartment-wattage-list"),
    usageRangeButtons: Array.from(document.querySelectorAll("[data-usage-range]")),
    maintenanceStatsButton: document.getElementById("maintenance-stats-btn"),
    maintenanceStatsModal: document.getElementById("maintenance-stats-modal"),
    closeMaintenanceStatsBtn: document.getElementById("close-maintenance-stats-btn"),
    maintenanceMachineSelect: document.getElementById("maintenance-machine-select"),
    maintenanceStatsGrid: document.getElementById("maintenance-stats-grid"),
    // notification elements removed
    advertisementModal: document.getElementById("advertisement-modal"),
    adCountdown: document.getElementById("ad-countdown"),
    startSessionModal: document.getElementById("start-session-modal"),
    startMachineLabel: document.getElementById("start-machine-label"),
    cancelStartBtn: document.getElementById("cancel-start-btn"),
    submitStartBtn: document.getElementById("submit-start-btn"),
    startSessionForm: document.getElementById("start-session-form"),
    startFormError: document.getElementById("start-form-error"),
    // stop confirmation modal refs
    stopConfirmModal: document.getElementById("stop-confirm-modal"),
    stopConfirmForm: document.getElementById("stop-confirm-form"),
    stopConfirmCancel: document.getElementById("cancel-stop-confirm"),
    openModeratorConfirmBtn: document.getElementById("open-moderator-confirm"),
    stopConfirmSubmit: document.getElementById("submit-stop-confirm")
};

// =========================================================
// API LAYER
// =========================================================

/**
 * Normalizes a configured API base URL by trimming whitespace and trailing slashes.
 * @param {string} value - Raw base URL value.
 * @returns {string} Normalized base URL.
 */
function sanitizeBaseUrl(value) {
    if (!value) {
        return "";
    }
    return String(value).trim().replace(/\/+$/, "");
}

/**
 * Resolves the backend base URL from runtime overrides, the query string, local storage, or file preview mode.
 * @returns {string} Resolved backend base URL or an empty string for same-origin requests.
 */
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

    if (window.location.protocol === "file:") {
        return "http://localhost:3000";
    }

    return "";
}

/** The active backend base URL used by API requests. */
const API_BASE_URL = resolveConfiguredApiBaseUrl();

/**
 * Builds a request URL from an API path.
 * @param {string} path - Relative or absolute API path.
 * @returns {string} Fully qualified request URL.
 */
function buildApiUrl(path) {
    if (/^https?:\/\//i.test(path)) {
        return path;
    }
    return `${API_BASE_URL}${path}`;
}

/**
 * Sends a JSON request to the backend and returns the parsed response body.
 * @param {string} path - API endpoint path.
 * @param {Object} [options={}] - Fetch options.
 * @returns {Promise<any>} Parsed response payload.
 */
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

/** Convenience wrapper around backend CRUD endpoints. */
const api = {
    getMachines: () => apiRequest("/api/machines"),
    getIssues: () => apiRequest("/api/issues"),
    getSessions: () => apiRequest("/api/sessions"),
    getUsers: () => apiRequest("/api/users"),
    getRooms: () => apiRequest("/api/rooms"),
    createMachine: payload => apiRequest("/api/machines", {
        method: "POST",
        body: JSON.stringify(payload)
    }),
    deleteMachine: (machineId, moderatorCode) => apiRequest(`/api/machines/${machineId}`, {
        method: "DELETE",
        body: JSON.stringify({ moderatorCode })
    }),
    createUser: payload => apiRequest("/api/users", {
        method: "POST",
        body: JSON.stringify(payload)
    }),
    createRoom: payload => apiRequest("/api/rooms", {
        method: "POST",
        body: JSON.stringify(payload)
    }),
    createSession: (machineId, userId) => apiRequest("/api/sessions", {
        method: "POST",
        body: JSON.stringify({ machineId, userId })
    }),
    endSession: sessionId => apiRequest(`/api/sessions/${sessionId}`, {
        method: "PUT"
    }),
    createIssue: (machineId, description) => apiRequest("/api/issues", {
        method: "POST",
        body: JSON.stringify({ machineId, description })
    }),
    resolveIssue: issueId => apiRequest(`/api/issues/${issueId}`, {
        method: "PUT"
    })
};

// =========================================================
// DATA NORMALIZATION
// =========================================================

/**
 * Returns the first matching field value from a list of possible keys.
 * @param {Object} item - Source object.
 * @param {...string} keys - Candidate property names.
 * @returns {any} Matched property value, or undefined when none is present.
 */
function getField(item, ...keys) {
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(item, key)) {
            return item[key];
        }
    }
    return undefined;
}

/**
 * Normalizes a machine record into the frontend shape.
 * @param {Object} machine - Raw machine payload from the backend.
 * @returns {Object} Normalized machine record.
 */
function normalizeMachine(machine) {
    return {
        id: Number(getField(machine, "Id", "id")),
        name: String(getField(machine, "Name", "name") || "Unknown machine"),
        type: String(getField(machine, "Type", "type") || "Unknown"),
        brand: String(getField(machine, "Brand", "brand") || "Unknown brand"),
        reference: String(getField(machine, "Reference", "reference") || "Unknown reference"),
        installedAt: getField(machine, "InstalledAt", "installedAt") || null
    };
}

/**
 * Normalizes a machine issue record into the frontend shape.
 * @param {Object} issue - Raw issue payload from the backend.
 * @returns {Object} Normalized issue record.
 */
function normalizeIssue(issue) {
    return {
        id: Number(getField(issue, "Id", "id") || Date.now()),
        machineId: Number(getField(issue, "MachineId", "machineId")),
        description: String(getField(issue, "Description", "description") || "No description"),
        createdAt: getField(issue, "CreatedAt", "createdAt") || null,
        resolvedAt: getField(issue, "ResolvedAt", "resolvedAt") || null,
        isResolved: Boolean(getField(issue, "IsResolved", "isResolved"))
    };
}

/**
 * Normalizes a machine session record into the frontend shape.
 * @param {Object} session - Raw session payload from the backend.
 * @returns {Object} Normalized session record.
 */
function normalizeSession(session) {
    return {
        id: Number(getField(session, "Id", "id") || Date.now()),
        machineId: Number(getField(session, "MachineId", "machineId")),
        userId: Number(getField(session, "UserId", "userId")),
        startTime: getField(session, "StartTime", "startTime") || null,
        endTime: getField(session, "EndTime", "endTime") || null
    };
}

/**
 * Normalizes a user record into the frontend shape.
 * @param {Object} user - Raw user payload from the backend.
 * @returns {Object} Normalized user record.
 */
function normalizeUser(user) {
    return {
        id: Number(getField(user, "Id", "id")),
        name: String(getField(user, "Name", "name") || ""),
        email: String(getField(user, "Email", "email") || "").trim().toLowerCase(),
        phone: String(getField(user, "Phone", "phone") || ""),
        roomId: Number(getField(user, "RoomId", "roomId"))
    };
}

/**
 * Normalizes a room record into the frontend shape.
 * @param {Object} room - Raw room payload from the backend.
 * @returns {Object} Normalized room record.
 */
function normalizeRoom(room) {
    return {
        id: Number(getField(room, "Id", "id")),
        roomNumber: String(getField(room, "RoomNumber", "roomNumber") || "")
    };
}

/**
 * Splits a composite room number into apartment and room parts.
 * @param {string} roomNumber - Composite room number such as "A-101".
 * @returns {{ apartmentNumber: string, roomNumber: string }} Parsed room parts.
 */
function splitCompositeRoomNumber(roomNumber) {
    const normalized = String(roomNumber || "").trim();
    if (!normalized) {
        return { apartmentNumber: "", roomNumber: "" };
    }

    const parts = normalized.split("-");
    if (parts.length < 2) {
        return { apartmentNumber: "", roomNumber: normalized };
    }

    return {
        apartmentNumber: parts[0].trim(),
        roomNumber: parts.slice(1).join("-").trim()
    };
}

// =========================================================
// SESSION META STORE
// =========================================================

/**
 * Loads persisted session countdown metadata from local storage.
 * @returns {Object} Stored metadata map keyed by machine id.
 */
function loadSessionMetaStore() {
    try {
        const raw = window.localStorage.getItem(SESSION_META_STORAGE_KEY);
        if (!raw) {
            return {};
        }
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch (err) {
        return {};
    }
}

/** Persists the current session metadata map to local storage. */
function saveSessionMetaStore() {
    window.localStorage.setItem(SESSION_META_STORAGE_KEY, JSON.stringify(state.sessionMetaByMachineId));
}

/**
 * Stores metadata for a machine session and persists it immediately.
 * @param {number} machineId - Machine identifier.
 * @param {Object} meta - Session metadata payload.
 */
function setSessionMeta(machineId, meta) {
    state.sessionMetaByMachineId[machineId] = meta;
    saveSessionMetaStore();
}

/**
 * Merges partial metadata into an existing machine session record.
 * @param {number} machineId - Machine identifier.
 * @param {Object} patch - Partial metadata update.
 */
function patchSessionMeta(machineId, patch) {
    const current = state.sessionMetaByMachineId[machineId] || {};
    state.sessionMetaByMachineId[machineId] = {
        ...current,
        ...patch
    };
    saveSessionMetaStore();
}

/**
 * Removes session metadata for a machine when it is no longer needed.
 * @param {number} machineId - Machine identifier.
 */
function clearSessionMeta(machineId) {
    if (state.sessionMetaByMachineId[machineId]) {
        delete state.sessionMetaByMachineId[machineId];
        saveSessionMetaStore();
    }
}

/**
 * Removes stale session metadata entries that no longer correspond to active sessions.
 */
function syncSessionMetaWithServerData() {
    const activeSessionByMachine = new Map();
    state.sessions
        .filter(session => !session.endTime)
        .forEach(session => {
            activeSessionByMachine.set(session.machineId, session);
        });

    const machineIdsInStore = Object.keys(state.sessionMetaByMachineId).map(id => Number(id));
    machineIdsInStore.forEach(machineId => {
        if (!activeSessionByMachine.has(machineId)) {
            clearSessionMeta(machineId);
        }
    });
}

// =========================================================
// FORMATTING HELPERS
// =========================================================

/**
 * Formats a duration in seconds as hh:mm:ss.
 * @param {number} totalSeconds - Duration in seconds.
 * @returns {string} Formatted duration string.
 */
function formatDurationFromSeconds(totalSeconds) {
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
}

/**
 * Formats elapsed time since the given start time.
 * @param {string|null} startTime - Session start timestamp.
 * @returns {string} Elapsed time string.
 */
function formatElapsedFromStart(startTime) {
    if (!startTime) {
        return "00:00:00";
    }
    const elapsedMs = Math.max(0, state.timerNow - new Date(startTime).getTime());
    return formatDurationFromSeconds(Math.floor(elapsedMs / 1000));
}

/**
 * Formats a remaining time label for the machine card.
 * @param {number} remainingSeconds - Remaining seconds in the session.
 * @returns {string} Human-readable remaining time label.
 */
function formatRemainingLabel(remainingSeconds) {
    if (remainingSeconds <= 0) {
        return "0 min remaining";
    }
    const mins = Math.ceil(remainingSeconds / 60);
    return `${mins} min remaining`;
}

/**
 * Formats an ISO date as a short local clock time.
 * @param {string|null} isoDate - ISO timestamp.
 * @returns {string} Local time label.
 */
function formatClockTime(isoDate) {
    if (!isoDate) {
        return "Unknown";
    }
    return new Date(isoDate).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });
}

/** Formats an installation date for machine cards and stats. */
function formatInstallationDate(isoDate) {
    if (!isoDate) return "Unknown";
    const parsed = new Date(isoDate);
    if (!Number.isFinite(parsed.getTime())) return "Unknown";
    return parsed.toLocaleDateString('en-US', { year: "numeric", month: "short", day: "numeric" });
}

/** Formats the approximate age of a machine since installation. */
function formatMachineAge(isoDate) {
    if (!isoDate) return "Unknown";
    const installedMs = new Date(isoDate).getTime();
    if (!Number.isFinite(installedMs)) return "Unknown";
    const elapsedDays = Math.max(0, Math.floor((Date.now() - installedMs) / (24 * 60 * 60 * 1000)));
    const years = Math.floor(elapsedDays / 365);
    const months = Math.floor((elapsedDays % 365) / 30);
    const days = elapsedDays % 30;
    if (years > 0) return `${years}y ${months}m`;
    if (months > 0) return `${months}m ${days}d`;
    return `${days}d`;
}

/**
 * Converts an internal status value into a display label.
 * @param {string} status - Machine status value.
 * @returns {string} User-facing status label.
 */
function getStatusLabel(status) {
    if (status === "in-use") {
        return "In Use";
    }
    if (status === "waiting-collection") {
        return "In Use";
    }
    if (status === "maintenance") {
        return "Maintenance";
    }
    return "Available";
}

/**
 * Builds a short hint shown under each machine card.
 * @param {string} status - Machine status value.
 * @param {boolean} [isWaitingCollection=false] - Whether the cycle is complete but not collected yet.
 * @returns {string} Helper text for the machine card.
 */
function getMachineHint(status, isWaitingCollection = false) {
    if (status === "waiting-collection" || (status === "in-use" && isWaitingCollection)) {
        return "Cycle complete. Waiting for pickup.";
    }
    if (status === "in-use") {
        return "Cycle currently running";
    }
    if (status === "waiting-collection") {
        return "Cycle complete. Waiting for pickup.";
    }
    if (status === "maintenance") {
        return "Under maintenance";
    }
    return "Ready to use";
}

// =========================================================
// VIEW MODEL CONSTRUCTION
// =========================================================

/**
 * Builds the derived machine view models used by rendering.
 */
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
        const sessionMeta = state.sessionMetaByMachineId[machine.id] || null;
        const activeUser = activeSession ? state.users.find(user => user.id === activeSession.userId) || null : null;
        const activeRoom = activeUser ? state.rooms.find(room => room.id === activeUser.roomId) || null : null;
        const roomParts = activeRoom ? splitCompositeRoomNumber(activeRoom.roomNumber) : { apartmentNumber: "", roomNumber: "" };
        const apartmentNumber = sessionMeta && sessionMeta.apartmentNumber
            ? String(sessionMeta.apartmentNumber)
            : roomParts.apartmentNumber || "Unknown";
        const roomNumber = sessionMeta && sessionMeta.roomNumber
            ? String(sessionMeta.roomNumber)
            : roomParts.roomNumber || "Unknown";

        let remainingSeconds = null;
        let progressPercent = null;

        if (activeSession && sessionMeta && Number(sessionMeta.endMs) > 0 && Number(sessionMeta.startMs) > 0) {
            remainingSeconds = Math.max(0, Math.floor((sessionMeta.endMs - state.timerNow) / 1000));
            const elapsedMs = Math.max(0, state.timerNow - Number(sessionMeta.startMs));
            const totalMs = Math.max(1, Number(sessionMeta.endMs) - Number(sessionMeta.startMs));
            progressPercent = Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100));
        }

        let status = "available";
        if (hasIssue) {
            status = "maintenance";
        } else if (activeSession) {
            status = Number.isFinite(remainingSeconds) && remainingSeconds <= 0
                ? "waiting-collection"
                : "in-use";
        }

        return {
            ...machine,
            status,
            activeSessionId: activeSession ? activeSession.id : null,
            activeSessionUserId: activeSession ? activeSession.userId : null,
            activeSessionStart: activeSession ? activeSession.startTime : null,
            remainingSeconds,
            progressPercent,
            runningUserFirstName: sessionMeta ? String(sessionMeta.userFirstName || "Resident") : "Resident",
            apartmentNumber,
            roomNumber
        };
    });
}

// =========================================================
// RENDERING
// =========================================================

/** Renders the dashboard counters. */
function renderStats() {
    const available = state.machineViewModels.filter(machine => machine.status === "available").length;
    const inUse = state.machineViewModels.filter(machine => machine.status === "in-use" || machine.status === "waiting-collection").length;
    const maintenance = state.machineViewModels.filter(machine => machine.status === "maintenance").length;

    dom.availableCount.textContent = String(available);
    dom.inUseCount.textContent = String(inUse);
    dom.maintenanceCount.textContent = String(maintenance);
    dom.totalCount.textContent = String(state.machineViewModels.length);
}

/**
 * Renders the live session panel for a machine card.
 * @param {Object} machine - Normalized machine view model.
 * @returns {string} HTML markup for the running panel.
 */
function renderRunningPanel(machine) {
    if (machine.status !== "in-use" && machine.status !== "waiting-collection") {
        return "";
    }

    const hasCountdown = Number.isFinite(machine.remainingSeconds);
    const isWaitingCollection = machine.status === "waiting-collection" || (hasCountdown && machine.remainingSeconds <= 0);
    const remainingLabel = hasCountdown
        ? (isWaitingCollection ? "Waiting for pickup" : formatRemainingLabel(machine.remainingSeconds))
        : "Time remaining unavailable";
    const runningDetailsMarkup = `
            <div class="running-metrics">
                <span>Started: <strong>${formatClockTime(machine.activeSessionStart)}</strong></span>
            </div>`;
    const completedDetailsMarkup = `
            <div class="running-metrics">
                <span>Apartment: <strong>${machine.apartmentNumber || "Unknown"}</strong></span>
                <span>Room: <strong>${machine.roomNumber || "Unknown"}</strong></span>
            </div>`;

    const progressMarkup = hasCountdown && Number.isFinite(machine.progressPercent)
        ? `
      <div class="session-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(machine.progressPercent)}">
        <div class="session-progress-fill" style="width: ${machine.progressPercent.toFixed(1)}%;"></div>
      </div>`
        : "";

    const waitingCollectionMarkup = isWaitingCollection
        ? '<p class="collection-waiting-note">Cycle complete. Waiting for the owner to collect their laundry.</p>'
        : "";

    return `
    <div class="machine-running-panel">
      <div class="running-header">
        <span class="live-indicator">Live cycle</span>
        <span class="timer-chip">${remainingLabel}</span>
      </div>
                        ${isWaitingCollection ? completedDetailsMarkup : runningDetailsMarkup}
            ${waitingCollectionMarkup}
      ${progressMarkup}
    </div>
    `;
}

/** Renders the machine metadata block for a machine card. */
function renderMachineMeta(machine) {
    return `
                <div class="machine-meta">
                        <span><strong>Brand</strong><em>${machine.brand}</em></span>
                        <span><strong>Reference</strong><em>${machine.reference}</em></span>
                        <span><strong>Installed</strong><em>${formatInstallationDate(machine.installedAt)}</em></span>
                </div>
        `;
}

/**
 * Renders the action buttons for a machine card.
 * @param {Object} machine - Normalized machine view model.
 * @param {boolean} isSessionPending - Whether a start request is still pending.
 * @returns {string} HTML markup for the action area.
 */
function renderMachineActions(machine, isSessionPending) {
    if (machine.status === "maintenance") {
        return `
            <div class="machine-actions maintenance-actions">
                <button
                    class="repair-btn"
                    data-action="repair"
                    data-machine-id="${machine.id}"
                >
                    Machine repaired
                </button>
            </div>
            `;
    }

    if (machine.status === "in-use" || machine.status === "waiting-collection") {
        const isWaitingCollection = machine.status === "waiting-collection";
        const primaryActionMarkup = isWaitingCollection
            ? `
            <button
                class="collect-btn"
                data-action="collect"
                data-machine-id="${machine.id}"
            >
                Stuff collected
            </button>`
            : `
            <button
                class="stop-btn"
                data-action="stop"
                data-machine-id="${machine.id}"
            >
                Stop
            </button>`;

        return `
      <div class="machine-actions">
        <div class="actions-top">
                                <span class="timer-chip">${isWaitingCollection ? "Waiting for pickup" : (Number.isFinite(machine.remainingSeconds) ? formatRemainingLabel(machine.remainingSeconds) : "Cycle running")}</span>
                <button
                    class="report-btn"
                    data-action="report"
                    data-machine-id="${machine.id}"
                >
                    Report
                </button>
        </div>
        <div class="actions-bottom">
            ${primaryActionMarkup}
        </div>
      </div>
      `;
    }

    const isStartDisabled = machine.status !== "available" || isSessionPending;
    return `
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
    `;
}

/** Renders all machine cards in the grid. */
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

    const cards = [];

    state.machineViewModels.forEach((machine, idx) => {
        const isSessionPending = state.pendingSessionMachineIds.has(machine.id);
        const isWaitingCollection = Number.isFinite(machine.remainingSeconds) && machine.remainingSeconds <= 0;
        const cardStatusClass = isWaitingCollection ? "status-waiting-collection" : `status-${machine.status}`;
        const machineHtml = `
                <div class="machine-card ${cardStatusClass} ${isSessionPending ? "loading" : ""}">
                    <button
                        class="delete-corner-btn"
                        type="button"
                        aria-label="Delete machine ${machine.name}"
                        data-action="delete"
                        data-machine-id="${machine.id}"
                    >&times;</button>
                    <div class="machine-header">
                        <div>
                            <h3>${machine.name}</h3>
                            <p>${machine.type}</p>
                        </div>
                        <span class="machine-status ${machine.status}">${getStatusLabel(machine.status)}</span>
                    </div>

                    <p>${getMachineHint(machine.status, isWaitingCollection)}</p>
                    ${renderMachineMeta(machine)}
                    ${renderRunningPanel(machine)}
                    ${renderMachineActions(machine, isSessionPending)}
                </div>
            `;

        cards.push(machineHtml);
    });

    dom.machinesGrid.innerHTML = cards.join("");
}

/** Renders the issues table. */
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

/** Returns the machine usage aggregation settings for the active time range. */
function getUsageRangeConfig(range) {
    if (range === "month") {
        return {
            bucketCount: 4,
            bucketLabel: index => `W${index + 1}`,
            bucketStart: index => {
                const start = new Date();
                start.setHours(0, 0, 0, 0);
                start.setDate(start.getDate() - ((3 - index) * 7));
                return start;
            },
            title: "Last 4 weeks"
        };
    }

    if (range === "year") {
        return {
            bucketCount: 12,
            bucketLabel: index => new Date(new Date().getFullYear(), index, 1).toLocaleString([], { month: "short" }),
            bucketStart: index => new Date(new Date().getFullYear(), index, 1),
            title: "Last 12 months"
        };
    }

    return {
        bucketCount: 7,
        bucketLabel: index => new Date(Date.now() - ((6 - index) * 24 * 60 * 60 * 1000)).toLocaleDateString([], { weekday: "short" }),
        bucketStart: index => {
            const start = new Date();
            start.setHours(0, 0, 0, 0);
            start.setDate(start.getDate() - (6 - index));
            return start;
        },
        title: "Last 7 days"
    };
}

/** Returns the machines available in the usage stats filter. */
function getUsageMachineOptions() {
    return state.machines
        .slice()
        .sort((left, right) => String(left.name || "").localeCompare(String(right.name || "")));
}

/** Returns the duration in hours for a session. */
function getSessionDurationHours(session) {
    if (!session || !session.startTime) {
        return 0;
    }

    const startTimeMs = new Date(session.startTime).getTime();
    if (!Number.isFinite(startTimeMs)) {
        return 0;
    }

    const endTimeMs = session.endTime ? new Date(session.endTime).getTime() : NaN;
    if (Number.isFinite(endTimeMs) && endTimeMs >= startTimeMs) {
        return (endTimeMs - startTimeMs) / (1000 * 60 * 60);
    }

    const sessionMeta = state.sessionMetaByMachineId[session.machineId];
    if (sessionMeta && Number.isFinite(sessionMeta.startMs)) {
        const liveEndMs = Number.isFinite(sessionMeta.endMs) ? sessionMeta.endMs : state.timerNow;
        if (liveEndMs >= sessionMeta.startMs) {
            return (liveEndMs - sessionMeta.startMs) / (1000 * 60 * 60);
        }
    }

    return 0;
}

/** Returns the sessions included in the usage chart filters. */
function getFilteredUsageSessions() {
    return state.sessions.filter(session => {
        if (!session.startTime) {
            return false;
        }

        if (state.activeUsageMachineId !== "all" && Number(state.activeUsageMachineId) !== session.machineId) {
            return false;
        }

        const sessionDate = new Date(session.startTime);
        if (!Number.isFinite(sessionDate.getTime())) {
            return false;
        }

        const range = state.activeUsageRange;
        const now = new Date();

        if (range === "year") {
            return sessionDate.getFullYear() === now.getFullYear();
        }

        if (range === "month") {
            const startWindow = new Date();
            startWindow.setHours(0, 0, 0, 0);
            startWindow.setDate(startWindow.getDate() - 27);
            return sessionDate >= startWindow && sessionDate <= now;
        }

        const startWindow = new Date();
        startWindow.setHours(0, 0, 0, 0);
        startWindow.setDate(startWindow.getDate() - 6);
        return sessionDate >= startWindow && sessionDate <= now;
    });
}

/** Builds usage buckets from the current session list. */
function buildUsageBuckets(range) {
    const config = getUsageRangeConfig(range);
    const buckets = Array.from({ length: config.bucketCount }, (_, index) => ({
        label: config.bucketLabel(index),
        hours: 0
    }));

    const sessionsByTime = getFilteredUsageSessions();

    if (range === "year") {
        const year = new Date().getFullYear();
        sessionsByTime.forEach(session => {
            const startDate = new Date(session.startTime);
            if (startDate.getFullYear() !== year) {
                return;
            }
            const bucketIndex = startDate.getMonth();
            if (bucketIndex >= 0 && bucketIndex < buckets.length) {
                buckets[bucketIndex].hours += getSessionDurationHours(session);
            }
        });
        return buckets;
    }

    if (range === "month") {
        const today = new Date();
        const startWindow = new Date();
        startWindow.setHours(0, 0, 0, 0);
        startWindow.setDate(startWindow.getDate() - 27);

        sessionsByTime.forEach(session => {
            const startDate = new Date(session.startTime);
            if (startDate < startWindow || startDate > today) {
                return;
            }
            const diffDays = Math.floor((startDate.getTime() - startWindow.getTime()) / (24 * 60 * 60 * 1000));
            const bucketIndex = Math.min(3, Math.floor(diffDays / 7));
            buckets[bucketIndex].hours += getSessionDurationHours(session);
        });

        return buckets;
    }

    const startWindow = new Date();
    startWindow.setHours(0, 0, 0, 0);
    startWindow.setDate(startWindow.getDate() - 6);

    sessionsByTime.forEach(session => {
        const startDate = new Date(session.startTime);
        if (startDate < startWindow) {
            return;
        }
        const diffDays = Math.floor((startDate.getTime() - startWindow.getTime()) / (24 * 60 * 60 * 1000));
        if (diffDays >= 0 && diffDays < buckets.length) {
            buckets[diffDays].hours += getSessionDurationHours(session);
        }
    });

    return buckets;
}

/** Renders the usage chart and summary cards. */
function renderUsageStats() {
    const config = getUsageRangeConfig(state.activeUsageRange);
    const buckets = buildUsageBuckets(state.activeUsageRange);
    const total = buckets.reduce((sum, bucket) => sum + bucket.hours, 0);
    const peak = buckets.reduce((max, bucket) => Math.max(max, bucket.hours), 0);
    const average = buckets.length ? total / buckets.length : 0;

    if (dom.usageTotalCount) {
        dom.usageTotalCount.textContent = total.toFixed(2);
    }
    if (dom.usagePeakCount) {
        dom.usagePeakCount.textContent = peak.toFixed(2);
    }
    if (dom.usageAverageCount) {
        dom.usageAverageCount.textContent = average.toFixed(2);
    }

    if (!dom.usageChart) {
        return;
    }

    const maxValue = Math.max(1, peak);
    dom.usageChart.innerHTML = `
        <div class="usage-chart-header">
            <span class="usage-chart-title">${config.title}</span>
            <span class="usage-chart-subtitle">Machine hours used</span>
        </div>
        <div class="usage-bars" role="img" aria-label="Machine usage chart">
            ${buckets.map(bucket => `
                <div class="usage-bar-item">
                    <div class="usage-bar-track">
                        <div class="usage-bar-fill" style="height: ${Math.max(8, (bucket.hours / maxValue) * 100)}%;"></div>
                    </div>
                    <span class="usage-bar-value">${bucket.hours.toFixed(2)}h</span>
                    <span class="usage-bar-label">${bucket.label}</span>
                </div>
            `).join("")}
        </div>
    `;

    if (dom.usageMachineSelect) {
        const selectedMachineId = String(state.activeUsageMachineId);
        dom.usageMachineSelect.innerHTML = `
            <option value="all">All machines</option>
            ${getUsageMachineOptions().map(machine => `<option value="${machine.id}">${machine.name}</option>`).join("")}
        `;
        dom.usageMachineSelect.value = selectedMachineId;
    }

    if (dom.usageRangeButtons.length) {
        dom.usageRangeButtons.forEach(button => {
            button.classList.toggle("active", button.dataset.usageRange === state.activeUsageRange);
        });
    }

    renderWattageStats();

}

/** Formats a duration since a timestamp as a compact human-readable label. */
function formatDurationSince(isoDate) {
    if (!isoDate) {
        return "No maintenance yet";
    }

    const startMs = new Date(isoDate).getTime();
    if (!Number.isFinite(startMs)) {
        return "No maintenance yet";
    }

    const elapsedMs = Math.max(0, Date.now() - startMs);
    const totalMinutes = Math.floor(elapsedMs / 60000);
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0) {
        return `${days}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m`;
    }

    if (hours > 0) {
        return `${hours}h ${String(minutes).padStart(2, "0")}m`;
    }

    if (minutes > 0) {
        return `${minutes}m`;
    }

    return "<1m";
}

/** Formats a timestamp for the maintenance stats cards. */
function formatMaintenanceTimestamp(isoDate) {
    if (!isoDate) {
        return "Never";
    }

    const parsed = new Date(isoDate);
    if (!Number.isFinite(parsed.getTime())) {
        return "Never";
    }

    return parsed.toLocaleString([], {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

/** Returns the latest resolved maintenance timestamp for a machine. */
function getLatestMaintenanceTimestamp(machineId) {
    const resolvedIssues = state.issues
        .filter(issue => issue.machineId === machineId && issue.isResolved)
        .sort((left, right) => {
            const leftTime = new Date(left.resolvedAt || left.createdAt || 0).getTime();
            const rightTime = new Date(right.resolvedAt || right.createdAt || 0).getTime();
            return rightTime - leftTime;
        });

    if (!resolvedIssues.length) {
        return null;
    }

    return resolvedIssues[0].resolvedAt || resolvedIssues[0].createdAt || null;
}

/** Returns maintenance cards sorted by the longest time since last repair. */
function getMaintenanceStatsEntries() {
    const selectedMachineId = String(state.activeMaintenanceMachineId || "all");

    return state.machines
        .filter(machine => selectedMachineId === "all" || String(machine.id) === selectedMachineId)
        .map(machine => {
            const latestMaintenanceAt = getLatestMaintenanceTimestamp(machine.id);
            const latestMaintenanceMs = latestMaintenanceAt ? new Date(latestMaintenanceAt).getTime() : NaN;
            return {
                machine,
                latestMaintenanceAt,
                latestMaintenanceMs: Number.isFinite(latestMaintenanceMs) ? latestMaintenanceMs : null,
                elapsedLabel: formatDurationSince(latestMaintenanceAt),
                installedLabel: formatInstallationDate(machine.installedAt),
                machineAgeLabel: formatMachineAge(machine.installedAt)
            };
        })
        .sort((left, right) => {
            if (left.latestMaintenanceMs === null && right.latestMaintenanceMs === null) {
                return String(left.machine.name || "").localeCompare(String(right.machine.name || ""));
            }
            if (left.latestMaintenanceMs === null) {
                return 1;
            }
            if (right.latestMaintenanceMs === null) {
                return -1;
            }
            return left.latestMaintenanceMs - right.latestMaintenanceMs;
        });
}

/** Returns the available maintenance machine options. */
function getMaintenanceMachineOptions() {
    return state.machines
        .slice()
        .sort((left, right) => String(left.name || "").localeCompare(String(right.name || "")));
}

/** Renders the maintenance statistics cards. */
function renderMaintenanceStats() {
    if (!dom.maintenanceStatsGrid) {
        return;
    }

    const entries = getMaintenanceStatsEntries();

    if (dom.maintenanceMachineSelect) {
        const selectedMachineId = String(state.activeMaintenanceMachineId || "all");
        dom.maintenanceMachineSelect.innerHTML = `
            <option value="all">All machines</option>
            ${getMaintenanceMachineOptions().map(machine => `<option value="${machine.id}">${machine.name}</option>`).join("")}
        `;
        dom.maintenanceMachineSelect.value = selectedMachineId;
    }

    if (!entries.length) {
        dom.maintenanceStatsGrid.innerHTML = '<div class="maintenance-stats-empty">No machines available yet.</div>';
        return;
    }

    dom.maintenanceStatsGrid.innerHTML = entries.map(({ machine, latestMaintenanceAt, elapsedLabel, installedLabel, machineAgeLabel }) => `
        <article class="maintenance-stat-card">
            <div class="maintenance-stat-header">
                <div>
                    <h4>${machine.name}</h4>
                    <p>${machine.type}</p>
                </div>
                <span class="maintenance-stat-pill ${machine.status}">${getStatusLabel(machine.status)}</span>
            </div>
            <div class="maintenance-stat-duration">${elapsedLabel}</div>
            <div class="maintenance-stat-meta">
                <span>Brand</span>
                <strong>${machine.brand}</strong>
                <span>Reference</span>
                <strong>${machine.reference}</strong>
                <span>Installed on</span>
                <strong>${installedLabel}</strong>
                <span>Machine age</span>
                <strong>${machineAgeLabel}</strong>
                <span>Last maintenance</span>
                <strong>${formatMaintenanceTimestamp(latestMaintenanceAt)}</strong>
            </div>
            <p class="maintenance-stat-note">${latestMaintenanceAt ? "Measured from the latest resolved maintenance issue." : "No resolved maintenance recorded yet."}</p>
        </article>
    `).join("");
}

/** Placeholder kept for compatibility with removed notification UI. */
function renderNotificationCount() {
    // notification count removed
}

/** Renders the complete dashboard view. */
function renderAll() {
    renderStats();
    renderUsageStats();
    renderMaintenanceStats();
    renderMachines();
    renderIssues();
}

// =========================================================
// MODAL MANAGEMENT
// =========================================================

/** Displays a transient toast message. */
function showToast(message, type = "success") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;

    dom.toastContainer.appendChild(toast);

    window.setTimeout(() => {
        toast.remove();
    }, 3200);
}

/** Opens the issue report modal for a machine. */
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

/** Displays a validation message for the repair form. */
function setRepairFormError(message) {
    if (!dom.repairFormError) {
        return;
    }

    dom.repairFormError.textContent = message || "";
    dom.repairFormError.classList.toggle("show", Boolean(message));
}

/** Clears repair form errors and visual validation states. */
function clearRepairFormErrors() {
    if (!dom.repairForm) {
        return;
    }

    dom.repairForm.querySelectorAll(".field-error").forEach(node => {
        node.textContent = "";
    });
    dom.repairCodeInputs.forEach(input => input.classList.remove("invalid"));
    setRepairFormError("");
}

/** Returns the 4-digit moderator code entered in the repair modal. */
function getRepairCodeValue() {
    return dom.repairCodeInputs.map(input => String(input.value || "").trim()).join("");
}

/** Returns the next default machine name for the selected type. */
function getNextMachineName(machineType) {
    const normalizedType = String(machineType || "washer").trim().toLowerCase() === "dryer" ? "dryer" : "washer";
    const displayType = normalizedType === "dryer" ? "Dryer" : "Washer";
    const existingCount = state.machines.filter(machine => String(machine.type || "").trim().toLowerCase() === normalizedType).length;
    return `${displayType} ${existingCount + 1}`;
}

/** Returns a random item from a list. */
function getRandomItem(items) {
    return items[Math.floor(Math.random() * items.length)];
}

/** Returns a random past date formatted for an input[type="date"]. */
function getRandomInstallationDate() {
    const daysAgo = 45 + Math.floor(Math.random() * 900);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString().slice(0, 10);
}

/** Builds default machine metadata for the add-machine form. */
function buildMachineDefaults(machineType) {
    const normalizedType = String(machineType || "washer").trim().toLowerCase() === "dryer" ? "dryer" : "washer";
    const prefix = normalizedType === "dryer" ? "DRY" : "WSH";
    const brandOptions = normalizedType === "dryer"
        ? ["Bosch", "Siemens", "Whirlpool", "Electrolux", "Beko"]
        : ["LG", "Samsung", "Miele", "Haier", "Indesit"];

    return {
        brand: getRandomItem(brandOptions),
        reference: `${prefix}-${String(1000 + Math.floor(Math.random() * 9000)).padStart(4, "0")}`,
        installedAt: getRandomInstallationDate()
    };
}

/** Displays the current preview text for the add-machine form. */
function updateAddMachinePreview() {
    if (!dom.addMachinePreview || !dom.addMachineType) {
        return;
    }

    const machineType = dom.addMachineType.value;
    const defaults = buildMachineDefaults(machineType);
    const machineName = getNextMachineName(machineType);

    if (dom.addMachineBrand) {
        dom.addMachineBrand.value = '';
        dom.addMachineBrand.placeholder = `e.g ${defaults.brand}`;
    }
    if (dom.addMachineReference) {
        dom.addMachineReference.value = '';
        dom.addMachineReference.placeholder = `e.g ${defaults.reference}`;
    }
    if (dom.addMachineInstalledAt) {
        dom.addMachineInstalledAt.value = '';
        dom.addMachineInstalledAt.title = `Example: ${defaults.installedAt}`;
    }

    dom.addMachinePreview.textContent = `New machine name: ${machineName} ? ${defaults.brand} ? ${defaults.reference}`;
    if (dom.addMachinePreview) dom.addMachinePreview.classList.add('example');

    // Remove example highlighting when the user starts typing
    if (dom.addMachineBrand) {
        dom.addMachineBrand.addEventListener('input', () => {
            if (dom.addMachineBrand.value.trim()) dom.addMachinePreview.classList.remove('example');
            else dom.addMachinePreview.classList.add('example');
        });
    }
    if (dom.addMachineReference) {
        dom.addMachineReference.addEventListener('input', () => {
            if (dom.addMachineReference.value.trim()) dom.addMachinePreview.classList.remove('example');
            else dom.addMachinePreview.classList.add('example');
        });
    }
}

/** Displays an error inside the add-machine modal. */
function setAddMachineFormError(fieldName, message) {
    if (!dom.addMachineForm) {
        return;
    }

    const field = dom.addMachineForm.elements.namedItem(fieldName);
    const errorNode = dom.addMachineForm.querySelector(`[data-error-for="${fieldName}"]`);

    if (field instanceof HTMLElement) {
        field.classList.toggle("invalid", Boolean(message));
    }

    if (errorNode) {
        errorNode.textContent = message || "";
    }
}

/** Clears validation state from the add-machine modal. */
function clearAddMachineFormErrors() {
    if (!dom.addMachineForm) {
        return;
    }

    dom.addMachineForm.querySelectorAll(".field-error").forEach(node => {
        node.textContent = "";
    });
    dom.addMachineForm.querySelectorAll("input, select").forEach(field => field.classList.remove("invalid"));

    if (dom.addMachineFormError) {
        dom.addMachineFormError.textContent = "";
        dom.addMachineFormError.classList.remove("show");
    }
}

/** Opens the add-machine modal. */
function openAddMachineModal() {
    clearAddMachineFormErrors();

    if (dom.addMachineForm) {
        dom.addMachineForm.reset();
    }

    if (dom.addMachineType) {
        dom.addMachineType.value = "washer";
    }

    updateAddMachinePreview();
    dom.addMachineModal.classList.add("open");
    dom.addMachineModal.setAttribute("aria-hidden", "false");

    // focus first brand input for convenience
    if (dom.addMachineBrand) {
        dom.addMachineBrand.focus();
    }
}

/** Updates the moderator modal copy and actions for the active flow. */
function setModeratorCodeModalContext(action = "add", machineName = "") {
    const isDeleteFlow = action === "delete";
    const isCollectFlow = action === "collect";
    if (dom.moderatorCodeModal) {
        dom.moderatorCodeModal.dataset.moderatorAction = action;
    }
    if (dom.moderatorCodeSubtitle) {
        dom.moderatorCodeSubtitle.textContent = isDeleteFlow
            ? `Enter the 4-digit moderator code to delete ${machineName || "this machine"}.`
            : isCollectFlow
                ? "Enter the 4-digit moderator code to validate collected stuff."
                : "Enter the 4-digit moderator code to access the Add Machine form.";
    }
    if (dom.submitModeratorCodeBtn) {
        dom.submitModeratorCodeBtn.textContent = isDeleteFlow
            ? "Delete Machine"
            : isCollectFlow
                ? "Validate Collection"
                : "Enter";
    }
}

/** Opens the moderator code modal which gates access to Add Machine or delete actions. */
function openModeratorCodeModal(action = "add", machineId = null) {
    if (!dom.moderatorCodeForm) return;
    if (dom.moderatorCodeForm) dom.moderatorCodeForm.reset();
    const targetMachine = Number.isFinite(Number(machineId))
        ? state.machineViewModels.find(item => item.id === Number(machineId))
        : null;
    state.activeModeratorAction = action;
    state.activeModeratorMachineId = targetMachine ? targetMachine.id : null;
    state.activeModeratorMachineName = targetMachine ? targetMachine.name : "";
    setModeratorCodeModalContext(action, state.activeModeratorMachineName);
    if (dom.moderatorFormError) {
        dom.moderatorFormError.textContent = "";
        dom.moderatorFormError.classList.remove("show");
    }
    dom.moderatorCodeModal.classList.add("open");
    dom.moderatorCodeModal.setAttribute("aria-hidden", "false");
    if (dom.moderatorCodeInputs && dom.moderatorCodeInputs.length) {
        dom.moderatorCodeInputs.forEach(i => i.value = "");
        dom.moderatorCodeInputs[0].focus();
    }
}

/** Closes the moderator code modal. */
function closeModeratorCodeModal() {
    if (!dom.moderatorCodeModal) return;
    dom.moderatorCodeModal.classList.remove("open");
    dom.moderatorCodeModal.setAttribute("aria-hidden", "true");
    state.activeModeratorAction = "add";
    state.activeModeratorMachineId = null;
    state.activeModeratorMachineName = "";
    setModeratorCodeModalContext("add");
}

/** Returns the 4-digit moderator code entered in the moderator modal. */
function getModeratorCodeValue() {
    return dom.moderatorCodeInputs.map(input => String(input.value || "").trim()).join("");
}

/** Handles moderator code form submission. */
async function submitModeratorCodeForm(event) {
    event.preventDefault();
    if (!dom.moderatorCodeInputs) return;
    const code = getModeratorCodeValue();
    if (!/^\d{4}$/.test(code)) {
        if (dom.moderatorFormError) {
            dom.moderatorFormError.textContent = "Enter the 4-digit moderator code.";
            dom.moderatorFormError.classList.add("show");
        }
        dom.moderatorCodeInputs.forEach(input => input.classList.add("invalid"));
        return;
    }

    if (code !== MODERATOR_CODE) {
        if (dom.moderatorFormError) {
            dom.moderatorFormError.textContent = "Invalid moderator code.";
            dom.moderatorFormError.classList.add("show");
        }
        dom.moderatorCodeInputs.forEach(input => input.classList.add("invalid"));
        return;
    }

    const isDeleteFlow = state.activeModeratorAction === "delete";
    const isCollectFlow = state.activeModeratorAction === "collect";

    if (isDeleteFlow) {
        if (!state.activeModeratorMachineId) {
            closeModeratorCodeModal();
            return;
        }

        dom.submitModeratorCodeBtn.disabled = true;
        try {
            await api.deleteMachine(state.activeModeratorMachineId, code);
            clearSessionMeta(state.activeModeratorMachineId);
            closeModeratorCodeModal();
            await refreshDashboardData();
            showToast(`${state.activeModeratorMachineName || "Machine"} deleted successfully.`, "success");
        } catch (err) {
            if (dom.moderatorFormError) {
                dom.moderatorFormError.textContent = err.message || "Unable to delete machine.";
                dom.moderatorFormError.classList.add("show");
            }
            showToast(`Could not delete machine: ${err.message}`, "error");
        } finally {
            dom.submitModeratorCodeBtn.disabled = false;
        }
        return;
    }

    if (isCollectFlow) {
        const machineId = state.activeModeratorMachineId;
        const machineName = state.activeModeratorMachineName || "Machine";

        if (!machineId) {
            closeModeratorCodeModal();
            return;
        }

        dom.submitModeratorCodeBtn.disabled = true;
        try {
            await stopSession(machineId, { suppressToast: true });
            closeModeratorCodeModal();
            showToast(`${machineName} collection validated.`, "success");
        } catch (err) {
            if (dom.moderatorFormError) {
                dom.moderatorFormError.textContent = err.message || "Unable to validate collection.";
                dom.moderatorFormError.classList.add("show");
            }
            showToast(`Could not validate collection: ${err.message}`, "error");
        } finally {
            dom.submitModeratorCodeBtn.disabled = false;
        }
        return;
    }

    // success: close moderator modal and open add machine form
    closeModeratorCodeModal();
    openAddMachineModal();
}

/** Closes the add-machine modal and resets its state. */
function closeAddMachineModal() {
    clearAddMachineFormErrors();
    dom.addMachineModal.classList.remove("open");
    dom.addMachineModal.setAttribute("aria-hidden", "true");
}

/** Opens the usage stats modal. */
function openUsageStatsModal() {
    renderUsageStats();
    dom.usageStatsModal.classList.add("open");
    dom.usageStatsModal.setAttribute("aria-hidden", "false");
}

/** Closes the usage stats modal. */
function closeUsageStatsModal() {
    dom.usageStatsModal.classList.remove("open");
    dom.usageStatsModal.setAttribute("aria-hidden", "true");
}

/** Opens the maintenance stats modal. */
function openMaintenanceStatsModal() {
    renderMaintenanceStats();
    dom.maintenanceStatsModal.classList.add("open");
    dom.maintenanceStatsModal.setAttribute("aria-hidden", "false");
}

/** Closes the maintenance stats modal. */
function closeMaintenanceStatsModal() {
    dom.maintenanceStatsModal.classList.remove("open");
    dom.maintenanceStatsModal.setAttribute("aria-hidden", "true");
}

/** Handles add-machine form submission. */
async function submitAddMachineForm(event) {
    event.preventDefault();

    if (!dom.addMachineForm) {
        return;
    }

    const machineType = String(dom.addMachineType?.value || "washer").trim().toLowerCase();
    const brand = String(dom.addMachineBrand?.value || "").trim();
    const reference = String(dom.addMachineReference?.value || "").trim();
    const installedAt = String(dom.addMachineInstalledAt?.value || "").trim();

    setAddMachineFormError("machineType", "");
    setAddMachineFormError("machineBrand", "");
    setAddMachineFormError("machineReference", "");
    setAddMachineFormError("installedAt", "");

    if (machineType !== "washer" && machineType !== "dryer") {
        setAddMachineFormError("machineType", "Select Washer or Dryer.");
        return;
    }

    if (!brand) {
        setAddMachineFormError("machineBrand", "Enter the machine brand.");
        return;
    }

    if (!reference) {
        setAddMachineFormError("machineReference", "Enter the machine reference.");
        return;
    }

    if (!installedAt) {
        setAddMachineFormError("installedAt", "Select an installation date.");
        return;
    }

    const machineName = getNextMachineName(machineType);
    dom.submitAddMachineBtn.disabled = true;

    try {
        await api.createMachine({
            name: machineName,
            type: machineType,
            brand,
            reference,
            installedAt
        });

        closeAddMachineModal();
        showToast(`${machineName} added successfully.`, "success");
        await refreshDashboardData();
    } catch (err) {
        if (dom.addMachineFormError) {
            dom.addMachineFormError.textContent = err.message || "Unable to create machine.";
            dom.addMachineFormError.classList.add("show");
        }
        showToast(`Could not add machine: ${err.message}`, "error");
    } finally {
        dom.submitAddMachineBtn.disabled = false;
    }
}

/** Opens the repair modal for repair or unlock actions. */
function openRepairModal(machineId, action = "repair") {
    const machine = state.machineViewModels.find(item => item.id === machineId);

    if (!machine) {
        showToast("Machine not found.", "error");
        return;
    }

    if (action === "unlock") {
        if (machine.status !== "in-use") {
            showToast("This machine is not running right now.", "error");
            return;
        }
    } else if (machine.status !== "maintenance") {
        showToast("This machine is not in maintenance.", "error");
        return;
    }

    state.activeRepairMachineId = machineId;
    state.activeRepairAction = action;
    clearRepairFormErrors();
    dom.repairForm.reset();
    dom.repairMachineLabel.textContent = `Machine: ${machine.name}`;
    if (dom.repairModalTitle) {
        dom.repairModalTitle.textContent = action === "unlock" ? "Moderator Unlock" : "Confirm Repair";
    }
    if (dom.submitRepairBtn) {
        dom.submitRepairBtn.textContent = action === "unlock" ? "Unlock Machine" : "Mark Repaired";
    }
    dom.repairModal.classList.add("open");
    dom.repairModal.setAttribute("aria-hidden", "false");

    const firstDigit = dom.repairCodeInputs[0];
    if (firstDigit) {
        firstDigit.focus();
    }
}

/** Closes the repair modal and resets its UI state. */
function closeRepairModal() {
    state.activeRepairMachineId = null;
    state.activeRepairAction = "repair";
    clearRepairFormErrors();
    if (dom.repairModalTitle) {
        dom.repairModalTitle.textContent = "Confirm Repair";
    }
    if (dom.submitRepairBtn) {
        dom.submitRepairBtn.textContent = "Mark Repaired";
    }
    dom.repairModal.classList.remove("open");
    dom.repairModal.setAttribute("aria-hidden", "true");
}

/** Handles repair or moderator unlock form submission. */
async function submitRepairForm(event) {
    event.preventDefault();

    if (!state.activeRepairMachineId) {
        return;
    }

    const machineId = state.activeRepairMachineId;
    const machine = state.machineViewModels.find(item => item.id === machineId);
    const isUnlockAction = state.activeRepairAction === "unlock";

    if (!machine || (!isUnlockAction && machine.status !== "maintenance") || (isUnlockAction && machine.status !== "in-use")) {
        showToast(isUnlockAction ? "This machine cannot be unlocked right now." : "This machine cannot be repaired right now.", "error");
        closeRepairModal();
        return;
    }

    const code = getRepairCodeValue();
    if (!/^\d{4}$/.test(code)) {
        setRepairFormError("Enter the 4-digit moderator code.");
        dom.repairCodeInputs.forEach(input => input.classList.add("invalid"));
        return;
    }

    if (code !== MODERATOR_CODE) {
        setRepairFormError("Invalid moderator code.");
        dom.repairCodeInputs.forEach(input => input.classList.add("invalid"));
        return;
    }

    dom.submitRepairBtn.disabled = true;

    try {
        if (isUnlockAction) {
            await stopSession(machineId, { suppressToast: true });
            closeRepairModal();
            showToast(`${machine.name} unlocked by moderator.`, "success");
        } else {
            const openIssues = state.issues.filter(issue => issue.machineId === machineId && !issue.isResolved);
            if (!openIssues.length) {
                showToast("No open maintenance issue found for this machine.", "error");
                closeRepairModal();
                return;
            }

            await Promise.all(openIssues.map(issue => api.resolveIssue(issue.id)));

            state.issues = state.issues.map(issue => (
                issue.machineId === machineId && !issue.isResolved
                    ? { ...issue, isResolved: true, resolvedAt: issue.resolvedAt || new Date().toISOString() }
                    : issue
            ));

            buildMachineViewModels();
            renderAll();
            closeRepairModal();
            showToast(`${machine.name} marked as repaired.`, "success");
        }

        await refreshDashboardData();
    } catch (err) {
        setRepairFormError(err.message || "Unable to mark machine as repaired.");
        showToast(`Could not repair machine: ${err.message}`, "error");
    } finally {
        dom.submitRepairBtn.disabled = false;
    }
}

// =========================================================
// STOP CONFIRMATION MODAL
// =========================================================

/** Displays a field-level error inside the stop confirmation modal. */
function setStopFormFieldError(fieldName, message) {
    const form = dom.stopConfirmForm;
    if (!form) return;
    const field = form.elements.namedItem(fieldName);
    const errorNode = form.querySelector(`[data-error-for="${fieldName}"]`);
    if (field instanceof HTMLElement) {
        field.classList.toggle("invalid", Boolean(message));
    }
    if (errorNode) {
        errorNode.textContent = message || "";
    }
}

/** Clears all validation errors from the stop confirmation modal. */
function clearStopFormErrors() {
    if (!dom.stopConfirmForm) return;
    const errorNodes = dom.stopConfirmForm.querySelectorAll(".field-error");
    errorNodes.forEach(node => node.textContent = "");
    const fields = dom.stopConfirmForm.querySelectorAll("input");
    fields.forEach(f => f.classList.remove("invalid"));
}

/** Opens the stop or collect confirmation modal for a machine. */
function openStopConfirmModal(machineId, action = "stop") {
    const machine = state.machineViewModels.find(m => m.id === machineId);
    if (!machine) {
        showToast("Machine not found.", "error");
        return;
    }
    state.activeStopMachineId = machineId;
    state.activeStopAction = action;
    clearStopFormErrors();
    if (dom.stopConfirmForm) dom.stopConfirmForm.reset();

    const titleNode = document.getElementById("stop-confirm-title");
    const subtitleNode = dom.stopConfirmModal ? dom.stopConfirmModal.querySelector(".modal-subtitle") : null;
    if (titleNode) {
        titleNode.textContent = action === "collect" ? "Confirm Collection" : "Confirm Stop Session";
    }
    if (subtitleNode) {
        subtitleNode.textContent = action === "collect"
            ? "To mark this machine as collected, please confirm your apartment and room number."
            : "To stop this machine, please confirm your apartment and room number.";
    }
    if (dom.stopConfirmSubmit) {
        dom.stopConfirmSubmit.textContent = action === "collect" ? "Confirm Collected" : "Confirm Stop";
    }

    if (dom.stopConfirmForm) {
        const apartmentField = dom.stopConfirmForm.elements.namedItem("confirmApartment");
        const roomField = dom.stopConfirmForm.elements.namedItem("confirmRoom");
        if (apartmentField instanceof HTMLInputElement) {
            apartmentField.value = "";
        }
        if (roomField instanceof HTMLInputElement) {
            roomField.value = "";
        }
    }

    if (dom.stopConfirmModal) {
        dom.stopConfirmModal.classList.add("open");
        dom.stopConfirmModal.setAttribute("aria-hidden", "false");
    }
    const first = document.getElementById("confirm-apartment");
    if (first) first.focus();
}

/** Closes the stop confirmation modal and resets its state. */
function closeStopConfirmModal() {
    state.activeStopMachineId = null;
    state.activeStopAction = "stop";
    if (dom.stopConfirmModal) {
        dom.stopConfirmModal.classList.remove("open");
        dom.stopConfirmModal.setAttribute("aria-hidden", "true");
    }
    clearStopFormErrors();
}

/** Switches from stop confirmation to moderator unlock flow. */
function openModeratorConfirmFromStopModal() {
    const machineId = state.activeStopMachineId;
    if (!machineId) {
        showToast("No machine selected.", "error");
        return;
    }

    closeStopConfirmModal();
    openModeratorCodeModal("collect", machineId);
}

/** Validates the collection details and stops the current session if they match. */
async function submitStopConfirm(event) {
    event.preventDefault();
    const machineId = state.activeStopMachineId;
    if (!machineId) {
        return;
    }

    const form = dom.stopConfirmForm;
    const apt = String(form.elements.namedItem("confirmApartment").value || "").trim();
    const room = String(form.elements.namedItem("confirmRoom").value || "").trim();

    let hasError = false;
    setStopFormFieldError("confirmApartment", "");
    setStopFormFieldError("confirmRoom", "");

    if (!apt) { setStopFormFieldError("confirmApartment", "Apartment number required."); hasError = true; }
    if (!room) { setStopFormFieldError("confirmRoom", "Room number required."); hasError = true; }
    if (hasError) return;

    // locate the active session owner for this machine
    const machine = state.machineViewModels.find(m => m.id === machineId);
    if (!machine || !machine.activeSessionUserId) {
        showToast("No active session found for this machine.", "error");
        closeStopConfirmModal();
        return;
    }

    // ensure we have fresh user and room data
    try {
        const users = (await api.getUsers()).map(normalizeUser);
        const rooms = (await api.getRooms()).map(normalizeRoom);
        state.users = users;

        const owner = users.find(u => u.id === machine.activeSessionUserId);
        if (!owner) {
            showToast("Session owner not found.", "error");
            return;
        }

        const ownerRoom = rooms.find(r => r.id === owner.roomId);
        const expectedComposite = `${apt}-${room}`.toLowerCase();
        const ownerComposite = ownerRoom ? String(ownerRoom.roomNumber || "").toLowerCase() : "";

        if (ownerComposite !== expectedComposite) {
            setStopFormFieldError("confirmApartment", "Apartment/room do not match our records.");
            setStopFormFieldError("confirmRoom", "Apartment/room do not match our records.");
            showToast("Verification failed ? cannot stop session.", "error");
            return;
        }

        // verified ? proceed to stop/collect
        closeStopConfirmModal();
        await stopSession(machineId);
    } catch (err) {
        showToast(`Verification error: ${err.message}`, "error");
    }
}

/** Closes the issue modal and clears the active machine selection. */
function closeIssueModal() {
    state.activeIssueMachineId = null;
    dom.issueModal.classList.remove("open");
    dom.issueModal.setAttribute("aria-hidden", "true");
}

/** Displays a field-level error in the start session form. */
function setStartFormFieldError(fieldName, message) {
    const field = dom.startSessionForm.elements.namedItem(fieldName);
    const errorNode = dom.startSessionForm.querySelector(`[data-error-for="${fieldName}"]`);

    if (field instanceof HTMLElement) {
        field.classList.toggle("invalid", Boolean(message));
    }
    if (errorNode) {
        errorNode.textContent = message || "";
    }
}

/** Clears start session form validation states. */
function clearStartFormErrors() {
    const errorNodes = dom.startSessionForm.querySelectorAll(".field-error");
    errorNodes.forEach(node => {
        node.textContent = "";
    });
    const fields = dom.startSessionForm.querySelectorAll("input, select");
    fields.forEach(field => field.classList.remove("invalid"));
    dom.startFormError.textContent = "";
    dom.startFormError.classList.remove("show");
}

/** Opens the advertisement modal with countdown before showing start session modal. */
function openAdvertisementModal(machineId) {
    const machine = state.machineViewModels.find(item => item.id === machineId);
    if (!machine) {
        return;
    }
    if (machine.status !== "available") {
        showToast("This machine cannot be started right now.", "error");
        return;
    }

    state.activeStartMachineId = machineId;

    // Show advertisement modal
    dom.advertisementModal.classList.add("open");
    dom.advertisementModal.setAttribute("aria-hidden", "false");

    // Start countdown from 10 seconds
    let countdown = 10;
    dom.adCountdown.textContent = countdown;

    const countdownInterval = setInterval(() => {
        countdown--;
        if (countdown > 0) {
            dom.adCountdown.textContent = countdown;
        } else {
            clearInterval(countdownInterval);
            closeAdvertisementModal();
            openStartSessionModal(machineId);
        }
    }, 1000);
}

/** Closes the advertisement modal. */
function closeAdvertisementModal() {
    dom.advertisementModal.classList.remove("open");
    dom.advertisementModal.setAttribute("aria-hidden", "true");
}

/** Opens the start session modal for an available machine. */
function openStartSessionModal(machineId) {
    const machine = state.machineViewModels.find(item => item.id === machineId);
    if (!machine) {
        return;
    }
    if (machine.status !== "available") {
        showToast("This machine cannot be started right now.", "error");
        return;
    }

    state.activeStartMachineId = machineId;
    clearStartFormErrors();
    dom.startSessionForm.reset();
    dom.startMachineLabel.textContent = `Machine: ${machine.name}`;
    dom.startSessionModal.classList.add("open");
    dom.startSessionModal.setAttribute("aria-hidden", "false");

    const firstField = dom.startSessionForm.elements.namedItem("firstName");
    if (firstField instanceof HTMLElement) {
        firstField.focus();
    }
}

/** Closes the start session modal and resets validation state. */
function closeStartSessionModal() {
    state.activeStartMachineId = null;
    clearStartFormErrors();
    dom.startSessionModal.classList.remove("open");
    dom.startSessionModal.setAttribute("aria-hidden", "true");
}

// =========================================================
// FORM VALIDATION
// =========================================================

/** Reads and trims the start-session form values. */
function getStartFormValues() {
    return {
        firstName: String(dom.startSessionForm.elements.namedItem("firstName").value || "").trim(),
        lastName: String(dom.startSessionForm.elements.namedItem("lastName").value || "").trim(),
        email: String(dom.startSessionForm.elements.namedItem("email").value || "").trim(),
        phoneNumber: String(dom.startSessionForm.elements.namedItem("phoneNumber").value || "").trim(),
        apartmentNumber: String(dom.startSessionForm.elements.namedItem("apartmentNumber").value || "").trim(),
        roomNumber: String(dom.startSessionForm.elements.namedItem("roomNumber").value || "").trim(),
        countryCode: String(dom.startSessionForm.elements.namedItem("countryCode") ? dom.startSessionForm.elements.namedItem("countryCode").value : "+33").trim(),

    };
}

/** Validates the start-session form and returns field-level errors. */
function validateStartForm(values) {
    const errors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\+?[0-9().\-\s]{7,20}$/;
    const countryCodeRegex = /^\+\d{1,4}$/;
    const durationRegex = /^\d{1,3}:[0-5]\d$/;

    if (!values.firstName) {
        errors.firstName = "First name is required.";
    }
    if (!values.lastName) {
        errors.lastName = "Last name is required.";
    }
    if (!values.email) {
        errors.email = "Email is required.";
    } else if (!emailRegex.test(values.email)) {
        errors.email = "Please enter a valid email address.";
    }
    if (!values.countryCode) {
        errors.countryCode = "Country code is required.";
    } else if (!countryCodeRegex.test(String(values.countryCode).trim())) {
        errors.countryCode = "Country code must start with + and 1?4 digits (e.g. +33).";
    }

    if (!values.phoneNumber) {
        errors.phoneNumber = "Phone number is required.";
    } else if (!phoneRegex.test(values.phoneNumber)) {
        errors.phoneNumber = "Please enter a valid phone number (7-20 digits, spaces, dashes or parentheses).";
    }
    if (!values.apartmentNumber) {
        errors.apartmentNumber = "Apartment number is required.";
    }
    if (!values.roomNumber) {
        errors.roomNumber = "Room number is required.";
    }

    return errors;
}

/** Applies start-session validation messages to the form UI. */
function showStartFormValidation(errors) {
    const fields = ["firstName", "lastName", "email", "countryCode", "phoneNumber", "apartmentNumber", "roomNumber"];
    fields.forEach(field => {
        setStartFormFieldError(field, errors[field] || "");
    });

    const hasErrors = Object.keys(errors).length > 0;
    if (hasErrors) {
        dom.startFormError.textContent = "Please fix the highlighted fields before continuing.";
        dom.startFormError.classList.add("show");
    } else {
        dom.startFormError.textContent = "";
        dom.startFormError.classList.remove("show");
    }
}

// =========================================================
// BACKEND INTEGRATION
// =========================================================

/** Ensures a room exists for the given apartment and room number pair. */
async function ensureRoomId(apartmentNumber, roomNumber) {
    const compositeRoomNumber = `${apartmentNumber}-${roomNumber}`;
    const rooms = (await api.getRooms()).map(normalizeRoom);
    const existingRoom = rooms.find(room => room.roomNumber.toLowerCase() === compositeRoomNumber.toLowerCase());

    if (existingRoom) {
        return existingRoom.id;
    }

    await api.createRoom({ roomNumber: compositeRoomNumber });
    const refreshedRooms = (await api.getRooms()).map(normalizeRoom);
    const createdRoom = refreshedRooms.find(room => room.roomNumber.toLowerCase() === compositeRoomNumber.toLowerCase());

    if (!createdRoom) {
        throw new Error("Unable to create room record.");
    }

    return createdRoom.id;
}

/** Retrieves or creates the user associated with the current start-session form. */
async function createOrRetrieveUser(formValues, roomId) {
    const normalizedEmail = formValues.email.toLowerCase();
    const users = (await api.getUsers()).map(normalizeUser);
    const existing = users.find(user => user.email === normalizedEmail);

    if (existing) {
        state.users = users;
        return existing;
    }

    const fullPhone = `${formValues.countryCode || ''}${String(formValues.phoneNumber || '').replace(/\s+/g, '')}`;
    await api.createUser({
        name: `${formValues.firstName} ${formValues.lastName}`,
        email: normalizedEmail,
        phone: fullPhone,
        roomId
    });

    const refreshedUsers = (await api.getUsers()).map(normalizeUser);
    state.users = refreshedUsers;
    const createdUser = refreshedUsers.find(user => user.email === normalizedEmail);
    if (!createdUser) {
        throw new Error("Unable to create user.");
    }
    return createdUser;
}

/** Returns the newest active session for the given machine and user. */
function findNewestActiveSession(machineId, userId) {
    return state.sessions
        .filter(session => session.machineId === machineId && session.userId === userId && !session.endTime)
        .sort((a, b) => new Date(b.startTime || 0).getTime() - new Date(a.startTime || 0).getTime())[0] || null;
}

/** Stores countdown metadata needed to render live session timing. */
function registerCountdownMeta({ machineId, sessionId, firstName, email, phone, apartmentNumber, roomNumber, durationMinutes, startAt }) {
    const startMs = new Date(startAt).getTime();
    const endMs = startMs + (durationMinutes * 60 * 1000);
    setSessionMeta(machineId, {
        sessionId,
        userFirstName: firstName,
        userEmail: email,
        userPhone: phone,
        apartmentNumber,
        roomNumber,
        durationMinutes,
        startMs,
        endMs
    });
}

/** Handles submission of the start-session form. */
async function submitStartSession(event) {
    event.preventDefault();

    if (!state.activeStartMachineId) {
        return;
    }

    const machineId = state.activeStartMachineId;
    const machine = state.machineViewModels.find(item => item.id === machineId);
    if (!machine || machine.status !== "available") {
        showToast("This machine cannot be started right now.", "error");
        closeStartSessionModal();
        return;
    }

    const values = getStartFormValues();
    const errors = validateStartForm(values);
    showStartFormValidation(errors);
    if (Object.keys(errors).length > 0) {
        return;
    }

    if (state.pendingSessionMachineIds.has(machineId)) {
        return;
    }

    state.pendingSessionMachineIds.add(machineId);
    dom.submitStartBtn.disabled = true;
    dom.submitStartBtn.textContent = "Starting...";
    renderMachines();

    try {
        const roomId = await ensureRoomId(values.apartmentNumber, values.roomNumber);
        const user = await createOrRetrieveUser(values, roomId);

        const durationMinutes = window.LaundryFlowCycleLab
            ? window.LaundryFlowCycleLab.estimateDefaultSessionDurationMinutes(machine.type)
            : 0;


        await api.createSession(machineId, user.id);

        const latestSessions = await api.getSessions();
        state.sessions = latestSessions.map(normalizeSession);
        const newestSession = findNewestActiveSession(machineId, user.id);

        const startTime = newestSession && newestSession.startTime ? newestSession.startTime : new Date().toISOString();
        registerCountdownMeta({
            machineId,
            sessionId: newestSession ? newestSession.id : null,
            firstName: values.firstName,
            email: user.email,
            phone: user.phone,
            apartmentNumber: values.apartmentNumber,
            roomNumber: values.roomNumber,
            durationMinutes: durationMinutes,
            startAt: startTime
        });

        buildMachineViewModels();
        renderAll();
        closeStartSessionModal();
        showToast(`Session started for ${machine.name}.`, "success");

        await refreshDashboardData();
    } catch (err) {
        dom.startFormError.textContent = err.message || "Unable to start session.";
        dom.startFormError.classList.add("show");
        showToast(`Could not start session: ${err.message}`, "error");
    } finally {
        state.pendingSessionMachineIds.delete(machineId);
        dom.submitStartBtn.disabled = false;
        dom.submitStartBtn.textContent = "Start Session";
        renderMachines();
    }
}

// =========================================================
// SESSION COUNTDOWN LOGIC
// =========================================================

/** Completes an expired session on the backend and clears local countdown state. */
async function completeSessionForMachine(machine) {
    return machine;
}

function checkAndCompleteExpiredSessions() {
    return;
}

/** Stops a running session manually, with optional toast suppression. */
async function stopSession(machineId, options = {}) {
    const { toastMessage = "Session stopped.", suppressToast = false } = options;
    const meta = state.sessionMetaByMachineId[machineId];
    const sessionId = meta && meta.sessionId ? meta.sessionId : null;
    const machine = state.machineViewModels.find(m => m.id === machineId);
    if (!machine) {
        showToast("Machine not found.", "error");
        return;
    }

    if (!sessionId && machine.activeSessionId) {
        // fallback to server session id
        try {
            await api.endSession(machine.activeSessionId);
            clearSessionMeta(machineId);
            await refreshDashboardData();
            if (!suppressToast) {
                showToast(toastMessage, "success");
            }
        } catch (err) {
            showToast(`Could not stop session: ${err.message}`, "error");
        }
        return;
    }

    if (!sessionId) {
        showToast("No session id available to stop.", "error");
        return;
    }

    try {
        await api.endSession(sessionId);
        clearSessionMeta(machineId);
        await refreshDashboardData();
        if (!suppressToast) {
            showToast(toastMessage, "success");
        }
    } catch (err) {
        showToast(`Could not stop session: ${err.message}`, "error");
    }
}

// =========================================================
// DATA LOADING
// =========================================================

/** Reloads dashboard data from the backend and rebuilds the UI state. */
async function refreshDashboardData({ initial = false } = {}) {
    if (initial) {
        state.isInitialLoading = true;
        renderAll();
    }

    try {
        const [machines, issues, sessions, users, rooms] = await Promise.all([
            api.getMachines(),
            api.getIssues(),
            api.getSessions(),
            api.getUsers(),
            api.getRooms()
        ]);

        state.machines = machines.map(normalizeMachine);
        state.issues = issues.map(normalizeIssue);
        state.sessions = sessions.map(normalizeSession);
        state.users = users.map(normalizeUser);
        state.rooms = rooms.map(normalizeRoom);

        syncSessionMetaWithServerData();
        buildMachineViewModels();
    } catch (err) {
        showToast(`Unable to refresh dashboard: ${err.message}`, "error");
    } finally {
        state.isInitialLoading = false;
        renderAll();
    }
}

// =========================================================
// USER ACTIONS
// =========================================================

/** Submits a new machine issue report. */
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

// =========================================================
// EVENT LISTENERS
// =========================================================

/** Attaches validation cleanup listeners for the start-session form. */
function attachStartFormListeners() {
    const clearFieldError = event => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) {
            return;
        }
        const fieldName = target.name;
        if (!fieldName) {
            return;
        }
        setStartFormFieldError(fieldName, "");
        if (dom.startFormError.classList.contains("show")) {
            dom.startFormError.textContent = "";
            dom.startFormError.classList.remove("show");
        }
    };

    dom.startSessionForm.addEventListener("input", clearFieldError);
    dom.startSessionForm.addEventListener("change", clearFieldError);
    dom.startSessionForm.addEventListener("submit", submitStartSession);
}

/** Attaches the global application event listeners. */
function attachEventListeners() {
    if (dom.addMachineButton) {
        dom.addMachineButton.addEventListener("click", () => openModeratorCodeModal("add"));
    }

    // Moderator code modal handlers
    if (dom.moderatorCodeForm) {
        dom.moderatorCodeForm.addEventListener('submit', submitModeratorCodeForm);
    }
    if (dom.cancelModeratorCodeBtn) {
        dom.cancelModeratorCodeBtn.addEventListener('click', closeModeratorCodeModal);
    }

    if (dom.usageStatsButton) {
        dom.usageStatsButton.addEventListener("click", openUsageStatsModal);
    }

    if (dom.maintenanceStatsButton) {
        dom.maintenanceStatsButton.addEventListener("click", openMaintenanceStatsModal);
    }

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
            openAdvertisementModal(machineId);
        }

        if (action === "repair") {
            openRepairModal(machineId);
        }

        if (action === "moderator-unlock") {
            openRepairModal(machineId, "unlock");
        }

        if (action === "stop") {
            openStopConfirmModal(machineId, "stop");
        }

        if (action === "collect") {
            openStopConfirmModal(machineId, "collect");
        }

        if (action === "report") {
            openIssueModal(machineId);
        }

        if (action === "delete") {
            openModeratorCodeModal("delete", machineId);
        }
    });

    dom.cancelIssueBtn.addEventListener("click", closeIssueModal);
    dom.submitIssueBtn.addEventListener("click", submitIssueReport);
    dom.cancelStartBtn.addEventListener("click", closeStartSessionModal);
    if (dom.cancelRepairBtn) dom.cancelRepairBtn.addEventListener("click", closeRepairModal);
    if (dom.repairForm) dom.repairForm.addEventListener("submit", submitRepairForm);
    if (dom.cancelAddMachineBtn) dom.cancelAddMachineBtn.addEventListener("click", closeAddMachineModal);
    if (dom.addMachineForm) dom.addMachineForm.addEventListener("submit", submitAddMachineForm);
    if (dom.addMachineType) dom.addMachineType.addEventListener("change", updateAddMachinePreview);
    if (dom.addMachineType) dom.addMachineType.addEventListener("input", updateAddMachinePreview);
    // removed single moderator code input listeners (now handled by modal)
    if (dom.addMachineModal) dom.addMachineModal.addEventListener("click", event => {
        if (event.target === dom.addMachineModal) {
            closeAddMachineModal();
        }
    });
    if (dom.closeUsageStatsBtn) dom.closeUsageStatsBtn.addEventListener("click", closeUsageStatsModal);
    if (dom.usageStatsModal) dom.usageStatsModal.addEventListener("click", event => {
        if (event.target === dom.usageStatsModal) {
            closeUsageStatsModal();
        }
    });
    if (dom.closeMaintenanceStatsBtn) dom.closeMaintenanceStatsBtn.addEventListener("click", closeMaintenanceStatsModal);
    if (dom.maintenanceStatsModal) dom.maintenanceStatsModal.addEventListener("click", event => {
        if (event.target === dom.maintenanceStatsModal) {
            closeMaintenanceStatsModal();
        }
    });
    if (dom.maintenanceMachineSelect) {
        dom.maintenanceMachineSelect.addEventListener("change", event => {
            const target = event.target;
            if (!(target instanceof HTMLSelectElement)) {
                return;
            }

            state.activeMaintenanceMachineId = target.value;
            renderMaintenanceStats();
        });
    }
    if (dom.usageMachineSelect) {
        dom.usageMachineSelect.addEventListener("change", event => {
            const target = event.target;
            if (!(target instanceof HTMLSelectElement)) {
                return;
            }
            state.activeUsageMachineId = target.value;
            renderUsageStats();
        });
    }
    dom.usageRangeButtons.forEach(button => {
        button.addEventListener("click", () => {
            const range = button.dataset.usageRange;
            if (!range) {
                return;
            }
            state.activeUsageRange = range;
            renderUsageStats();
        });
    });
    if (dom.stopConfirmCancel) dom.stopConfirmCancel.addEventListener("click", closeStopConfirmModal);
    if (dom.openModeratorConfirmBtn) dom.openModeratorConfirmBtn.addEventListener("click", openModeratorConfirmFromStopModal);
    if (dom.stopConfirmForm) dom.stopConfirmForm.addEventListener("submit", submitStopConfirm);
    if (dom.stopConfirmModal) dom.stopConfirmModal.addEventListener("click", event => {
        if (event.target === dom.stopConfirmModal) {
            closeStopConfirmModal();
        }
    });

    if (dom.repairModal) dom.repairModal.addEventListener("click", event => {
        if (event.target === dom.repairModal) {
            closeRepairModal();
        }
    });

    dom.issueModal.addEventListener("click", event => {
        if (event.target === dom.issueModal) {
            closeIssueModal();
        }
    });

    dom.startSessionModal.addEventListener("click", event => {
        if (event.target === dom.startSessionModal) {
            closeStartSessionModal();
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key !== "Escape") {
            return;
        }

        if (dom.issueModal.classList.contains("open")) {
            closeIssueModal();
        }

        if (dom.addMachineModal && dom.addMachineModal.classList.contains("open")) {
            closeAddMachineModal();
        }

        if (dom.usageStatsModal && dom.usageStatsModal.classList.contains("open")) {
            closeUsageStatsModal();
        }

        if (dom.maintenanceStatsModal && dom.maintenanceStatsModal.classList.contains("open")) {
            closeMaintenanceStatsModal();
        }

        if (dom.startSessionModal.classList.contains("open")) {
            closeStartSessionModal();
        }

        if (dom.repairModal.classList.contains("open")) {
            closeRepairModal();
        }
    });

    // notification button logic removed

    attachStartFormListeners();

    if (dom.repairForm && dom.repairCodeInputs.length) {
        dom.repairCodeInputs.forEach((input, index) => {
            input.addEventListener("input", event => {
                const target = event.target;
                if (!(target instanceof HTMLInputElement)) {
                    return;
                }

                target.value = target.value.replace(/\D/g, "").slice(0, 1);
                target.classList.remove("invalid");
                setRepairFormError("");

                if (target.value && index < dom.repairCodeInputs.length - 1) {
                    dom.repairCodeInputs[index + 1].focus();
                }
            });

            input.addEventListener("keydown", event => {
                const target = event.target;
                if (!(target instanceof HTMLInputElement)) {
                    return;
                }

                if (event.key === "Backspace" && !target.value && index > 0) {
                    dom.repairCodeInputs[index - 1].focus();
                }
            });
        });
    }

    // Setup moderator code inputs (same behavior as repair code inputs)
    if (dom.moderatorCodeForm && dom.moderatorCodeInputs && dom.moderatorCodeInputs.length) {
        dom.moderatorCodeInputs.forEach((input, index) => {
            input.addEventListener('input', event => {
                const target = event.target;
                if (!(target instanceof HTMLInputElement)) return;
                target.value = target.value.replace(/\D/g, "").slice(0, 1);
                target.classList.remove('invalid');
                if (target.value && index < dom.moderatorCodeInputs.length - 1) {
                    dom.moderatorCodeInputs[index + 1].focus();
                }
            });

            input.addEventListener('keydown', event => {
                const target = event.target;
                if (!(target instanceof HTMLInputElement)) return;
                if (event.key === 'Backspace' && !target.value && index > 0) {
                    dom.moderatorCodeInputs[index - 1].focus();
                }
            });
        });
    }
}


function buildWattageBuckets(rangeType) {
    const config = getUsageRangeConfig(rangeType);

    const buckets = Array.from(
        { length: config.bucketCount },
        (_, i) => ({
            index: i,
            startDate: config.bucketStart(i),
            watts: 0,
            label: config.bucketLabel(i)
        })
    );

    const selectedMachineId = String(state.activeUsageMachineId);

    const filteredSessions =
        selectedMachineId === "all"
            ? state.sessions
            : state.sessions.filter(
                session => session.machineId === Number(selectedMachineId)
            );

    filteredSessions.forEach(session => {
        if (!session.startTime) {
            return;
        }

        const sessionDate = new Date(session.startTime);

        let bucketIndex = -1;

        if (rangeType === "year") {
            bucketIndex = sessionDate.getMonth();
        }
        else if (rangeType === "month") {
            const startWindow = config.bucketStart(0);

            const diffDays = Math.floor(
                (sessionDate.getTime() - startWindow.getTime()) /
                (24 * 60 * 60 * 1000)
            );

            bucketIndex = Math.floor(diffDays / 7);
        }
        else {
            const startWindow = config.bucketStart(0);

            bucketIndex = Math.floor(
                (sessionDate.getTime() - startWindow.getTime()) /
                (24 * 60 * 60 * 1000)
            );
        }

        if (
            bucketIndex >= 0 &&
            bucketIndex < buckets.length
        ) {
            const startMs = new Date(session.startTime).getTime();
            const endMs = session.endTime
                ? new Date(session.endTime).getTime()
                : Date.now();

            const durationMinutes =
                Math.max(1, endMs - startMs) / (60 * 1000);

            const estimatedWatts = durationMinutes > 0 ? 1500 : 0;

            buckets[bucketIndex].watts += estimatedWatts;
        }
    });

    return buckets;
}

function buildApartmentWattageData() {
    const roomWatts = {};

    state.sessions.forEach(session => {
        const user = state.users.find(u => u.id === session.userId);
        const room = user
            ? state.rooms.find(r => r.id === user.roomId)
            : null;

        const roomParts = room
            ? splitCompositeRoomNumber(room.roomNumber)
            : {};

        const apartmentNumber =
            roomParts.apartmentNumber || "Unknown";

        const roomNumber =
            roomParts.roomNumber || "Unknown";

        const key = `Apartment ${apartmentNumber} - Room ${roomNumber}`;

        const startMs = new Date(session.startTime).getTime();
        const endMs = session.endTime
            ? new Date(session.endTime).getTime()
            : Date.now();

        const durationMinutes =
            Math.max(1, endMs - startMs) / (60 * 1000);

        const estimatedWatts =
            durationMinutes > 0 ? 1500 : 0;

        if (!roomWatts[key]) {
            roomWatts[key] = 0;
        }

        roomWatts[key] += estimatedWatts;
    });

    return roomWatts;
}

function renderWattageStats() {
    const wattageBuckets = buildWattageBuckets(state.activeUsageRange);
    const apartmentWatts = buildApartmentWattageData();

    if (dom.wattageChart) {
        const maxWatts =
            wattageBuckets.length > 0
                ? Math.max(
                    1,
                    Math.max(...wattageBuckets.map(bucket => bucket.watts))
                )
                : 1;

        const config = getUsageRangeConfig(state.activeUsageRange);

        dom.wattageChart.innerHTML = `
            <div class="usage-chart-header">
                <span class="usage-chart-title">${config.title}</span>
                <span class="usage-chart-subtitle">
                    Power consumed (Watts)
                </span>
            </div>

            <div
                class="usage-bars"
                role="img"
                aria-label="Power consumption chart"
            >
                ${wattageBuckets.map(bucket => `
                    <div class="usage-bar-item">
                        <div class="usage-bar-track">
                            <div
                                class="usage-bar-fill"
                                style="height: ${Math.max(
            8,
            (bucket.watts / maxWatts) * 100
        )}%;">
                            </div>
                        </div>

                        <span class="usage-bar-value">
                            ${Math.round(bucket.watts)}W
                        </span>

                        <span class="usage-bar-label">
                            ${bucket.label}
                        </span>
                    </div>
                `).join("")}
            </div>
        `;
    }

    if (dom.apartmentWattageList) {
        const sortedApartments = Object.entries(apartmentWatts)
            .sort((a, b) => b[1] - a[1])
            .map(([roomLabel, watts]) => `
                <div
                    style="
                        display:flex;
                        justify-content:space-between;
                        align-items:center;
                        padding:1rem;
                        background:#f9f9f9;
                        border:1px solid #e0e0e0;
                        border-radius:8px;
                    "
                >
                    <span
                        style="
                            font-weight:600;
                            color:#333;
                        "
                    >
                        ${roomLabel}
                    </span>

                    <span
                        style="
                            font-size:1.125rem;
                            font-weight:700;
                            color:#f26b6d;
                        "
                    >
                        ${Math.round(watts)} W
                    </span>
                </div>
            `)
            .join("");

        dom.apartmentWattageList.innerHTML =
            sortedApartments || "<p>No data available</p>";
    }
}


// =========================================================
// APP BOOTSTRAPPING
// =========================================================

/** Initializes the app, loads data, and starts the refresh timers. */
async function initApp() {
    attachEventListeners();
    await refreshDashboardData({ initial: true });

    window.setInterval(() => {
        refreshDashboardData();
    }, REFRESH_INTERVAL_MS);

    window.setInterval(() => {
        state.timerNow = Date.now();
        buildMachineViewModels();
        checkAndCompleteExpiredSessions();
        renderMachines();
    }, SESSION_TIMER_TICK_MS);
}

initApp();













