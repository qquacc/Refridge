import { sampleState } from "./demo-state.mjs";
import { randomBytes, randomUUID, createHash, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
const derive = promisify(scrypt);
const hash = (v) => createHash("sha256").update(v).digest("hex");
const COOKIE = "refridge_session";
const LIFETIME = 7 * 24 * 60 * 60 * 1000;
const fail = (status, message) => { const e = Error(message); e.status = status; throw e; };
export function signedInAccount(state, req, now = Date.now()) {
  const token = String(req.headers.cookie || "").split(";").map((c) => c.trim()).find((c) => c.startsWith(COOKIE + "="))?.slice(COOKIE.length + 1);
  if (!token || token.length > 100) return null;
  const session = state.accountSessions?.[hash(token)];
  return session?.expiresAt > now ? state.accounts?.[session.accountId] || null : null;
}
function cookie(req, token, expires = LIFETIME / 1000) {
  const secure = !!process.env.VERCEL || !!req.socket.encrypted || req.headers["x-forwarded-proto"] === "https";
  return `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${expires}${secure ? "; Secure" : ""}`;
}
const hasCreatedAt = (account) => (typeof account.createdAt === "number" && Number.isFinite(account.createdAt) && account.createdAt > 0) || (typeof account.createdAt === "string" && account.createdAt.trim() !== "" && Number.isFinite(Date.parse(account.createdAt)));
function view(state, account) {
  const camera = Object.values(state.sessions).find((s) => s.accountId === account.id);
  return { account: { id: account.id, username: account.username, createdAt: account.createdAt ?? null }, appState: account.appState || null, revision: account.revision || 0,
    cameraDevice: camera ? { sessionId: camera.id, ownerToken: "account:" + camera.id } : null };
}
export function validateAppState(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || !Array.isArray(value.items) || !Array.isArray(value.logs) || !Array.isArray(value.groceries) || !value.goals)
    fail(400, "Send a valid fridge state.");
  if (Buffer.byteLength(JSON.stringify(value)) > 1500000) fail(413, "Account data is too large. Export and clear old records before saving.");
  return value;
}
export function createAccountRoutes({ store, now = Date.now, jsonBody }) {
  async function throttle(key, limit) {
    const allowed = await store.mutate((state) => {
      state.accountAttempts ||= {};
      for (const [k, v] of Object.entries(state.accountAttempts)) if (v.until <= now()) delete state.accountAttempts[k];
      if (Object.keys(state.accountAttempts).length >= 10000) return false;
      const entry = state.accountAttempts[key] ||= { count: 0, until: now() + 15 * 60000 };
      return ++entry.count <= limit;
    });
    if (!allowed) fail(429, "Too many sign-in attempts. Try again in 15 minutes.");
  }
  return async function accountRoute(req, res, path, send) {
    if (!path.startsWith("/api/auth/") && path !== "/api/account/state") return false;
    if (req.method === "POST" && !(req.headers["content-type"] || "").startsWith("application/json")) fail(415, "Send JSON.");
    if (["/api/auth/signup", "/api/auth/login"].includes(path) && req.method === "POST") {
      const input = await jsonBody(req);
      const username = typeof input.username === "string" ? input.username.trim().toLowerCase() : "";
      if (!/^[a-z0-9_]{3,24}$/.test(username)) fail(400, "Use 3–24 letters, numbers, or underscores for your username.");
      if (typeof input.password !== "string" || input.password.length < 10 || input.password.length > 128) fail(400, "Use a password with 10–128 characters.");
      const signup = path.endsWith("signup");
      const ip = process.env.VERCEL ? String(req.headers["x-vercel-forwarded-for"] || req.socket.remoteAddress) : req.socket.remoteAddress;
      await throttle(hash((signup ? "signup:" : "login:") + ip), signup ? 8 : 40);
      await throttle(hash("user:" + username), 10);
      // Provision the explicitly requested demo once; subsequent logins preserve its edits.
      if (username === "sample") {
        const snapshot = await store.read();
        const demo = Object.values(snapshot.accounts || {}).find((a) => a.username === "sample");
        if (demo?.appState?.sampleAccount && !demo.appState.weightTracking) {
          await store.mutate((state) => {
            const current = state.accounts[demo.id];
            if (!current.appState.weightTracking) { current.appState.weightTracking = sampleState(now()).weightTracking; current.revision = (current.revision || 0) + 1; }
          });
        }
        if (!Object.values(snapshot.accounts || {}).some((a) => a.username === "sample")) {
          const demoSalt = randomBytes(16).toString("hex");
          const demoHash = await derive("1234567890", demoSalt, 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 });
          await store.mutate((state) => {
            state.accounts ||= {};
            if (Object.values(state.accounts).some((a) => a.username === "sample")) return;
            const id = randomUUID();
            state.accounts[id] = { id, username: "sample", salt: demoSalt, passwordHash: demoHash.toString("hex"), createdAt: now(), revision: 0, appState: sampleState(now()) };
          });
        }
      }
      let state = await store.read();
      const existing = Object.values(state.accounts || {}).find((a) => a.username === username);
      const salt = signup ? randomBytes(16).toString("hex") : existing?.salt || "00000000000000000000000000000000";
      const derived = await derive(input.password, salt, 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 });
      if (!signup && (!existing || !timingSafeEqual(derived, Buffer.from(existing.passwordHash, "hex")))) fail(401, "Username or password is incorrect.");
      if (signup && existing) fail(409, "That username is unavailable.");
      const token = randomBytes(32).toString("base64url");
      const result = await store.mutate((state) => {
        state.accounts ||= {}; state.accountSessions ||= {};
        let account = existing ? state.accounts[existing.id] : null;
        if (signup) {
          if (Object.values(state.accounts).some((a) => a.username === username)) fail(409, "That username is unavailable.");
          account = { id: randomUUID(), username, salt, passwordHash: derived.toString("hex"), createdAt: now(), revision: 0, appState: input.importState ? validateAppState(input.importState) : null };
          state.accounts[account.id] = account;
        }
        for (const [k, session] of Object.entries(state.accountSessions)) if (session.expiresAt <= now()) delete state.accountSessions[k];
        if (!hasCreatedAt(account)) account.createdAt = now();
        // Bound active sessions for an account; logging in rotates this browser's token.
        const active = Object.entries(state.accountSessions).filter(([, s]) => s.accountId === account.id).sort((a, b) => a[1].expiresAt - b[1].expiresAt);
        for (const [k] of active.slice(0, Math.max(0, active.length - 9))) delete state.accountSessions[k];
        state.accountSessions[hash(token)] = { accountId: account.id, expiresAt: now() + LIFETIME };
        delete state.accountAttempts[hash("user:" + username)];
        return view(state, account);
      });
      res.setHeader("Set-Cookie", cookie(req, token));
      send(result, signup ? 201 : 200); return true;
    }
    if (path === "/api/auth/logout" && req.method === "POST") {
      const raw = String(req.headers.cookie || "").split(";").map((s) => s.trim()).find((s) => s.startsWith(COOKIE + "="))?.slice(COOKIE.length + 1);
      await store.mutate((state) => { if (raw && state.accountSessions) delete state.accountSessions[hash(raw)]; });
      res.setHeader("Set-Cookie", cookie(req, "", 0)); send({ ok: true }); return true;
    }
    const state = await store.read(), account = signedInAccount(state, req, now());
    if (!account) fail(401, "Log in to your Refridge account.");
    if (path === "/api/auth/me" && req.method === "GET") {
      if (!hasCreatedAt(account)) {
        const result = await store.mutate((current) => {
          const saved = current.accounts[account.id];
          if (!hasCreatedAt(saved)) saved.createdAt = now();
          return view(current, saved);
        });
        send(result);
      } else send(view(state, account));
      return true;
    }
    if (path === "/api/auth/claim-camera" && req.method === "POST") {
      const input = await jsonBody(req);
      const digest = typeof input.ownerToken === "string" ? hash(input.ownerToken) : "";
      const result = await store.mutate((state) => {
        const session = Object.values(state.sessions).find((s) => s.ownerHash === digest);
        if (!session || (session.accountId && session.accountId !== account.id)) fail(403, "This camera session cannot be imported into this account.");
        if (Object.values(state.sessions).some((s) => s.accountId === account.id && s.id !== session.id)) fail(409, "This account already has a camera session.");
        session.accountId = account.id;
        return view(state, state.accounts[account.id]);
      }); send(result); return true;
    }
    if (path === "/api/account/state" && req.method === "GET") { send({ appState: account.appState || null, revision: account.revision || 0 }); return true; }
    if (path === "/api/account/state" && req.method === "POST") {
      const input = await jsonBody(req), value = validateAppState(input.appState);
      if (input.accountId !== account.id || !Number.isInteger(input.revision)) fail(403, "Account changed. Log in again before saving.");
      const result = await store.mutate((state) => {
        const current = state.accounts[account.id];
        if (input.revision !== (current.revision || 0)) fail(409, "Your account was updated on another device. Reload to load its latest saved state; this browser keeps a local backup.");
        current.appState = value; current.revision = (current.revision || 0) + 1; current.updatedAt = now();
        return { revision: current.revision };
      }); send(result); return true;
    }
    fail(404, "Account endpoint not found.");
  };
}
