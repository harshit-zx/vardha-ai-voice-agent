const apiBaseUrl = String(
  import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_API_URL ||
    "/api"
).replace(/\/+$/, "");

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
      body.message || "The request could not be completed."
    );
  }

  return body;
}

export const api = {
  // Create outbound call
  createCall(phoneNumber) {
    return request("/calls", {
      method: "POST",
      body: JSON.stringify({
        phoneNumber,
      }),
    });
  },

  // Get call history
  getCalls() {
    return request("/calls");
  },

  // Get single call details
  getCall(id) {
    return request(`/calls/${encodeURIComponent(id)}`);
  },

  // Get Knowledge Base
  getKnowledge() {
    return request("/knowledge");
  },

  // Update Knowledge Base
  updateKnowledge(data) {
    return request("/knowledge", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },
};