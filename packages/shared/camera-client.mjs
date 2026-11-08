export const API_BASE = (import.meta.env?.VITE_CAMERA_API_URL || "").replace(
  /\/$/,
  "",
);
export async function cameraApi(
  path,
  { token, body, method = "GET", signal, raw = false } = {},
) {
  const headers = {};
  if (token) headers.Authorization = "Bearer " + token;
  if (body && !raw) headers["Content-Type"] = "application/json";
  // JSON base64 survives function adapters that pre-parse request bodies.
  if (raw) {
    const bytes = new Uint8Array(await body.arrayBuffer());
    if (bytes.length > 1024 * 1024)
      throw Error("Photo exceeds the 1 MiB limit.");
    let binary = "";
    for (let i = 0; i < bytes.length; i += 32768)
      binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
    body = { jpegBase64: btoa(binary) };
    raw = false;
    headers["Content-Type"] = "application/json";
  }
  const response = await fetch(API_BASE + path, {
    method,
    headers,
    body: body ? (raw ? body : JSON.stringify(body)) : undefined,
    signal,
    cache: "no-store",
    credentials: "include",
  });
  if (!response.ok) {
    let message;
    try {
      message = (await response.json()).error;
    } catch {}
    const error = Error(
      message ||
        "Camera server unavailable. Start the shared backend or check its URL.",
    );
    error.status = response.status;
    throw error;
  }
  return response.json();
}
export async function imageBlob(id, token, signal) {
  const r = await fetch(API_BASE + "/api/images/" + encodeURIComponent(id), {
    headers: { Authorization: "Bearer " + token },
    signal,
    cache: "no-store",
    credentials: "include",
  });
  if (!r.ok) throw Error("Image unavailable.");
  return r.blob();
}
export function readSaved(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}
export function saveDevice(key, value) {
  if (value) localStorage.setItem(key, JSON.stringify(value));
  else localStorage.removeItem(key);
}
