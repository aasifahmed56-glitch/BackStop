/**
 * Backstop Frontend API Client
 */

const BASE_URL = "/api";

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
  const url = `${BASE_URL}${path}`;
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const response = await fetch(url, { ...options, headers });
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
  // Project & Samples
  getProject: (id = 1) => request(`/projects/${id}`),
  resetSample: () => request("/sample/reset", { method: "POST" }),
  loadSample: () => request("/sample/load", { method: "POST" }),
  deriveClaims: (id = 1) => request(`/projects/${id}/derive`, { method: "POST" }),
  extractClaims: (id = 1) => request(`/projects/${id}/extract`, { method: "POST" }),

  // Claims & Review
  getClaims: ({ projectId = 1, role = "lead", status, type, reviewState } = {}) => {
    const params = new URLSearchParams({
      project_id: projectId.toString(),
      role,
    });
    if (status && status !== "all") params.append("status", status);
    if (type && type !== "all") params.append("type", type);
    if (reviewState && reviewState !== "all") params.append("review_state", reviewState);
    return request(`/claims?${params.toString()}`);
  },

  getClaimStats: ({ projectId = 1, role = "lead" } = {}) => {
    const params = new URLSearchParams({
      project_id: projectId.toString(),
      role,
    });
    return request(`/claims/stats?${params.toString()}`);
  },

  getClaimContext: (claimId) => request(`/claims/${claimId}/context`),
  getClaimVersions: (claimId) => request(`/claims/${claimId}/versions`),

  approveClaim: (claimId, { role = "lead", note } = {}) =>
    request(`/claims/${claimId}/approve`, {
      method: "POST",
      body: JSON.stringify({ role, note }),
    }),

  bulkApproveVerified: ({ projectId = 1, role = "lead" } = {}) =>
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

  // Handover & Acknowledge
  getHandover: ({ projectId = 1, role = "incoming_dev" } = {}) => {
    const params = new URLSearchParams({ role, _ts: Date.now().toString() });
    return request(`/projects/${projectId}/handover?${params.toString()}`, {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
      },
    });
  },

  acknowledgeHandover: (projectId = 1, { role = "incoming_dev", recipientName = "Team Member", note } = {}) =>
    request(`/projects/${projectId}/acknowledge`, {
      method: "POST",
      body: JSON.stringify({ role, recipient_name: recipientName, note }),
    }),

  // Backtest
  getBacktest: (projectId = 1) => request(`/backtest/projects/${projectId}`),
  getBacktestDatasets: () => request(`/backtest/datasets`),
  getRealBacktest: (name) => request(`/backtest/real/${encodeURIComponent(name)}`),
};

