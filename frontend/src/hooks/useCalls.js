const apiBaseUrl = String(
  import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_API_URL ||
    "/api"
).replace(/\/$/, "");

async function request(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok || body.success === false) {
    throw new Error(
      body.message || `Request failed with status ${response.status}`
    );
  }

  return body;
}

export const api = {
  createCall(phoneNumber) {
    return request("/calls", {
      method: "POST",
      body: JSON.stringify({ phoneNumber }),
    });
  },

  getCalls() {
    return request("/calls");
  },

  getCall(id) {
    return request(`/calls/${encodeURIComponent(id)}`);
  },

  getKnowledge() {
    return request("/knowledge");
  },

  updateKnowledge(data) {
    return request("/knowledge", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },
};