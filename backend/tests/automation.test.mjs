import test from "node:test";
import assert from "node:assert/strict";
import { setup, jpg } from "./helpers.mjs";
import { canadianCatalog } from "../../packages/shared/data/cnf-catalog.mjs";
import { analyzeWithVision } from "../vision.mjs";
import { loadNutrition, canadianFood, searchNutrition } from "../nutrition.mjs";
const spinach = canadianCatalog[0];
const rolePhotos = [
  { cameraId: "top", cameraName: "Top Camera", bytes: jpg },
  { cameraId: "side", cameraName: "Side Camera", bytes: jpg },
];
const context = {
  inventory: [
    { ...spinach, id: "lot", fridgeId: "my-fridge", ownerId: "me", grams: 150 },
  ],
  containers: [],
  defaultOwnerId: "me",
  appliedEventIds: [],
};
const analysis = {
  occluded: false,
  uncertain: false,
  summary: "Spinach removed",
  changes: [
    {
      foodId: spinach.cnfId,
      inventoryItemId: "lot",
      direction: "out",
      containerId: null,
      fillPercent: null,
      grams: null,
      massMethod: "unknown",
      wholeItem: true,
      confidence: 0.99,
      directionConfidence: 0.99,
      expires: null,
      notes: "",
    },
  ],
};
async function waitFor(x, o, predicate) {
  for (let n = 0; n < 100; n++) {
    const s = (await x.request("/api/session", { token: o.ownerToken })).data;
    if (predicate(s)) return s;
    await new Promise((r) => setTimeout(r, 15));
  }
  throw Error("Timed out waiting for automation");
}
async function enabled(t, vision = async () => analysis) {
  const x = await setup(t, {
    visionAnalyzer: vision,
    visionKeyConfigured: () => true,
  });
  const o = await x.owner(),
    a = await x.pair(o),
    b = await x.pair(o, "Side Camera");
  await x.ready(a);
  await x.ready(b);
  await x.request("/api/context", {
    token: o.ownerToken,
    method: "POST",
    body: context,
  });
  assert.equal(
    (
      await x.request("/api/automation", {
        token: o.ownerToken,
        method: "POST",
        body: { enabled: true, consent: true },
      })
    ).status,
    200,
  );
  return { x, o, a, b };
}
async function capture(x, o, cameras) {
  const e = (
    await x.request("/api/capture", {
      token: o.ownerToken,
      method: "POST",
      body: {},
    })
  ).data;
  for (const c of cameras)
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
  return e;
}
test("automatic analysis requires a server key and explicit consent", async (t) => {
  const x = await setup(t, { visionKeyConfigured: () => false }),
    o = await x.owner();
  assert.equal(
    (
      await x.request("/api/automation", {
        token: o.ownerToken,
        method: "POST",
        body: { enabled: true, consent: true },
      })
    ).status,
    409,
  );
  const y = await setup(t, { visionKeyConfigured: () => true }),
    p = await y.owner();
  assert.equal(
    (
      await y.request("/api/automation", {
        token: p.ownerToken,
        method: "POST",
        body: { enabled: true },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await y.request("/api/context", {
        token: o.ownerToken,
        method: "POST",
        body: context,
      })
    ).status,
    401,
  );
});
test("two views form a baseline then one automatic removal, with acknowledgement protecting stock sync", async (t) => {
  let calls = 0;
  const { x, o, a, b } = await enabled(t, async () => {
    calls++;
    return analysis;
  });
  const baseline = await capture(x, o, [a, b]);
  await waitFor(
    x,
    o,
    (s) => s.events.find((e) => e.id === baseline.id)?.status === "baseline",
  );
  assert.equal(calls, 0);
  const e = await capture(x, o, [a, b]);
  let s = await waitFor(
    x,
    o,
    (s) => s.events.find((v) => v.id === e.id)?.status === "confirmed",
  );
  assert.equal(calls, 1);
  assert.equal(s.context.inventory[0].grams, 0);
  assert.equal(
    s.events.find((v) => v.id === e.id).confirmation.estimatedConsumption,
    false,
  );
  assert.equal(
    (
      await x.request("/api/context", {
        token: o.ownerToken,
        method: "POST",
        body: context,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await x.request("/api/context", {
        token: o.ownerToken,
        method: "POST",
        body: {
          ...context,
          inventory: s.context.inventory,
          appliedEventIds: [e.id],
        },
      })
    ).status,
    200,
  );
  await x.request("/api/events/" + e.id + "/analyze", {
    token: o.ownerToken,
    method: "POST",
  });
  assert.equal(calls, 1);
});
test("uncertain vision output stays in review with no inventory change and no automatic rebilling", async (t) => {
  let calls = 0;
  const { x, o, a, b } = await enabled(t, async () => {
    calls++;
    return { ...analysis, uncertain: true };
  });
  await capture(x, o, [a, b]);
  await waitFor(x, o, (s) => s.events[0].status === "baseline");
  const e = await capture(x, o, [a, b]);
  const s = await waitFor(
    x,
    o,
    (s) =>
      s.events.find((v) => v.id === e.id)?.analysis?.state === "needs-review",
  );
  assert.equal(s.context.inventory[0].grams, 150);
  assert.equal(s.events[0].status, "pending");
  await x.request("/api/session", { token: o.ownerToken });
  assert.equal(calls, 1);
});
test("Gemini request uses inline images, JSON schema, container photos, and server-side authentication", async () => {
  let request;
  const result = await analyzeWithVision(
    {
      before: rolePhotos,
      after: rolePhotos,
      context: {
        ...context,
        containers: [
          {
            id: "box",
            name: "Box",
            photo: "data:image/jpeg;base64," + jpg.toString("base64"),
          },
        ],
      },
    },
    {
      apiKey: "test-secret",
      fetchImpl: async (url, args) => {
        request = { url, ...JSON.parse(args.body) };
        assert.equal(args.headers["x-goog-api-key"], "test-secret");
        return {
          ok: true,
          json: async () => ({
            candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(analysis) }] } }],
          }),
        };
      },
    },
  );
  assert.equal(result.changes[0].foodId, spinach.cnfId);
  assert.equal(request.url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent");
  assert.equal(request.generationConfig.responseMimeType, "application/json");
  assert.equal(request.generationConfig.responseJsonSchema.properties.changes.type, "array");
  assert.equal(
    request.contents[0].parts.filter((c) => c.inlineData).length,
    5,
  );
  assert(request.contents[0].parts.some((p) => p.text?.includes("Top Camera (top): FOOD IDENTITY ONLY")));
  assert(request.contents[0].parts.some((p) => p.text?.includes("Side Camera (side): VOLUME/AMOUNT ONLY")));
  assert(!JSON.stringify(request).includes("test-secret"));
});
test("vision provider failure does not create fabricated nutrition", async () => {
  await assert.rejects(
    () =>
      analyzeWithVision(
        { before: rolePhotos, after: rolePhotos, context },
        { apiKey: "key", fetchImpl: async () => ({ ok: false, status: 429 }) },
      ),
    /429/,
  );
  await assert.rejects(
    () =>
      analyzeWithVision(
        { before: rolePhotos, after: rolePhotos, context },
        {
          apiKey: "key",
          fetchImpl: async () => ({
            ok: true,
            json: async () => ({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: "not json" }] } }] }),
          }),
        },
      ),
    /incomplete/,
  );
});
test("blocked or truncated Gemini output is held for manual review", async () => {
  for (const finishReason of ["SAFETY", "MAX_TOKENS", undefined]) {
    await assert.rejects(() => analyzeWithVision(
      { before: rolePhotos, after: rolePhotos, context },
      { apiKey: "key", fetchImpl: async () => ({
        ok: true,
        json: async () => ({ candidates: [{ finishReason, content: { parts: [{ text: JSON.stringify(analysis) }] } }] }),
      }) },
    ), /incomplete or blocked/);
  }
});
test("the imported Health Canada dataset contains full foods and resolves official food IDs", async () => {
  const all = await loadNutrition();
  assert.equal(all.length, 5690);
  assert.equal(canadianFood("2213").kcal, 23);
  assert(
    (await searchNutrition("spinach raw")).some((f) => f.cnfId === "2213"),
  );
  assert.equal(canadianFood("made-up"), null);
});

