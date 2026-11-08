// Optional backend contracts. These are not called by the local demo.
// Configure a backend you control; never put AI, food API, or service-role secrets in VITE_* variables.
const apiBase = import.meta.env?.VITE_API_BASE_URL || "";
async function request(path, options = {}) {
  if (!apiBase)
    throw Error("Connect your backend before using this integration.");
  const response = await fetch(new URL(path, apiBase), {
    credentials: "include",
    ...options,
  });
  if (!response.ok)
    throw Error(`Integration request failed (${response.status}).`);
  return response.json();
}
export const classifyMeal = (photo) => {
  const body = new FormData();
  body.append("photo", photo);
  return request("/api/recognition", { method: "POST", body });
};
export const lookupNutrition = (query) =>
  request("/api/nutrition?q=" + encodeURIComponent(query));
export const localOffers = (city) =>
  request("/api/offers?city=" + encodeURIComponent(city));
export const sendScannerEvent = (event) =>
  request("/api/scanner/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
  });
export const getHousehold = () => request("/api/households/current");
