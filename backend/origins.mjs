// Exact origins only. Never reflect an arbitrary browser Origin or use '*'.
export const localDevelopmentOrigins = [
  ...["localhost", "127.0.0.1", "[::1]"].flatMap((host) =>
    [4173, 5173, 5174].map((port) => `http://${host}:${port}`),
  ),
  "http://terminal.local:4173",
];
export function normalizeOrigins(values = []) {
  return [
    ...new Set(
      values
        .flatMap((value) => String(value || "").split(","))
        .map((value) => {
          try {
            const url = new URL(value.trim());
            return ["http:", "https:"].includes(url.protocol)
              ? url.origin
              : null;
          } catch {
            return null;
          }
        })
        .filter(Boolean),
    ),
  ];
}
export function originIsAllowed(
  request,
  allowedOrigins,
  { trustProxy = false } = {},
) {
  const origin = request.headers.origin;
  if (!origin) return true;
  const host = request.headers.host;
  const scheme = request.socket.encrypted ? "https" : "http";
  if (origin === `${scheme}://${host}` || allowedOrigins.includes(origin))
    return true;
  // Existing HTTPS termination with the original Host preserved.
  const forwardedProto = String(request.headers["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim();
  if (
    ["http", "https"].includes(forwardedProto) &&
    origin === `${forwardedProto}://${host}`
  )
    return true;
  // Use forwarded authority only when the operator explicitly trusts its reverse proxy.
  if (trustProxy) {
    const forwardedHost = String(request.headers["x-forwarded-host"] || "")
      .split(",")[0]
      .trim();
    if (
      forwardedHost &&
      ["http", "https"].includes(forwardedProto) &&
      origin === `${forwardedProto}://${forwardedHost}`
    )
      return true;
  }
  return false;
}
