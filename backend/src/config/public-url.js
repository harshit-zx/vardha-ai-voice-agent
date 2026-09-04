function getPublicBaseUrl() {
  const value = String(process.env.PUBLIC_BASE_URL || "").trim();
  return value ? value.replace(/\/+$/, "") : "";
}

function buildPublicUrl(pathname) {
  const baseUrl = getPublicBaseUrl();
  if (!baseUrl) return "";
  return `${baseUrl}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

function buildWebSocketUrl(pathname) {
  const httpUrl = buildPublicUrl(pathname);
  if (!httpUrl) return "";
  return httpUrl.replace(/^http:/i, "ws:").replace(/^https:/i, "wss:");
}

module.exports = {
  getPublicBaseUrl,
  buildPublicUrl,
  buildWebSocketUrl,
};
