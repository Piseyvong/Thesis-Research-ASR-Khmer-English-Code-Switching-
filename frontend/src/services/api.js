const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
const MOCK_USER_STORAGE_KEY = "speech-request-mock-user-id";
let sessionUserId = typeof window !== "undefined" ? window.localStorage.getItem(MOCK_USER_STORAGE_KEY) : null;

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(sessionUserId ? { "X-Mock-User-Id": sessionUserId } : {}),
      ...(options.headers || {}),
    },
  });

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const body = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const detail = typeof body === "object" && body?.detail ? body.detail : body;
    throw new Error(detail || `Request failed: ${res.status}`);
  }

  return body;
}

export function getStoredMockUserId() {
  return sessionUserId;
}

export function setApiMockUser(userId) {
  sessionUserId = userId || null;
  if (typeof window === "undefined") {
    return;
  }

  if (sessionUserId) {
    window.localStorage.setItem(MOCK_USER_STORAGE_KEY, sessionUserId);
  } else {
    window.localStorage.removeItem(MOCK_USER_STORAGE_KEY);
  }
}

export const api = {
  listMockUsers: () => apiFetch("/api/session/users"),
  loginMockUser: (email, password) =>
    apiFetch("/api/session/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),
  listModels: () => apiFetch("/api/models"),
  listRequests: () => apiFetch("/api/requests/"),
  getRequest: (id) => apiFetch(`/api/requests/${id}`),
  getChat: (id) => apiFetch(`/api/requests/${id}/chat`),
  postChat: (id, content) =>
    apiFetch(`/api/requests/${id}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    }),
  updateFields: (id, fields, formType, assignedManagerId) =>
    apiFetch(`/api/requests/${id}/fields`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields, form_type: formType || null, assigned_manager_id: assignedManagerId || null }),
    }),
  updateTranscript: (id, content) =>
    apiFetch(`/api/requests/${id}/transcript`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    }),
  submitRequest: (id) => apiFetch(`/api/requests/${id}/submit`, { method: "POST" }),
  deleteRequest: (id) => apiFetch(`/api/requests/${id}`, { method: "DELETE" }),

  createFromAudio: async (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return apiFetch("/api/requests/from-audio", { method: "POST", body: fd });
  },
  createFromText: (content) =>
    apiFetch("/api/requests/from-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    }),

  listManagerRequests: () => apiFetch("/api/manager/requests"),
  managerApprove: (id, comment) =>
    apiFetch(`/api/manager/requests/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment }),
    }),
  managerReject: (id, comment) =>
    apiFetch(`/api/manager/requests/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment }),
    }),
  managerReturn: (id, question, comment) =>
    apiFetch(`/api/manager/requests/${id}/return`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, comment }),
    }),
  managerClarify: (id, question, comment) =>
    apiFetch(`/api/manager/requests/${id}/clarify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, comment }),
    }),

  listEmails: () => apiFetch("/api/emails"),
};
