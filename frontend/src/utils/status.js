const statusLabels = {
  created: "Created",
  queued: "Queued",
  ringing: "Ringing",
  answered: "Answered",
  "in-progress": "In progress",
  completed: "Completed",
  failed: "Failed",
  busy: "Busy",
  "no-answer": "No answer",
  unknown: "Unknown",
};

export const activeCallStatuses = ["created", "queued", "ringing", "answered", "in-progress"];
export const unsuccessfulCallStatuses = ["failed", "busy", "no-answer"];
export const terminalCallStatuses = ["completed", ...unsuccessfulCallStatuses];

export function readableStatus(status) {
  const normalized = String(status || "unknown").toLowerCase();
  return statusLabels[normalized] || normalized.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function normalizeIndianMobile(value) {
  const compact = String(value || "").trim().replace(/[\s\-()]/g, "");
  if (/^\d{10}$/.test(compact)) return `+91${compact}`;
  if (/^91\d{10}$/.test(compact)) return `+${compact}`;
  if (/^\+91\d{10}$/.test(compact)) return compact;
  return "";
}

export function isValidIndianMobile(value) {
  return /^\+91[6-9]\d{9}$/.test(normalizeIndianMobile(value));
}
