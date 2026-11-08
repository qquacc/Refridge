import { useEffect, useRef, useState } from "react";
import {
  cameraApi,
  readSaved,
} from "../../../../packages/shared/camera-client.mjs";
const KEY = "fridgeful:camera-owner:v1";
export async function socialAction(path, body = {}) {
  const device = readSaved(KEY);
  if (!device)
    throw Error("Create a camera/server session in Paired cameras first.");
  return cameraApi("/api/social" + path, {
    token: device.ownerToken,
    method: "POST",
    body,
  });
}
export function useFriendFridges(state, setState) {
  const latest = useRef(state);
  latest.current = state;
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true,
      timer,
      last = "",
      lastView = "";
    async function cycle() {
      const s = latest.current,
        d = readSaved(KEY);
      try {
        if (d && s.socialSettings?.enabled) {
          const profile = {
            enabled: true,
            name: s.profile.name,
            avatar: s.profile.avatar,
            pointsLedger: s.pointsLedger,
          };
          const digest = JSON.stringify(profile);
          if (digest !== last) {
            await socialAction("/profile", profile);
            last = digest;
          }
          const view = await cameraApi("/api/social", { token: d.ownerToken });
          if (active && JSON.stringify(view) !== lastView) {
            lastView = JSON.stringify(view);
            setState((current) => {
              const fridges = view.friends.map((f) => ({
                id: "remote-" + f.id,
                remoteSessionId: f.id,
                name: f.fridgeName,
                ownerId: "friend-" + f.id,
                members: ["friend-" + f.id],
                kind: "Fridge",
                shared:
                  current.fridges.find((old) => old.id === "remote-" + f.id)
                    ?.shared ?? true,
                remote: true,
              }));
              const items = view.friends.flatMap((f) =>
                f.inventory.map((i) => ({
                  ...i,
                  id: "remote-" + f.id + "-" + i.id,
                  remoteItemId: i.id,
                  remoteSessionId: f.id,
                  ownerId: "friend-" + f.id,
                  fridgeId: "remote-" + f.id,
                  remote: true,
                })),
              );
              const members = view.friends.map((f) => ({
                id: "friend-" + f.id,
                name: f.name,
                avatar: f.avatar,
                demo: false,
                remote: true,
              }));
              return {
                ...current,
                fridges: [
                  ...current.fridges.filter((f) => !f.remote),
                  ...fridges,
                ],
                friendItems: [
                  ...current.friendItems.filter((i) => !i.remote),
                  ...items,
                ],
                members: [
                  ...current.members.filter((m) => !m.remote),
                  ...members,
                ],
                remotePointsLedger: view.friends.flatMap((f) =>
                  f.pointsLedger.map((p) => ({
                    ...p,
                    userId: "friend-" + f.id,
                  })),
                ),
                remoteTrades: view.trades,
                ownSessionId: d.sessionId || d.id,
                activeFridgeId:
                  current.fridges.some(
                    (f) => f.id === current.activeFridgeId && !f.remote,
                  ) || fridges.some((f) => f.id === current.activeFridgeId)
                    ? current.activeFridgeId
                    : "my-fridge",
              };
            });
          }
        }
        if (active) setError("");
      } catch (e) {
        if (active) setError(e.message);
      } finally {
        if (active) timer = setTimeout(cycle, 5000);
      }
    }
    cycle();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);
  return error;
}
