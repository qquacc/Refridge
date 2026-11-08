import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createApp } from "../server.mjs";
export const jpg = await readFile(new URL("./fixture.jpg", import.meta.url));
export async function setup(t, options = {}) {
  const dir = await mkdtemp(path.join(tmpdir(), "fridgeful-"));
  let time = Date.now();
  const app = createApp({ dataDir: dir, now: () => time, ...options });
  const server = http.createServer(app.handler);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(async () => {
    await new Promise((r) => server.close(r));
    await app.drain();
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
