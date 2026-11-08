import { FileImages } from "./images.mjs";
import {
  socialView,
  updateSocial,
  inviteFriend,
  joinFriend,
  removeFriend,
  requestSocialTrade,
  respondSocialTrade,
} from "./social.mjs";
import { createAutomation } from "./automation.mjs";
import { searchNutrition } from "./nutrition.mjs";
import {
  localDevelopmentOrigins,
  normalizeOrigins,
  originIsAllowed,
} from "./origins.mjs";
import http from "node:http";
import https from "node:https";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FileStore } from "./store.mjs";
const ROOT = fileURLToPath(new URL("../", import.meta.url));
const MAX_IMAGE = 1024 * 1024,
  MAX_JSON = 2 * 1024 * 1024,
  CODE_TTL = 120000,
  CAPTURE_TTL = 30000;
const hash = (value) => createHash("sha256").update(value).digest("hex");
const secret = () => randomBytes(32).toString("base64url");
class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const demand = (test, status, msg) => {
  if (!test) throw new ApiError(status, msg);
};
async function body(req, limit) {
  // Some Node function adapters supply an already-parsed body.
  if (req.body !== undefined) {
    const value = Buffer.isBuffer(req.body)
      ? req.body
      : req.body instanceof Uint8Array
        ? Buffer.from(req.body)
        : typeof req.body === "string"
          ? Buffer.from(req.body)
          : Buffer.from(JSON.stringify(req.body));
    demand(value.length <= limit, 413, "Upload is too large.");
    return value;
  }
  const length = Number(req.headers["content-length"] || 0);
  demand(length <= limit, 413, "Upload is too large.");
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    demand(size <= limit, 413, "Upload is too large.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
async function jsonBody(req) {
  try {
    return JSON.parse((await body(req, MAX_JSON)).toString("utf8") || "{}");
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(400, "Send valid JSON.");
  }
}
function publicEvent(e) {
  return {
    id: e.id,
    createdAt: e.createdAt,
    trigger: e.trigger,
    expectedCameraIds: e.expectedCameraIds,
    images: e.images,
    status: e.status,
    analysis: e.analysis || null,
    confirmation: e.confirmation || null,
    confirmedAt: e.confirmedAt || null,
  };
}
function safeSession(s, now) {
  return {
    id: s.id,
    fridgeId: s.fridgeId,
    fridgeName: s.fridgeName,
    cameras: s.cameras.map((c) => ({
      id: c.id,
      name: c.name,
      lastSeen: c.lastSeen,
      online: !c.revoked && c.ready && now - c.lastSeen < 12000,
      revoked: c.revoked,
    })),
    events: s.events.map(publicEvent),
    automation: s.automation || { enabled: false },
    context: s.context || null,
  };
}
function findAuth(state, req, role) {
  const raw = (req.headers.authorization || "").replace(/^Bearer /, "");
  demand(raw.length >= 32, 401, "Pair or create a camera session first.");
  const digest = hash(raw);
  for (const s of Object.values(state.sessions)) {
    if (role !== "camera" && s.ownerHash === digest)
      return { session: s, role: "owner" };
    if (role !== "owner") {
      const camera = s.cameras.find(
        (c) => !c.revoked && c.tokenHash === digest,
      );
      if (camera) return { session: s, camera, role: "camera" };
    }
  }
  throw new ApiError(401, "This device session is no longer authorized.");
}
function capture(s, trigger, now, { auto = false } = {}) {
  if (auto) {
    const previous = s.events.find(
      (e) => e.status === "pending" && now - e.createdAt < 5000,
    );
    if (previous) {
      for (const c of s.cameras.filter(
        (c) => !c.revoked && c.ready && now - c.lastSeen < 12000,
      ))
        if (!previous.expectedCameraIds.includes(c.id))
          previous.expectedCameraIds.push(c.id);
      return previous;
    }
  }
  const expected = s.cameras
    .filter((c) => !c.revoked && c.ready && now - c.lastSeen < 12000)
    .map((c) => c.id);
  demand(
    expected.length,
    409,
    "No camera is online. Open Camera Companion on a paired phone.",
  );
  demand(
    s.events.length < 200,
    409,
    "This session has 200 events. Delete old events to capture more.",
  );
  const e = {
    id: randomUUID(),
    createdAt: now,
    trigger,
    expectedCameraIds: expected,
    images: [],
    status: "pending",
  };
  s.events.unshift(e);
  return e;
}
function validateConfirmation(value) {
  demand(
    value && ["in", "out", "ignore"].includes(value.direction),
    400,
    "Choose an incoming, outgoing, or ignored event.",
  );
  if (value.direction === "ignore") return { direction: "ignore" };
  const grams = Number(value.grams);
  demand(
    Number.isFinite(grams) && grams > 0 && grams <= 100000,
    400,
    "Enter a valid food quantity.",
  );
  if (value.direction === "in") {
    demand(
      typeof value.foodName === "string" && value.foodName.length <= 80,
      400,
      "Choose a food.",
    );
    demand(
      typeof value.fridgeId === "string" && value.fridgeId.length <= 80,
      400,
      "Choose a fridge.",
    );
    demand(
      typeof value.ownerId === "string" && value.ownerId.length <= 80,
      400,
      "Choose an owner.",
    );
    demand(
      /^\d{4}-\d{2}-\d{2}$/.test(value.expires || ""),
      400,
      "Choose an expiry date.",
    );
    return {
      direction: "in",
      grams,
      foodName: value.foodName,
      fridgeId: value.fridgeId,
      ownerId: value.ownerId,
      expires: value.expires,
      containerId: String(value.containerId || "").slice(0, 80),
    };
  }
  demand(
    typeof value.itemId === "string" && value.itemId.length <= 100,
    400,
    "Choose the food leaving.",
  );
  demand(
    ["eaten", "discarded", "moved"].includes(value.action),
    400,
    "Choose why the food left.",
  );
  return {
    direction: "out",
    grams,
    itemId: value.itemId,
    action: value.action,
  };
}
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
  ".json": "application/json",
};
export function createApp({
  dataDir = path.join(ROOT, ".fridgeful-data"),
  publicDir = path.join(ROOT, "dist"),
  allowedOrigins = localDevelopmentOrigins,
  trustProxy = false,
  visionAnalyzer,
  visionKeyConfigured,
  now = () => Date.now(),
  store: storage,
  images: imageStorage,
  background = (promise) => {
    void promise;
  },
} = {}) {
  const acceptedOrigins = normalizeOrigins(allowedOrigins);
  const store = storage || new FileStore(dataDir),
    attempts = new Map();
  const jobs = new Set();
  function launch(promise) {
    jobs.add(promise);
    background(promise);
    promise.finally(() => jobs.delete(promise)).catch(() => {});
  }
  async function drain() {
    while (jobs.size) await Promise.allSettled([...jobs]);
  }
  const images = imageStorage || new FileImages(dataDir);
  const automation = createAutomation({
    store,
    images,
    vision: visionAnalyzer,
    keyConfigured: visionKeyConfigured,
  });
  function kickAutomation(session) {
    if (!session.automation?.enabled) return;
    const event = [...session.events]
      .reverse()
      .find(
        (e) =>
          e.status === "pending" &&
          e.images.length === e.expectedCameraIds.length &&
          (!e.analysis ||
            (e.analysis.state === "processing" &&
              !(session.analysisLease?.until > Date.now()))),
      );
    if (event) launch(automation.processEvent(session.id, event.id));
  }
  function rate(req, scope, limit) {
    const key = (req.socket.remoteAddress || "unknown") + ":" + scope;
    const t = now();
    const r = attempts.get(key);
    const entry = !r || r.until < t ? { count: 0, until: t + 60000 } : r;
    entry.count++;
    attempts.set(key, entry);
    if (attempts.size > 10000)
      for (const [k, v] of attempts) if (v.until < t) attempts.delete(k);
    demand(
      entry.count <= limit,
      429,
      "Too many attempts. Try again in one minute.",
    );
  }
  async function route(req, res) {
    const url = new URL(req.url, "http://" + (req.headers.host || "localhost"));
    const p = url.pathname;
    const method = req.method;
    const origin = req.headers.origin;
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    if (p.startsWith("/api/")) {
      res.setHeader("Cache-Control", "no-store");
      demand(
        originIsAllowed(req, acceptedOrigins, { trustProxy }),
        403,
        `This app origin (${origin}) is not allowed. Add the exact app URL to ALLOWED_ORIGINS in the root .env file, then restart the server.`,
      );
      if (origin && acceptedOrigins.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Vary", "Origin");
        res.setHeader(
          "Access-Control-Allow-Headers",
          "Authorization, Content-Type",
        );
        res.setHeader(
          "Access-Control-Allow-Methods",
          "GET, POST, DELETE, OPTIONS",
        );
      }
      if (method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }
      rate(req, "api", 600);
      const send = (value, status = 200) => {
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(value));
      };
      if (p.startsWith("/api/social")) {
        if (p === "/api/social" && method === "GET") {
          const state = await store.read();
          const { session: s } = findAuth(state, req, "owner");
          return send(socialView(state, s));
        }
        if (method === "POST") {
          const input = await jsonBody(req);
          const result = await store.mutate((state) => {
            const { session: s } = findAuth(state, req, "owner");
            try {
              if (p === "/api/social/profile") return updateSocial(s, input);
              if (p === "/api/social/invite") return inviteFriend(s, now());
              if (p === "/api/social/join")
                return joinFriend(state, s, input.code, now());
              if (p === "/api/social/remove")
                return removeFriend(state, s, input.friendId);
              if (p === "/api/social/trades")
                return requestSocialTrade(state, s, input, now());
              if (p === "/api/social/respond")
                return respondSocialTrade(
                  state,
                  s,
                  input.tradeId,
                  input.status,
                );
              throw new ApiError(404, "Social endpoint not found.");
            } catch (e) {
              if (e instanceof ApiError) throw e;
              throw new ApiError(400, e.message);
            }
          });
          return send(result);
        }
      }
      if (p === "/api/nutrition/search" && method === "GET")
        return send(
          await searchNutrition(
            (url.searchParams.get("q") || "").slice(0, 120),
          ),
        );
      if (p === "/api/automation/status" && method === "GET") {
        const state = await store.read();
        findAuth(state, req, "owner");
        return send({
          keyConfigured: automation.keyConfigured(),
          model: process.env.VISION_MODEL || "gemini-3.8-flash",
          nutrientSource: "Health Canada CNF 2015",
        });
      }
      if (p === "/api/context" && method === "POST") {
        const input = await jsonBody(req);
        return send(
          await store.mutate((state) => {
            const { session: s } = findAuth(state, req, "owner");
            demand(
              Array.isArray(input.inventory) &&
                input.inventory.length <= 500 &&
                Array.isArray(input.containers) &&
                input.containers.length <= 50,
              400,
              "Invalid fridge context.",
            );
            const applied = s.events
              .filter((e) => e.confirmation?.direction === "automation")
              .map((e) => e.id);
            demand(
              applied.every((id) => (input.appliedEventIds || []).includes(id)),
              409,
              "Apply pending automatic events before syncing more local changes.",
            );
            s.context = {
              fridgeId: s.fridgeId,
              inventory: input.inventory.filter(
                (i) => i.fridgeId === s.fridgeId,
              ),
              containers: input.containers.filter(
                (c) => c.fridgeId === s.fridgeId,
              ),
              defaultOwnerId:
                typeof input.defaultOwnerId === "string" &&
                /^[a-zA-Z0-9_-]{1,80}$/.test(input.defaultOwnerId)
                  ? input.defaultOwnerId
                  : "me",
              revision: (s.context?.revision || 0) + 1,
            };
            return { revision: s.context.revision };
          }),
        );
      }
      if (p === "/api/automation" && method === "POST") {
        const input = await jsonBody(req);
        return send(
          await store.mutate((state) => {
            const { session: s } = findAuth(state, req, "owner");
            if (input.enabled) {
              demand(
                automation.keyConfigured(),
                409,
                "Add GEMINI_API_KEY to the server environment and restart before enabling automatic recognition.",
              );
              demand(
                input.consent === true,
                400,
                "Image-analysis consent is required.",
              );
              demand(s.context, 409, "Sync the fridge context first.");
            }
            s.automation = {
              enabled: !!input.enabled,
              consent: input.consent === true,
              logRemovalsAsIntake: !!input.logRemovalsAsIntake,
            };
            return s.automation;
          }),
        );
      }
      const analysisMatch = p.match(/^\/api\/events\/([a-f0-9-]+)\/analyze$/);
      if (analysisMatch && method === "POST") {
        const state = await store.read();
        const { session: s } = findAuth(state, req, "owner");
        demand(
          s.events.some((e) => e.id === analysisMatch[1]),
          404,
          "Event not found.",
        );
        demand(
          s.automation?.enabled,
          409,
          "Enable automatic recognition first.",
        );
        launch(
          automation.processEvent(s.id, analysisMatch[1], { force: true }),
        );
        return send({ queued: true }, 202);
      }
      if (p === "/api/health" && method === "GET")
        return send({ ok: true, protocol: 1 });
      if (p === "/api/sessions" && method === "POST") {
        rate(req, "sessions", 10);
        const input = await jsonBody(req);
        const token = secret();
        const result = await store.mutate((state) => {
          demand(
            Object.keys(state.sessions).length < 100,
            409,
            "Session limit reached. Delete an old session first.",
          );
          const s = {
            id: randomUUID(),
            ownerHash: hash(token),
            fridgeId: String(input.fridgeId || "my-fridge").slice(0, 80),
            fridgeName: String(input.fridgeName || "My fridge").slice(0, 80),
            createdAt: now(),
            cameras: [],
            events: [],
          };
          state.sessions[s.id] = s;
          return { sessionId: s.id, ownerToken: token };
        });
        return send(result, 201);
      }
      if (p === "/api/pair" && method === "POST") {
        rate(req, "pair", 12);
        const input = await jsonBody(req);
        const code = String(input.code || "")
          .replace(/\s|-/g, "")
          .toUpperCase();
        demand(
          /^[A-Z2-9]{6}$/.test(code),
          400,
          "Enter the six-character pairing code.",
        );
        const token = secret();
        const result = await store.mutate((state) => {
          const s = Object.values(state.sessions).find(
            (s) =>
              s.pairCode?.hash === hash(code) && s.pairCode.expiresAt > now(),
          );
          demand(
            s,
            400,
            "Pairing code is invalid or expired. Create another code.",
          );
          demand(
            s.cameras.filter((c) => !c.revoked).length < 2,
            409,
            "Two cameras are already paired. Remove one before pairing another.",
          );
          demand(
            ["Top Camera", "Side Camera"].includes(input.name),
            400,
            "Choose Top Camera or Side Camera.",
          );
          demand(
            !s.cameras.some((c) => !c.revoked && c.name === input.name),
            409,
            input.name + " is already paired. Choose the other role or remove that camera first.",
          );
          const c = {
            id: randomUUID(),
            name: input.name,
            tokenHash: hash(token),
            lastSeen: now(),
            ready: false,
            revoked: false,
          };
          s.cameras.push(c);
          delete s.pairCode;
          return {
            cameraId: c.id,
            cameraToken: token,
            cameraName: c.name,
            sessionId: s.id,
            fridgeName: s.fridgeName,
          };
        });
        return send(result, 201);
      }
      if (p === "/api/session" && method === "GET") {
        const state = await store.read();
        const session = findAuth(state, req, "owner").session;
        kickAutomation(session);
        return send(safeSession(session, now()));
      }
      if (p === "/api/pairing" && method === "POST") {
        const code = Array.from(
          randomBytes(6),
          (v) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[v % 32],
        ).join("");
        const result = await store.mutate((state) => {
          const { session: s } = findAuth(state, req, "owner");
          demand(
            s.cameras.filter((c) => !c.revoked).length < 2,
            409,
            "Both camera slots are paired.",
          );
          s.pairCode = { hash: hash(code), expiresAt: now() + CODE_TTL };
          return { code, expiresAt: s.pairCode.expiresAt };
        });
        return send(result);
      }
      if (p === "/api/capture" && method === "POST") {
        const input = await jsonBody(req);
        return send(
          await store.mutate((state) =>
            publicEvent(
              capture(
                findAuth(state, req, "owner").session,
                input.baseline ? "baseline" : "main-phone",
                now(),
              ),
            ),
          ),
          201,
        );
      }
      if (p === "/api/camera/heartbeat" && method === "POST") {
        const input = await jsonBody(req);
        const before = await store.read();
        const session = findAuth(before, req, "camera").session;
        kickAutomation(session);
        return send(
          await store.mutate((state) => {
            const { session: s, camera: c } = findAuth(state, req, "camera");
            c.lastSeen = now();
            c.ready = input.ready === true;
            return {
              cameraId: c.id,
              name: c.name,
              fridgeName: s.fridgeName,
              commands: s.events
                .filter(
                  (e) =>
                    e.status === "pending" &&
                    now() - e.createdAt < CAPTURE_TTL &&
                    e.expectedCameraIds.includes(c.id) &&
                    !e.images.some((i) => i.cameraId === c.id),
                )
                .map((e) => ({
                  eventId: e.id,
                  trigger: e.trigger,
                  createdAt: e.createdAt,
                })),
            };
          }),
        );
      }
      if (p === "/api/camera/event" && method === "POST") {
        const input = await jsonBody(req);
        return send(
          await store.mutate((state) => {
            const { session: s, camera: c } = findAuth(state, req, "camera");
            c.lastSeen = now();
            c.ready = true;
            return publicEvent(
              capture(
                s,
                ["motion", "manual"].includes(input.trigger)
                  ? input.trigger
                  : "manual",
                now(),
                { auto: true },
              ),
            );
          }),
          201,
        );
      }
      let match = p.match(/^\/api\/events\/([a-f0-9-]+)\/image$/);
      if (match && method === "POST") {
        const eventId = match[1];
        const initial = await store.read();
        const { session: s, camera: c } = findAuth(initial, req, "camera");
        const event = s.events.find((e) => e.id === eventId);
        demand(
          event && event.expectedCameraIds.includes(c.id),
          404,
          "Capture event not found for this camera.",
        );
        demand(
          event.status === "pending",
          409,
          "This event has already been reviewed.",
        );
        const existing = event.images.find((i) => i.cameraId === c.id);
        if (existing) {
          req.resume();
          return send(existing);
        }
        demand(
          now() - event.createdAt < CAPTURE_TTL + 30000,
          409,
          "Capture timed out. Start another event.",
        );
        const imageType = (req.headers["content-type"] || "").split(";")[0];
        let bytes;
        if (imageType === "application/json") {
          const payload = await jsonBody(req);
          const encoded = payload.jpegBase64;
          demand(
            typeof encoded === "string" &&
              encoded.length % 4 === 0 &&
              /^[A-Za-z0-9+/]+={0,2}$/.test(encoded),
            415,
            "Send a valid base64 JPEG.",
          );
          bytes = Buffer.from(encoded, "base64");
          demand(bytes.length <= MAX_IMAGE, 413, "Upload is too large.");
        } else {
          demand(imageType === "image/jpeg", 415, "Send a JPEG image.");
          bytes = await body(req, MAX_IMAGE);
        }
        demand(
          bytes.length >= 4 &&
            bytes[0] === 255 &&
            bytes[1] === 216 &&
            bytes[2] === 255,
          415,
          "This is not a JPEG image.",
        );
        const result = await store.mutate(async (state) => {
          const { session: current, camera } = findAuth(state, req, "camera");
          const e = current.events.find((e) => e.id === eventId);
          demand(
            e?.status === "pending",
            409,
            "This event has already been reviewed.",
          );
          const old = e.images.find((i) => i.cameraId === camera.id);
          if (old) return old;
          const imageId = eventId + "_" + camera.id;
          await images.put(imageId, bytes);
          const record = {
            id: imageId,
            cameraId: camera.id,
            cameraName: camera.name,
            receivedAt: now(),
            bytes: bytes.length,
          };
          e.images.push(record);
          camera.lastSeen = now();
          return record;
        });
        launch(automation.processEvent(s.id, eventId));
        return send(result, 201);
      }
      match = p.match(/^\/api\/images\/([a-f0-9_-]+)$/);
      if (match && method === "GET") {
        const state = await store.read();
        const { session: s } = findAuth(state, req, "owner");
        demand(
          s.events.some((e) => e.images.some((i) => i.id === match[1])),
          404,
          "Image not found.",
        );
        const bytes = await images.get(match[1]);
        res.writeHead(200, {
          "Content-Type": "image/jpeg",
          "Content-Length": bytes.length,
        });
        res.end(bytes);
        return;
      }
      match = p.match(/^\/api\/events\/([a-f0-9-]+)\/confirm$/);
      if (match && method === "POST") {
        const confirmation = validateConfirmation(await jsonBody(req));
        const result = await store.mutate((state) => {
          const { session: s } = findAuth(state, req, "owner");
          const e = s.events.find((e) => e.id === match[1]);
          demand(e, 404, "Event not found.");
          if (e.status === "confirmed" || e.status === "ignored") {
            demand(
              JSON.stringify(e.confirmation) === JSON.stringify(confirmation),
              409,
              "Event already confirmed with different details.",
            );
            return publicEvent(e);
          }
          demand(
            e.images.length > 0 || confirmation.direction === "ignore",
            409,
            "Wait for a camera image before confirming.",
          );
          e.confirmation = confirmation;
          e.status =
            confirmation.direction === "ignore" ? "ignored" : "confirmed";
          e.confirmedAt = now();
          if (
            e.images.length === e.expectedCameraIds.length &&
            e.images.length
          ) {
            s.baseline = e.images;
            s.baselineAt = e.createdAt;
          }
          if (e.analysis)
            e.analysis = {
              ...e.analysis,
              state: "reviewed",
              summary: "Manually reviewed and confirmed.",
            };
          return publicEvent(e);
        });
        return send(result);
      }
      match = p.match(/^\/api\/cameras\/([a-f0-9-]+)$/);
      if (match && method === "DELETE") {
        await store.mutate((state) => {
          const { session: s } = findAuth(state, req, "owner");
          const c = s.cameras.find((c) => c.id === match[1]);
          demand(c, 404, "Camera not found.");
          c.revoked = true;
          delete s.pairCode;
        });
        return send({ ok: true });
      }
      match = p.match(/^\/api\/events\/([a-f0-9-]+)$/);
      if (match && method === "DELETE") {
        await store.mutate(async (state) => {
          const { session: s } = findAuth(state, req, "owner");
          const event = s.events.find((e) => e.id === match[1]);
          for (const image of event?.images || [])
            await images.remove(image.id);
          s.events = s.events.filter((e) => e.id !== match[1]);
        });
        return send({ ok: true });
      }
      if (p === "/api/session" && method === "DELETE") {
        await store.mutate(async (state) => {
          const { session: s } = findAuth(state, req, "owner");
          for (const event of s.events)
            for (const image of event.images) await images.remove(image.id);
          delete state.sessions[s.id];
        });
        return send({ ok: true });
      }
      throw new ApiError(404, "API endpoint not found.");
    }
    demand(method === "GET" || method === "HEAD", 405, "Method not allowed.");
    let relative = decodeURIComponent(p).replace(/^\/+/, "");
    if (!relative || relative === "camera" || relative === "camera/")
      relative = relative.startsWith("camera")
        ? "camera/index.html"
        : "index.html";
    const file = path.resolve(publicDir, relative);
    demand(
      file.startsWith(path.resolve(publicDir) + path.sep),
      403,
      "Invalid path.",
    );
    let data;
    try {
      data = await readFile(file);
    } catch {
      throw new ApiError(404, "Build the apps first with npm run build.");
    }
    res.setHeader(
      "Cache-Control",
      relative.endsWith("sw.js") || relative.endsWith("index.html")
        ? "no-cache"
        : "public, max-age=3600",
    );
    res.writeHead(200, {
      "Content-Type": mime[path.extname(file)] || "application/octet-stream",
    });
    res.end(method === "HEAD" ? undefined : data);
  }
  const handler = (req, res) =>
    route(req, res).catch((error) => {
      if (!res.headersSent) {
        res.writeHead(error.status || 500, {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        });
        res.end(
          JSON.stringify({
            error: error.status
              ? error.message
              : "Server could not complete this request.",
          }),
        );
      } else res.end();
      if (!error.status)
        console.error("Request failed:", error.code || error.name);
    });
  return { handler, store, drain };
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const allowedOrigins = normalizeOrigins([
    ...localDevelopmentOrigins,
    process.env.ALLOWED_ORIGINS || "",
    process.env.PUBLIC_APP_URL || "",
  ]);
  const persistent = process.env.MONGODB_URI
    ? await (await import("./mongo-store.mjs")).getMongoStore()
    : null;
  const app = createApp({
    ...(persistent ? { store: persistent, images: persistent.images } : {}),
    dataDir: process.env.DATA_DIR || undefined,
    allowedOrigins,
    trustProxy: process.env.TRUST_PROXY === "true",
  });
  const port = Number(process.env.PORT || 8787);
  const tls =
    process.env.TLS_CERT && process.env.TLS_KEY
      ? {
          cert: await readFile(process.env.TLS_CERT),
          key: await readFile(process.env.TLS_KEY),
        }
      : null;
  const server = tls
    ? https.createServer(tls, app.handler)
    : http.createServer(app.handler);
  server.listen(port, "0.0.0.0", () =>
    console.log(
      `Refridge server: ${tls ? "https" : "http"}://localhost:${port} (camera companion: /camera/)`,
    ),
  );
}