test("automatic tracking holds a single-angle event for review instead of analysing an incomplete two-phone setup", async (t) => {
  let calls = 0;
  const { x, o, a, b } = await enabled(t, async () => {
    calls++;
    return analysis;
  });
  await x.request("/api/camera/heartbeat", {
    token: b.cameraToken,
    method: "POST",
    body: { ready: false },
  });
  const e = await capture(x, o, [a]);
  const s = await waitFor(
    x,
    o,
    (s) =>
      s.events.find((v) => v.id === e.id)?.analysis?.state === "needs-review",
  );
  assert.equal(calls, 0);
  assert.equal(s.context.inventory[0].grams, 150);
  assert.match(s.events[0].analysis.summary, /both cameras/);
});

test("a delayed old capture cannot reverse inventory after a newer reference scene", async (t) => {
  let calls = 0;
  const { x, o, a, b } = await enabled(t, async () => {
    calls++;
    return analysis;
  });
  const old = (
    await x.request("/api/capture", {
      token: o.ownerToken,
      method: "POST",
      body: {},
    })
  ).data;
  await x.request("/api/events/" + old.id + "/image", {
    token: a.cameraToken,
    method: "POST",
    raw: true,
    body: jpg,
  });
  x.setTime(x.getTime() + 1000);
  const next = await capture(x, o, [a, b]);
  await waitFor(
    x,
    o,
    (s) => s.events.find((e) => e.id === next.id)?.status === "baseline",
  );
  await x.request("/api/events/" + old.id + "/image", {
    token: b.cameraToken,
    method: "POST",
    raw: true,
    body: jpg,
  });
  const s = await waitFor(
    x,
    o,
    (s) =>
      s.events.find((e) => e.id === old.id)?.analysis?.state === "needs-review",
  );
  assert.equal(calls, 0);
  assert.equal(s.context.inventory[0].grams, 150);
  assert.match(s.events.find((e) => e.id === old.id).analysis.summary, /older/);
});

