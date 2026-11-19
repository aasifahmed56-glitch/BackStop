/**
 * Backstop Frontend API Client
 */

const BASE_URL = "/api";

// The project every page works on. Kept per browser so a refresh lands in the same place.
const PROJECT_KEY = "backstop.project";
let currentProject = 1;
try {
  const v = Number(window.localStorage.getItem(PROJECT_KEY));
  if (Number.isInteger(v) && v > 0) currentProject = v;
} catch {
  /* storage blocked: start on the sample */
}
export const getCurrentProject = () => currentProject;
export function setCurrentProject(id) {
  currentProject = Number(id) || 1;
  try {
    window.localStorage.setItem(PROJECT_KEY, String(currentProject));
  } catch {
    /* storage blocked: the choice lasts for this visit */
  }
}
const cur = () => currentProject;

// ---------------------------------------------------------------------------
// Signed-in account. The server decides which roles an account may act as and
// refuses any other; the client asks only for roles it is allowed, falling
// back to the account's own role, so pages written for the lead still work
// for a newcomer with their narrower view.
// ---------------------------------------------------------------------------
let currentUser = null;
export const getCurrentUser = () => currentUser;
export function setCurrentUser(u) {
  currentUser = u || null;
}
export const canActAs = (role) => !!currentUser && currentUser.acting_roles.includes(role);
export const canReview = () => canActAs("lead");
export function clampRole(role) {
  if (!currentUser || !role) return role;
  return currentUser.acting_roles.includes(role) ? role : currentUser.role;
}
export const SIGNED_OUT_EVENT = "backstop:signed-out";

function clampPath(path) {
  const [base, query] = path.split("?");
  if (!query) return path;
  const params = new URLSearchParams(query);
  if (!params.has("role")) return path;
  params.set("role", clampRole(params.get("role")));
  return `${base}?${params.toString()}`;
}

function clampBody(body) {
  if (typeof body !== "string") return body;
  try {
    const obj = JSON.parse(body);
    if (obj && typeof obj === "object" && typeof obj.role === "string") {
      obj.role = clampRole(obj.role);
      return JSON.stringify(obj);
    }
  } catch {
    /* not JSON: send as is */
  }
  return body;
}

export function formatErrorMessage(err) {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (Array.isArray(err)) {
    return err
      .map((item) => formatErrorMessage(item))
      .filter(Boolean)
      .join("; ");
  }
  if (typeof err === "object") {
    // If it's a standard Error object with a clean message
    if (err instanceof Error && err.message && err.message !== "[object Object]") {
      return err.message;
    }
    // If it's FastAPI validation error object: { loc: [...], msg: "...", type: "..." }
    if (err.msg || err.message) {
      const loc = Array.isArray(err.loc)
        ? err.loc.filter((l) => l !== "body").join(" ")
        : "";
      const msg = err.msg || err.message;
      return loc ? `${loc}: ${msg}` : msg;
    }
    if (err.detail !== undefined) {
      return formatErrorMessage(err.detail);
    }
    try {
      const json = JSON.stringify(err);
      if (json && json !== "{}") return json;
    } catch {
      // ignore
    }
  }
  return String(err);
}

async function request(path, options = {}) {
  const url = `${BASE_URL}${clampPath(path)}`;
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const response = await fetch(url, { ...options, body: clampBody(options.body), headers, credentials: "same-origin" });
  if (response.status === 401 && !path.startsWith("/auth/")) {
    window.dispatchEvent(new Event(SIGNED_OUT_EVENT));
  }
  if (!response.ok) {
    let errorDetail = `Request failed: ${response.status} ${response.statusText}`;
    try {
      const errJson = await response.json();
      if (errJson) {
        if (errJson.detail !== undefined) {
          errorDetail = formatErrorMessage(errJson.detail);
        } else if (errJson.message) {
          errorDetail = formatErrorMessage(errJson.message);
        } else if (errJson.error) {
          errorDetail = formatErrorMessage(errJson.error);
        }
      }
    } catch {
      // ignore
    }
    throw new Error(errorDetail);
  }
  return response.json();
}

