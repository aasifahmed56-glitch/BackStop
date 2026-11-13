/**
 * Backstop Frontend API Client
 */

const BASE_URL = "/api";

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
      if (errJson.detail) errorDetail = errJson.detail;
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
    const params = new URLSearchParams({ role });
    return request(`/projects/${projectId}/handover?${params.toString()}`);
  },

  acknowledgeHandover: (projectId = 1, { role = "incoming_dev", recipientName = "Team Member", note } = {}) =>
    request(`/projects/${projectId}/acknowledge`, {
      method: "POST",
      body: JSON.stringify({ role, recipient_name: recipientName, note }),
    }),

  // Backtest
  getBacktest: (projectId = 1) => request(`/backtest/projects/${projectId}`),
};

