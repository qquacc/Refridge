import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createApp } from "../server.mjs";
const jpg = await readFile(new URL("./fixture.jpg", import.meta.url));
async function setup(t, options = {}) {
  const dir = await mkdtemp(path.join(tmpdir(), "fridgeful-"));
  let time = Date.now();
  const app = createApp({ dataDir: dir, now: () => time, ...options });
  const server = http.createServer(app.handler);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(async () => {
    await new Promise((r) => server.close(r));
    await rm(dir, { recursive: true, force: true });
  });
  const base = "http://127.0.0.1:" + server.address().port;
  async function request(
    p,
    { token, body, method = "GET", raw = false, headers = {} } = {},
  ) {
    const response = await fetch(base + p, {
      method,
      headers: {
        ...(token ? { Authorization: "Bearer " + token } : {}),
        ...(body
          ? { "Content-Type": raw ? "image/jpeg" : "application/json" }
          : {}),
        ...headers,
      },
      body: body ? (raw ? body : JSON.stringify(body)) : undefined,
    });
    const content = response.headers.get("content-type") || "";
    return {
      status: response.status,
      data: content.includes("json")
        ? await response.json()
        : Buffer.from(await response.arrayBuffer()),
    };
  }
  async function owner() {
    return (
      await request("/api/sessions", {
        method: "POST",
        body: { fridgeId: "my-fridge", fridgeName: "Test fridge" },
      })
    ).data;
  }
  async function pair(owner, name = "Top Camera") {
    const code = (
      await request("/api/pairing", { token: owner.ownerToken, method: "POST" })
    ).data;
    const camera = await request("/api/pair", {
      method: "POST",
      body: { code: code.code, name },
    });
    return { ...camera.data, code: code.code };
  }
  async function ready(camera) {
    return request("/api/camera/heartbeat", {
      token: camera.cameraToken,
      method: "POST",
      body: { ready: true },
    });
  }
  return {
    request,
    base,
    owner,
    pair,
    ready,
    dir,
    setTime: (n) => (time = n),
    getTime: () => time,
    app,
  };
}
test("owner and camera tokens are separated and not stored in plaintext", async (t) => {
  const x = await setup(t);
  const o = await x.owner(),
    c = await x.pair(o);
  assert.equal((await x.request("/api/session")).status, 401);
  assert.equal(
    (await x.request("/api/session", { token: c.cameraToken })).status,
    401,
  );
  assert.equal(
    (
      await x.request("/api/camera/heartbeat", {
        method: "POST",
        token: o.ownerToken,
      })
    ).status,
    401,
  );
  const stored = await readFile(path.join(x.dir, "sessions.json"), "utf8");
  assert.ok(!stored.includes(o.ownerToken));
  assert.ok(!stored.includes(c.cameraToken));
});
test("pairing codes expire and cannot be reused", async (t) => {
  const x = await setup(t),
    o = await x.owner(),
    c = await x.pair(o);
  assert.equal(
    (await x.request("/api/pair", { method: "POST", body: { code: c.code } }))
      .status,
    400,
  );
  const p = (
    await x.request("/api/pairing", { method: "POST", token: o.ownerToken })
  ).data;
  x.setTime(x.getTime() + 121000);
  assert.equal(
    (await x.request("/api/pair", { method: "POST", body: { code: p.code } }))
      .status,
    400,
  );
});
test("two-camera limit and readiness are enforced", async (t) => {
  const x = await setup(t),
    o = await x.owner(),
    a = await x.pair(o),
    b = await x.pair(o, "Side Camera");
  assert.equal(
    (await x.request("/api/pairing", { method: "POST", token: o.ownerToken }))
      .status,
    409,
  );
  assert.equal(
    (
      await x.request("/api/capture", {
        method: "POST",
        token: o.ownerToken,
        body: {},
      })
    ).status,
    409,
  );
  await x.ready(a);
  await x.ready(b);
  const e = await x.request("/api/capture", {
    method: "POST",
    token: o.ownerToken,
    body: {},
  });
  assert.equal(e.data.expectedCameraIds.length, 2);
});
test("two uploads group into one event, fetch is private, and duplicate upload is idempotent", async (t) => {
  const x = await setup(t),
    o = await x.owner(),
    a = await x.pair(o),
    b = await x.pair(o, "Side Camera");
  await x.ready(a);
  await x.ready(b);
  const e = (
    await x.request("/api/capture", {
      method: "POST",
      token: o.ownerToken,
      body: {},
    })
  ).data;
  for (const c of [a, b])
    assert.equal(
      (
        await x.request("/api/events/" + e.id + "/image", {
          method: "POST",
          token: c.cameraToken,
          body: jpg,
          raw: true,
        })
      ).status,
      201,
    );
  const retry = await x.request("/api/events/" + e.id + "/image", {
    method: "POST",
    token: a.cameraToken,
    body: jpg,
    raw: true,
  });
  assert.equal(retry.status, 200);
  const s = (await x.request("/api/session", { token: o.ownerToken })).data;
  assert.equal(s.events.length, 1);
  assert.equal(s.events[0].images.length, 2);
  const imageId = s.events[0].images[0].id;
  assert.equal(
    (await x.request("/api/images/" + imageId, { token: a.cameraToken }))
      .status,
    401,
  );
  const privatePhoto = await x.request("/api/images/" + imageId, {
    token: o.ownerToken,
  });
  assert.equal(privatePhoto.status, 200);
  assert.deepEqual(privatePhoto.data, jpg);
});
test("camera cannot write to another session; other owners cannot read its photos", async (t) => {
  const x = await setup(t),
    o = await x.owner(),
    a = await x.pair(o),
    o2 = await x.owner(),
    b = await x.pair(o2);
  await x.ready(a);
  const e = (
    await x.request("/api/capture", {
      method: "POST",
      token: o.ownerToken,
      body: {},
    })
  ).data;
  assert.equal(
    (
      await x.request("/api/events/" + e.id + "/image", {
        method: "POST",
        token: b.cameraToken,
        body: jpg,
        raw: true,
      })
    ).status,
    404,
  );
  const image = (
    await x.request("/api/events/" + e.id + "/image", {
      method: "POST",
      token: a.cameraToken,
      body: jpg,
      raw: true,
    })
  ).data;
  assert.equal(
    (await x.request("/api/images/" + image.id, { token: o2.ownerToken }))
      .status,
    404,
  );
});
test("confirmation is retryable but cannot be changed or confirmed without images", async (t) => {
  const x = await setup(t),
    o = await x.owner(),
    a = await x.pair(o);
  await x.ready(a);
  const e = (
    await x.request("/api/capture", {
      method: "POST",
      token: o.ownerToken,
      body: {},
    })
  ).data;
  const details = {
    direction: "in",
    foodName: "Avocado",
    grams: 100,
    fridgeId: "my-fridge",
    ownerId: "me",
    expires: "2027-01-01",
  };
  assert.equal(
    (
      await x.request("/api/events/" + e.id + "/confirm", {
        method: "POST",
        token: o.ownerToken,
        body: details,
      })
    ).status,
    409,
  );
  await x.request("/api/events/" + e.id + "/image", {
    method: "POST",
    token: a.cameraToken,
    body: jpg,
    raw: true,
  });
  for (let i = 0; i < 2; i++)
    assert.equal(
      (
        await x.request("/api/events/" + e.id + "/confirm", {
          method: "POST",
          token: o.ownerToken,
          body: details,
        })
      ).status,
      200,
    );
  assert.equal(
    (
      await x.request("/api/events/" + e.id + "/confirm", {
        method: "POST",
        token: o.ownerToken,
        body: { ...details, grams: 200 },
      })
    ).status,
    409,
  );
});
test("motion from both cameras within grouping window produces one event", async (t) => {
  const x = await setup(t),
    o = await x.owner(),
    a = await x.pair(o),
    b = await x.pair(o, "Side Camera");
  await x.ready(a);
  await x.ready(b);
  const first = (
    await x.request("/api/camera/event", {
      method: "POST",
      token: a.cameraToken,
      body: { trigger: "motion" },
    })
  ).data;
  const second = (
    await x.request("/api/camera/event", {
      method: "POST",
      token: b.cameraToken,
      body: { trigger: "motion" },
    })
  ).data;
  assert.equal(first.id, second.id);
});
test("unpair revokes upload and heartbeat authorization immediately", async (t) => {
  const x = await setup(t),
    o = await x.owner(),
    c = await x.pair(o);
  assert.equal(
    (
      await x.request("/api/cameras/" + c.cameraId, {
        method: "DELETE",
        token: o.ownerToken,
      })
    ).status,
    200,
  );
  assert.equal((await x.ready(c)).status, 401);
});
test("invalid and oversized images are rejected", async (t) => {
  const x = await setup(t),
    o = await x.owner(),
    c = await x.pair(o);
  await x.ready(c);
  const e = (
    await x.request("/api/capture", {
      method: "POST",
      token: o.ownerToken,
      body: {},
    })
  ).data;
  assert.equal(
    (
      await x.request("/api/events/" + e.id + "/image", {
        method: "POST",
        token: c.cameraToken,
        body: Buffer.from("not a jpeg"),
        raw: true,
      })
    ).status,
    415,
  );
  assert.equal(
    (
      await x.request("/api/events/" + e.id + "/image", {
        method: "POST",
        token: c.cameraToken,
        body: Buffer.alloc(1024 * 1024 + 1),
        raw: true,
      })
    ).status,
    413,
  );
});
test("delete event removes photo bytes and leaves no downloadable image", async (t) => {
  const x = await setup(t),
    o = await x.owner(),
    c = await x.pair(o);
  await x.ready(c);
  const e = (
    await x.request("/api/capture", {
      method: "POST",
      token: o.ownerToken,
      body: {},
    })
  ).data;
  const i = (
    await x.request("/api/events/" + e.id + "/image", {
      method: "POST",
      token: c.cameraToken,
      body: jpg,
      raw: true,
    })
  ).data;
  await x.request("/api/events/" + e.id, {
    method: "DELETE",
    token: o.ownerToken,
  });
  assert.equal(
    (await x.request("/api/images/" + i.id, { token: o.ownerToken })).status,
    404,
  );
  await assert.rejects(readFile(path.join(x.dir, "images", i.id + ".jpg")));
});
test("stored sessions survive a fresh store instance", async (t) => {
  const x = await setup(t),
    o = await x.owner();
  const restarted = createApp({ dataDir: x.dir });
  const data = await restarted.store.read();
  assert.ok(data.sessions[o.sessionId]);
});
test("unlisted cross-origin requests are denied", async (t) => {
  const x = await setup(t);
  assert.equal(
    (
      await x.request("/api/health", {
        headers: { Origin: "https://unrelated.example" },
      })
    ).status,
    403,
  );
});

