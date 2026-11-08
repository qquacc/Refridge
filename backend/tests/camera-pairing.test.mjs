import test from "node:test";
import assert from "node:assert/strict";
import { initialCameraPairing, verifyCameraPairing } from "../../packages/shared/camera-pairing.mjs";
const saved = { cameraId: "camera-1", cameraToken: "camera-token-".repeat(4), cameraName: "Side Camera", fridgeName: "Kitchen" };
test("camera code entry starts without a device and QR links override saved pairings", () => {
  assert.equal(initialCameraPairing(null).device, null);
  assert.equal(initialCameraPairing(saved).device, saved);
  const qr = initialCameraPairing(saved, "?pair=abc234");
  assert.equal(qr.device, null); assert.equal(qr.code, "ABC234"); assert.equal(qr.forcePairing, true);
  assert.equal(initialCameraPairing(saved, "?pair=").device, null);
});
test("malformed and old generic-role camera records cannot hide the pairing form", () => {
  for (const record of [{}, { ...saved, cameraToken: "short" }, { ...saved, cameraId: "" }, { ...saved, cameraName: "Camera 1" }])
    assert.equal(initialCameraPairing(record).device, null);
});
test("saved camera validation uses camera authorization and does not falsely mark the camera online", async () => {
  const result = await verifyCameraPairing(saved, async (path, args) => {
    assert.equal(path, "/api/camera/heartbeat"); assert.equal(args.token, saved.cameraToken);
    assert.deepEqual(args.body, { ready: false });
    return { cameraId: saved.cameraId, name: "Side Camera" };
  });
  assert.equal(result.name, "Side Camera");
  await assert.rejects(() => verifyCameraPairing(saved, async () => ({ cameraId: "different", name: "Side Camera" })), { status: 401 });
  await assert.rejects(() => verifyCameraPairing(saved, async () => { const e = Error("Revoked"); e.status = 401; throw e; }), { status: 401 });
});
