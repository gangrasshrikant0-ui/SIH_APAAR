const API_BASE_URL = (import.meta.env || {}).VITE_API_BASE_URL || "http://localhost:3001/api";
import { getCurrentUser } from "../mocks/mockStore.js";

function authHeaders(institutionId, role) {
  const user = getCurrentUser();
  return {
    "X-Institution-Id": institutionId || user?.id || "INST-001",
    "X-Role": role || (user?.role === "AICTE" ? "AICTE" : "INSTITUTION"),
    "X-Actor": user?.name || "Demo User"
  };
}

async function readResponse(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body.errors?.map((error) => `Row ${error.row}: ${error.message}`).join(" ") ||
      body.message || "Ingestion request failed.";
    throw new Error(message);
  }
  return body;
}

async function requestOrOffline(request) {
  try {
    return await request();
  } catch (error) {
    if (error instanceof TypeError || error.name === "AbortError") return { offline: true };
    throw error;
  }
}

function notifyDataSync(result) {
  if (!result?.offline && typeof window !== "undefined") window.dispatchEvent(new Event("apaar:data-sync"));
  return result;
}

export async function ingestStudent(student, institutionId) {
  return requestOrOffline(async () => {
    const response = await fetch(`${API_BASE_URL}/students`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(institutionId)
      },
      body: JSON.stringify(student)
    });
    return notifyDataSync(await readResponse(response));
  });
}

export async function ingestStudentsCsv(file, institutionId, mapping = null) {
  return requestOrOffline(async () => {
    const formData = new FormData();
    formData.append("file", file);
    if (mapping) formData.append("mapping", JSON.stringify(mapping));
    const response = await fetch(`${API_BASE_URL}/students/bulk`, {
      method: "POST",
      headers: authHeaders(institutionId),
      body: formData
    });
    return notifyDataSync(await readResponse(response));
  });
}

export function isBackendConfigured() {
  return Boolean((import.meta.env || {}).VITE_API_BASE_URL);
}

export function storedRecordsOnly(result) {
  return (result?.records || []).filter((record) =>
    ["UPLOADED", "ACTION_REQUIRED", "PENDING_REVIEW"].includes(record.status)
  );
}

export async function getBackendReviewQueue(institution) {
  return requestOrOffline(async () => {
    const response = await fetch(`${API_BASE_URL}/aicte/review-queue${institution && institution !== "ALL" ? `?institution=${encodeURIComponent(institution)}` : ""}`, { headers: authHeaders(getCurrentUser()?.id, "AICTE") });
    return readResponse(response);
  });
}

export async function getBackendStudentJourney(apaarId, role) {
  return requestOrOffline(async () => {
    const user = getCurrentUser();
    const endpoint = role === "AICTE" ? `/aicte/students/by-apaar/${apaarId}` : `/students/by-apaar/${apaarId}`;
    const response = await fetch(`${API_BASE_URL}${endpoint}`, { headers: authHeaders(user?.id, role === "AICTE" ? "AICTE" : "INSTITUTION") });
    return readResponse(response);
  });
}

export async function getBackendAudit() {
  return requestOrOffline(async () => {
    const response = await fetch(`${API_BASE_URL}/aicte/audit`, { headers: authHeaders(getCurrentUser()?.id, "AICTE") });
    return readResponse(response);
  });
}

export async function syncRecordOutcome(id, status, issues) {
  return requestOrOffline(async () => {
    const user = getCurrentUser();
    const response = await fetch(`${API_BASE_URL}/students/${id}/outcome`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(user?.id, "INSTITUTION") },
      body: JSON.stringify({ status, issues })
    });
    return notifyDataSync(await readResponse(response));
  });
}

export async function correctBackendRecord(id, fields) {
  return requestOrOffline(async () => {
    const user = getCurrentUser();
    const response = await fetch(`${API_BASE_URL}/students/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders(user?.id, "INSTITUTION") },
      body: JSON.stringify(fields)
    });
    return notifyDataSync(await readResponse(response));
  });
}

export async function acceptBackendRecord(id) {
  return requestOrOffline(async () => {
    const user = getCurrentUser();
    const response = await fetch(`${API_BASE_URL}/students/${id}/accept`, {
      method: "POST",
      headers: authHeaders(user?.id, "INSTITUTION")
    });
    return notifyDataSync(await readResponse(response));
  });
}

export async function reviewBackendRecord(id, decision, note) {
  return requestOrOffline(async () => {
    const response = await fetch(`${API_BASE_URL}/aicte/students/${id}/review`, {
      method: "POST",
      headers: authHeaders(getCurrentUser()?.id, "AICTE"),
      body: JSON.stringify({ decision, note })
    });
    return notifyDataSync(await readResponse(response));
  });
}

export async function getBackendRepository() {
  return requestOrOffline(async () => {
    const response = await fetch(`${API_BASE_URL}/aicte/repository`, { headers: authHeaders(getCurrentUser()?.id, "AICTE") });
    return readResponse(response);
  });
}

export async function getBackendMeta() {
  return requestOrOffline(async () => {
    const response = await fetch(`${API_BASE_URL}/meta`);
    return readResponse(response);
  });
}

export async function getBackendDashboard(role, institutionId) {
  return requestOrOffline(async () => {
    const user = getCurrentUser();
    const endpoint = role === "AICTE"
      ? `/aicte/dashboard${institutionId && institutionId !== "ALL" ? `?institution=${encodeURIComponent(institutionId)}` : ""}`
      : "/college/dashboard";
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: authHeaders(institutionId || user?.id, role === "AICTE" ? "AICTE" : "INSTITUTION")
    });
    return readResponse(response);
  });
}

export async function getBackendReport(role, institutionId) {
  return requestOrOffline(async () => {
    const user = getCurrentUser();
    const endpoint = role === "AICTE" ? "/aicte/reports/intake" : "/college/reports/summary";
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: authHeaders(institutionId || user?.id, role === "AICTE" ? "AICTE" : "INSTITUTION")
    });
    return readResponse(response);
  });
}
