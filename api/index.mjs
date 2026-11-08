import { waitUntil } from "@vercel/functions";
import { createApp } from "../backend/server.mjs";
import { getMongoStore } from "../backend/mongo-store.mjs";
import { normalizeOrigins } from "../backend/origins.mjs";
export function originalApiUrl(value) {
  const url = new URL(value, "https://function.invalid");
  const route = url.searchParams.get("__route");
  if (route !== null) {
    url.pathname = "/api/" + route.replace(/^\/+/, "");
    url.searchParams.delete("__route");
  }
  return url.pathname + url.search;
}
export function createVercelHandler({
  storageFactory = getMongoStore,
  background = waitUntil,
} = {}) {
  let application;
  return async function handler(req, res) {
    try {
      if (!application)
        application = Promise.resolve()
          .then(() => storageFactory())
          .then((store) =>
            createApp({
              store,
              images: store.images,
              background: (promise) => background(promise),
              trustProxy: true,
              allowedOrigins: normalizeOrigins([
                process.env.ALLOWED_ORIGINS || "",
                process.env.PUBLIC_APP_URL || "",
              ]),
            }),
          )
          .catch((error) => {
            application = null;
            throw error;
          });
      const app = await application;
      req.url = originalApiUrl(req.url);
      return await app.handler(req, res);
    } catch (error) {
      if (!res.headersSent) {
        res.writeHead(503, {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        });
        res.end(
          JSON.stringify({
            error:
              error.status === 503
                ? error.message
                : "Database unavailable. Check MONGODB_URI, Atlas database-user permissions, and Network Access.",
          }),
        );
      }
    }
  };
}

export default createVercelHandler();
