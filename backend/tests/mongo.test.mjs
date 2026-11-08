import test from "node:test";
import assert from "node:assert/strict";
import { MongoStore } from "../mongo-store.mjs";
import { fakeMongo } from "./fake-mongo.mjs";
import { setup, jpg } from "./helpers.mjs";
import { createApp } from "../server.mjs";
import { createVercelHandler, originalApiUrl } from "../../api/index.mjs";
import http from "node:http";
async function stores() {
  const fake = fakeMongo();
  const a = await new MongoStore({ client: fake.client() }).initialize();
  const b = await new MongoStore({ client: fake.client() }).initialize();
  return { a, b, fake };
}
test("fresh Mongo store instances see the same records and concurrent updates are not lost", async () => {
  const { a, b } = await stores();
  await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      (i % 2 ? a : b).mutate((s) => {
        s.count = (s.count || 0) + 1;
      }),
    ),
  );
  assert.equal((await a.read()).count, 20);
  assert.equal((await b.read()).count, 20);
});
test("failed transactions roll back photos and metadata together", async () => {
  const { a, b } = await stores();
  await assert.rejects(
    () =>
      a.mutate(async (s) => {
        s.changed = true;
        await a.images.put("image", jpg);
        throw Error("Abort");
      }),
    /Abort/,
  );
  assert.equal((await b.read()).changed, undefined);
  await assert.rejects(() => b.images.get("image"), /not found/);
  await a.mutate(async (s) => {
    await a.images.put("image", jpg);
    s.changed = true;
  });
  assert.deepEqual(await b.images.get("image"), jpg);
  await b.mutate(async (s) => {
    await b.images.remove("image");
    delete s.changed;
  });
  await assert.rejects(() => a.images.get("image"), /not found/);
});
test("Mongo-backed two-camera capture survives another app instance with private photo access", async (t) => {
  const { a, b } = await stores();
  const x = await setup(t, { store: a, images: a.images });
  const o = await x.owner(),
    c1 = await x.pair(o),
    c2 = await x.pair(o, "Second");
  await x.ready(c1);
  await x.ready(c2);
  const e = (
    await x.request("/api/capture", {
      token: o.ownerToken,
      method: "POST",
      body: {},
    })
  ).data;
  for (const c of [c1, c2])
    assert.equal(
      (
        await x.request("/api/events/" + e.id + "/image", {
          token: c.cameraToken,
          method: "POST",
          raw: true,
          body: jpg,
        })
      ).status,
      201,
    );
  const y = await setup(t, { store: b, images: b.images });
  const session = (await y.request("/api/session", { token: o.ownerToken }))
    .data;
  assert.equal(session.events[0].images.length, 2);
  const id = session.events[0].images[0].id;
  assert.deepEqual(
    (await y.request("/api/images/" + id, { token: o.ownerToken })).data,
    jpg,
  );
  assert.equal(
    (await y.request("/api/images/" + id, { token: c1.cameraToken })).status,
    401,
  );
  await y.request("/api/events/" + e.id, {
    token: o.ownerToken,
    method: "DELETE",
  });
  await assert.rejects(() => a.images.get(id), /not found/);
});
test("Vercel rewrites preserve the API path and query", () => {
  assert.equal(
    originalApiUrl("/api/index?__route=events/abc/image&x=1"),
    "/api/events/abc/image?x=1",
  );
  assert.equal(originalApiUrl("/api/health"), "/api/health");
});
test("Vercel entry serves rewrites and persists a session across cold handlers", async (t) => {
  const { a, b } = await stores();
  async function serve(store) {
    const handler = createVercelHandler({
      storageFactory: async () => store,
      background: (p) => {
        void p;
      },
    });
    const s = http.createServer(handler);
    await new Promise((r) => s.listen(0, "127.0.0.1", r));
    t.after(() => new Promise((r) => s.close(r)));
    return "http://127.0.0.1:" + s.address().port;
  }
  const url = await serve(a);
  const response = await fetch(url + "/api/index?__route=sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fridgeName: "Cloud fridge" }),
  });
  assert.equal(response.status, 201);
  const owner = await response.json();
  const second = await serve(b);
  const session = await fetch(second + "/api/index?__route=session", {
    headers: { Authorization: "Bearer " + owner.ownerToken },
  });
  assert.equal((await session.json()).fridgeName, "Cloud fridge");
});
test("missing database configuration returns a useful 503 instead of ephemeral storage", async () => {
  let status, body;
  const handler = createVercelHandler({
    storageFactory: () => {
      const e = Error("Set MONGODB_URI");
      e.status = 503;
      throw e;
    },
  });
  await handler(
    { url: "/api/health" },
    {
      headersSent: false,
      writeHead: (s) => (status = s),
      end: (b) => (body = b),
    },
  );
  assert.equal(status, 503);
  assert.match(body, /MONGODB_URI/);
});
test("serverless scheduling is attached to the provided request lifecycle", async (t) => {
  const jobs = [];
  const x = await setup(t, { background: (p) => jobs.push(p) });
  const o = await x.owner(),
    a = await x.pair(o),
    b = await x.pair(o, "Second");
  await x.ready(a);
  await x.ready(b);
  const e = (
    await x.request("/api/capture", {
      token: o.ownerToken,
      method: "POST",
      body: {},
    })
  ).data;
  await x.request("/api/events/" + e.id + "/image", {
    token: a.cameraToken,
    method: "POST",
    raw: true,
    body: jpg,
  });
  assert(jobs.length > 0);
  await Promise.all(jobs);
});