test("concurrent retries from one camera keep one immutable image record", async (t) => {
  const x = await setup(t),
    o = await x.owner(),
    c = await x.pair(o);
  await x.ready(c);
  const e = (
    await x.request("/api/capture", {
      method: "POST",
      token: o.ownerToken,
      body: {},
    })
  ).data;
  const uploads = await Promise.all(
    [jpg, Buffer.concat([jpg, Buffer.from("retry")])].map((body) =>
      x.request("/api/events/" + e.id + "/image", {
        method: "POST",
        token: c.cameraToken,
        body,
        raw: true,
      }),
    ),
  );
  assert.ok(uploads.every((r) => r.status === 201 || r.status === 200));
  assert.equal(uploads[0].data.bytes, uploads[1].data.bytes);
  const session = (await x.request("/api/session", { token: o.ownerToken }))
    .data;
  assert.equal(session.events[0].images.length, 1);
  const photo = await x.request("/api/images/" + uploads[0].data.id, {
    token: o.ownerToken,
  });
  assert.equal(photo.data.length, uploads[0].data.bytes);
});
test("a newly ready second camera joins the existing motion event", async (t) => {
  const x = await setup(t),
    o = await x.owner(),
    a = await x.pair(o),
    b = await x.pair(o, "Side Camera");
  await x.ready(a);
  const first = (
    await x.request("/api/camera/event", {
      method: "POST",
      token: a.cameraToken,
      body: { trigger: "motion" },
    })
  ).data;
  assert.equal(first.expectedCameraIds.length, 1);
  await x.ready(b);
  const second = (
    await x.request("/api/camera/event", {
      method: "POST",
      token: b.cameraToken,
      body: { trigger: "motion" },
    })
  ).data;
  assert.equal(first.id, second.id);
  assert.equal(second.expectedCameraIds.length, 2);
});

