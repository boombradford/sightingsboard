const API_ORIGIN = String(import.meta.env.VITE_API_ORIGIN || "").replace(/\/+$/, "");

function buildApiUrl(url) {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  if (!API_ORIGIN) return url;
  if (!url.startsWith("/")) return `${API_ORIGIN}/${url}`;
  return `${API_ORIGIN}${url}`;
}

export async function fetchJSON(url, options = {}) {
  const response = await fetch(buildApiUrl(url), options);
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error || `Request failed: ${response.status}`);
  }
  if (payload == null) {
    throw new Error("Server returned invalid JSON.");
  }

  return payload;
}

async function sendJSON(url, method, body) {
  const response = await fetch(buildApiUrl(url), {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error || `Request failed: ${response.status}`);
  }
  return payload;
}

export function postJSON(url, body) {
  return sendJSON(url, "POST", body);
}

export function patchJSON(url, body) {
  return sendJSON(url, "PATCH", body);
}