test("database leases prevent simultaneous image analysis on separate function instances and recover expired work", async () => {
  const { a, b } = await stores();
  const { createAutomation } = await import("../automation.mjs");
  const pictures = [
    { id: "one", cameraId: "one" },
    { id: "two", cameraId: "two" },
  ];
  await a.mutate((state) => {
    state.sessions.s = {
      id: "s",
      automation: { enabled: true },
      baseline: pictures,
      context: { inventory: [], containers: [], revision: 1 },
      events: [
        {
          id: "event",
          status: "pending",
          expectedCameraIds: ["one", "two"],
          images: pictures,
          createdAt: Date.now(),
        },
      ],
    };
  });
  let calls = 0,
    resolve;
  const vision = async () => {
    calls++;
    return new Promise((r) => {
      resolve = r;
    });
  };
  const make = (store) =>
    createAutomation({
      store,
      images: { get: async () => jpg },
      keyConfigured: () => true,
      vision,
    });
  const first = make(a).processEvent("s", "event");
  for (let n = 0; n < 100 && !calls; n++)
    await new Promise((r) => setImmediate(r));
  assert.equal(calls, 1);
  await make(b).processEvent("s", "event");
  assert.equal(calls, 1);
  resolve({ occluded: true, uncertain: true, summary: "Review", changes: [] });
  await first;
  assert.equal((await a.read()).sessions.s.analysisLease, undefined);
  await a.mutate((state) => {
    state.sessions.s.analysisLease = {
      token: "expired",
      until: Date.now() - 1,
    };
    state.sessions.s.events[0].analysis = { state: "processing" };
  });
  const worker = createAutomation({
    store: b,
    images: { get: async () => jpg },
    keyConfigured: () => true,
    vision: async () => {
      calls++;
      return {
        occluded: true,
        uncertain: true,
        summary: "Review",
        changes: [],
      };
    },
  });
  await worker.processEvent("s", "event");
  assert.equal(calls, 2);
  assert.equal(
    (await a.read()).sessions.s.events[0].analysis.state,
    "needs-review",
  );
});

test("function adapters may provide pre-parsed JSON without losing the request body", async () => {
  const { a } = await stores();
  const app = createApp({ store: a, images: a.images });
  let status, payload;
  await app.handler(
    {
      url: "/api/sessions",
      method: "POST",
      headers: { host: "example.com" },
      socket: { remoteAddress: "test" },
      body: { fridgeName: "Parsed cloud request" },
    },
    {
      headersSent: false,
      setHeader() {},
      writeHead: (s) => (status = s),
      end: (b) => (payload = JSON.parse(b)),
    },
  );
  assert.equal(status, 201);
  const state = await a.read();
  assert.equal(
    state.sessions[payload.sessionId].fridgeName,
    "Parsed cloud request",
  );
});

test("cloud-compatible JSON photo uploads preserve the exact JPEG bytes", async (t) => {
  const { a } = await stores();
  const x = await setup(t, { store: a, images: a.images });
  const o = await x.owner(),
    c = await x.pair(o);
  await x.ready(c);
  const e = (
    await x.request("/api/capture", {
      token: o.ownerToken,
      method: "POST",
      body: {},
    })
  ).data;
  const photo = await x.request("/api/events/" + e.id + "/image", {
    token: c.cameraToken,
    method: "POST",
    body: { jpegBase64: jpg.toString("base64") },
  });
  assert.equal(photo.status, 201);
  assert.deepEqual(await a.images.get(photo.data.id), jpg);
});
