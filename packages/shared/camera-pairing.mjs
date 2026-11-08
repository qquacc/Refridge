export const cameraRoles = ["Top Camera", "Side Camera"];
export function initialCameraPairing(saved, search = "") {
  const query = new URLSearchParams(search), forcePairing = query.has("pair");
  const valid = saved && typeof saved.cameraId === "string" && saved.cameraId.length > 0 && typeof saved.cameraToken === "string" && saved.cameraToken.length >= 32 && cameraRoles.includes(saved.cameraName);
  return {
    device: !forcePairing && valid ? saved : null,
    code: (query.get("pair") || "").replace(/[\s-]/g, "").toUpperCase(),
    name: cameraRoles.includes(saved?.cameraName) ? saved.cameraName : "Top Camera",
    forcePairing,
  };
}
export async function verifyCameraPairing(device, request) {
  const result = await request("/api/camera/heartbeat", { token: device.cameraToken, method: "POST", body: { ready: false } });
  if (result.cameraId !== device.cameraId || !cameraRoles.includes(result.name)) {
    const error = Error("This saved camera needs to be paired again as Top Camera or Side Camera.");
    error.status = 401;
    throw error;
  }
  return result;
}