export const api = {
  // Sign-in
  me: () => request("/auth/me", { cache: "no-store" }),
  authConfig: () => request("/auth/config", { cache: "no-store" }),
  login: ({ username, password, admin = false }) =>
    request(admin ? "/auth/admin/login" : "/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  logout: () => request("/auth/logout", { method: "POST" }),

  // Accounts (admin only)
  listUsers: () => request("/admin/users", { cache: "no-store" }),
  createUser: ({ username, displayName, role, password }) =>
    request("/admin/users", { method: "POST", body: JSON.stringify({ username, display_name: displayName, role, password }) }),
  updateUser: (id, changes) => request(`/admin/users/${id}`, { method: "PUT", body: JSON.stringify(changes) }),
  deleteUser: (id) => request(`/admin/users/${id}`, { method: "DELETE" }),

  // Project & Samples
  getProject: (id = cur()) => request(`/projects/${id}`),
  resetSample: () => request("/sample/reset", { method: "POST" }),
  loadSample: () => request("/sample/load", { method: "POST" }),
  deriveClaims: (id = cur()) => request(`/projects/${id}/derive`, { method: "POST" }),
  extractClaims: (id = cur()) => request(`/projects/${id}/extract`, { method: "POST" }),

  // Workspaces
  listProjects: () => request("/projects", { cache: "no-store" }),
  createProject: ({ name, leaverName, departureDate }) =>
    request("/projects", {
      method: "POST",
      body: JSON.stringify({ role: "lead", name, leaver_name: leaverName, departure_date: departureDate }),
    }),
  deleteProject: (id) => request(`/projects/${id}?role=lead`, { method: "DELETE" }),
  listSources: (id = cur(), role = "lead") => request(`/projects/${id}/sources?role=${encodeURIComponent(role)}`, { cache: "no-store" }),
  pasteSource: ({ projectId = cur(), kind, name, accessLevel = "team", text }) =>
    request(`/projects/${projectId}/sources/paste`, {
      method: "POST",
      body: JSON.stringify({ role: "lead", kind, name, access_level: accessLevel, text }),
    }),
  githubSource: ({ projectId = cur(), url, leaver }) =>
    request(`/projects/${projectId}/sources/github`, {
      method: "POST",
      body: JSON.stringify({ role: "lead", url, leaver: leaver || null }),
    }),
  repoMap: (projectId = cur(), role = "lead") =>
    request(`/projects/${projectId}/repo-map?role=${encodeURIComponent(role)}`, { cache: "no-store" }),
  deleteSource: (sourceId, projectId = cur()) => request(`/projects/${projectId}/sources/${sourceId}?role=lead`, { method: "DELETE" }),
  analyseProject: (projectId = cur()) =>
    request(`/projects/${projectId}/analyse`, { method: "POST", body: JSON.stringify({ role: "lead" }) }),

  // Claims & Review
  getClaims: ({ projectId = cur(), role = "lead", status, type, reviewState } = {}) => {
    const params = new URLSearchParams({
      project_id: projectId.toString(),
      role,
    });
    if (status && status !== "all") params.append("status", status);
    if (type && type !== "all") params.append("type", type);
    if (reviewState && reviewState !== "all") params.append("review_state", reviewState);
    return request(`/claims?${params.toString()}`);
  },

  getClaimStats: ({ projectId = cur(), role = "lead" } = {}) => {
    const params = new URLSearchParams({
      project_id: projectId.toString(),
      role,
    });
    return request(`/claims/stats?${params.toString()}`);
  },

  // The server gives a request without a role the lowest access, so always send it.
  getClaimContext: (claimId, role = "lead") =>
    request(`/claims/${claimId}/context?role=${encodeURIComponent(role)}`),
  getClaimVersions: (claimId, role = "lead") =>
    request(`/claims/${claimId}/versions?role=${encodeURIComponent(role)}`),

  approveClaim: (claimId, { role = "lead", note } = {}) =>
    request(`/claims/${claimId}/approve`, {
      method: "POST",
      body: JSON.stringify({ role, note }),
    }),

  bulkApproveVerified: ({ projectId = cur(), role = "lead" } = {}) =>
    request(`/claims/bulk-approve-verified?project_id=${projectId}`, {
      method: "POST",
      body: JSON.stringify({ role }),
    }),

  rejectClaim: (claimId, { role = "lead", reason }) =>
    request(`/claims/${claimId}/reject`, {
      method: "POST",
      body: JSON.stringify({ role, reason }),
    }),

  editClaim: (claimId, { role = "lead", correctedText, note } = {}) =>
    request(`/claims/${claimId}/edit`, {
      method: "POST",
      body: JSON.stringify({ role, corrected_text: correctedText, note }),
    }),

  // Debrief questions and readiness (plain rules, no AI)
  getDebrief: ({ projectId = cur(), role = "lead" } = {}) =>
    request(`/projects/${projectId}/debrief?role=${encodeURIComponent(role)}`, { cache: "no-store" }),
  answerDebrief: ({ projectId = cur(), role = "lead", questionClaimId, answer }) =>
    request(`/projects/${projectId}/debrief/answer`, {
      method: "POST",
      body: JSON.stringify({ role, question_claim_id: questionClaimId, answer }),
    }),

  // Handover & Acknowledge
  getHandover: ({ projectId = cur(), role = "incoming_dev" } = {}) => {
    const params = new URLSearchParams({ role, _ts: Date.now().toString() });
    return request(`/projects/${projectId}/handover?${params.toString()}`, {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
      },
    });
  },

  acknowledgeHandover: (projectId = cur(), { role = "incoming_dev", recipientName = "Team Member", note } = {}) =>
    request(`/projects/${projectId}/acknowledge`, {
      method: "POST",
      body: JSON.stringify({ role, recipient_name: recipientName, note }),
    }),

  // Backtest
  getBacktest: (projectId = cur()) => request(`/backtest/projects/${projectId}`),
  getBacktestDatasets: () => request(`/backtest/datasets`),
  getTrustReport: () => request(`/trust/report`),
  importGithub: (body) => request(`/import/github`, { method: "POST", body: JSON.stringify(body) }),
  getRealBacktest: (name) => request(`/backtest/real/${encodeURIComponent(name)}`),

  // Tripwires
  checkChange: ({ projectId = cur(), role = "incoming_dev", files = [], diff = null, description = "" } = {}) =>
    request(`/projects/${projectId}/tripwires/check`, {
      method: "POST",
      body: JSON.stringify({ role, files, diff, description }),
    }),
  getTripwireReplay: () => request(`/tripwires/replay`),
};