test("vision rejects missing or generic camera roles before contacting Gemini", async () => {
  let calls = 0;
  await assert.rejects(() => analyzeWithVision(
    { before: rolePhotos, after: [{ ...rolePhotos[0], cameraName: "Camera 1" }, rolePhotos[1]], context },
    { apiKey: "key", fetchImpl: async () => { calls++; } },
  ), /Top Camera and one Side Camera/);
  assert.equal(calls, 0);
});

test("Gemini 404 logs diagnostic codes without leaking keys or provider bodies", async (t) => {
  const logs = [];
  t.mock.method(console, "error", (...args) => logs.push(args));
  await assert.rejects(() => analyzeWithVision(
    { before: rolePhotos, after: rolePhotos, context },
    { apiKey: "private-test-key", model: "missing-model", fetchImpl: async () => ({
      ok: false, status: 404,
      json: async () => ({ error: {
        status: "NOT_FOUND", message: "private-test-key and private image contents",
        details: [{ reason: "MODEL_NOT_FOUND" }],
      } }),
    }) },
  ), /missing-model.*unavailable.*Vercel/);
  assert.equal(logs.length, 1);
  assert.equal(logs[0][1].providerStatus, "NOT_FOUND");
  assert.deepEqual(logs[0][1].reasons, ["MODEL_NOT_FOUND"]);
  assert(!JSON.stringify(logs).includes("private-test-key"));
  assert(!JSON.stringify(logs).includes("private image contents"));
});

test("Gemini timeout gives a retryable review message and uses the longer request budget", async (t) => {
  t.mock.method(console, "error", () => {});
  let timeoutMs;
  t.mock.method(AbortSignal, "timeout", (ms) => { timeoutMs = ms; return new AbortController().signal; });
  await assert.rejects(() => analyzeWithVision(
    { before: rolePhotos, after: rolePhotos, context },
    { apiKey: "key", fetchImpl: async () => { throw new DOMException("Timeout", "TimeoutError"); } },
  ), /within 4 minutes.*inventory was not changed.*Retry/);
  assert.equal(timeoutMs, 240000);
});

test("fast analysis uses compact food context and low thinking without dropping camera views", async () => {
  let body;
  await analyzeWithVision(
    { before: rolePhotos, after: rolePhotos, context },
    { apiKey: "key", model: "gemini-3.8-flash", fetchImpl: async (_url, args) => {
      body = JSON.parse(args.body);
      return { ok: true, json: async () => ({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(analysis) }] } }] }) };
    } },
  );
  assert.deepEqual(body.generationConfig.thinkingConfig, { thinkingLevel: "LOW" });
  assert.equal(body.generationConfig.maxOutputTokens, 4096);
  const prompt = JSON.parse(body.contents[0].parts[0].text);
  assert.deepEqual(prompt.catalogColumns, ["foodId", "name"]);
  assert(prompt.catalog.every((row) => row.length === 2));
  assert(body.contents[0].parts[0].text.length < 8000);
  assert.equal(body.contents[0].parts.filter((p) => p.inlineData).length, 4);
});