test("127.0.0.1 frontend can create a camera session with default development origins", async (t) => {
  const x = await setup(t);
  const result = await x.request("/api/sessions", {
    method: "POST",
    body: { fridgeId: "my-fridge" },
    headers: { Origin: "http://127.0.0.1:5173" },
  });
  assert.equal(result.status, 201);
  assert.ok(result.data.ownerToken);
});
test("exact configured frontend origins accept whitespace and trailing slash", async (t) => {
  const x = await setup(t, {
    allowedOrigins: [" https://my-fridge.example/ , https://camera.example/ "],
  });
  const result = await x.request("/api/sessions", {
    method: "POST",
    body: {},
    headers: { Origin: "https://my-fridge.example" },
  });
  assert.equal(result.status, 201);
});
test("LAN frontend works through a proxy that preserves its Host", async (t) => {
  const x = await setup(t);
  // Use Node's HTTP client: Fetch normalizes Host to its target URL.
  const result = await new Promise((resolve, reject) => {
    const req = http.request(
      new URL("/api/sessions", x.base),
      {
        method: "POST",
        headers: {
          Host: "192.168.1.25:5173",
          Origin: "http://192.168.1.25:5173",
          "Content-Type": "application/json",
        },
      },
      (res) => {
        res.resume();
        res.on("end", () => resolve(res.statusCode));
      },
    );
    req.on("error", reject);
    req.end("{}");
  });
  assert.equal(result, 201);
});
test("an untrusted forwarded host cannot authorize a foreign origin", async (t) => {
  const x = await setup(t);
  const r = await x.request("/api/health", {
    headers: {
      Origin: "https://my-fridge.example",
      "X-Forwarded-Host": "my-fridge.example",
      "X-Forwarded-Proto": "https",
    },
  });
  assert.equal(r.status, 403);
  assert.match(r.data.error, /ALLOWED_ORIGINS/);
});
test("an explicitly trusted reverse proxy may supply the public host", async (t) => {
  const x = await setup(t, { trustProxy: true });
  const result = await x.request("/api/sessions", {
    method: "POST",
    body: {},
    headers: {
      Origin: "https://my-fridge.example",
      "X-Forwarded-Host": "my-fridge.example",
      "X-Forwarded-Proto": "https",
    },
  });
  assert.equal(result.status, 201);
});
test("allowlisted domain does not authorize lookalike domains or other ports", async (t) => {
  const x = await setup(t, { allowedOrigins: ["https://my-fridge.example"] });
  for (const origin of [
    "https://my-fridge.example.attacker.test",
    "https://my-fridge.example:8443",
    "null",
  ])
    assert.equal(
      (await x.request("/api/health", { headers: { Origin: origin } })).status,
      403,
    );
});

test("pairing requires a unique Top Camera or Side Camera and keeps the code usable after rejection", async (t) => {
  const x = await setup(t), o = await x.owner();
  await x.pair(o, "Top Camera");
  const { data: pairing } = await x.request("/api/pairing", { token: o.ownerToken, method: "POST" });
  for (const [name, status] of [["Other", 400], ["Top Camera", 409]]) {
    assert.equal((await x.request("/api/pair", { method: "POST", body: { code: pairing.code, name } })).status, status);
  }
  const paired = await x.request("/api/pair", { method: "POST", body: { code: pairing.code, name: "Side Camera" } });
  assert.equal(paired.status, 201);
  assert.equal(paired.data.cameraName, "Side Camera");
});
