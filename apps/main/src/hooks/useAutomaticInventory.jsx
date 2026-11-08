import { useEffect, useRef, useState } from "react";
import {
  cameraApi,
  readSaved,
} from "../../../../packages/shared/camera-client.mjs";
import { applyCameraEvent } from "../lib/camera-events.mjs";
export function useAutomaticInventory(state, setState) {
  const latest = useRef(state);
  latest.current = state;
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true,
      timer,
      lastDigest = "";
    async function cycle() {
      const device = readSaved("fridgeful:camera-owner:v1");
      if (device)
        try {
          const session = await cameraApi("/api/session", {
            token: device.ownerToken,
          });
          let next = latest.current;
          for (const event of [...session.events].reverse())
            if (
              event.confirmation?.direction === "automation" &&
              !next.appliedCameraEventIds?.includes(event.id)
            )
              next = applyCameraEvent(next, event);
          if (next !== latest.current && active) {
            latest.current = next;
            setState(next);
          }
          const context = {
            inventory: [...next.items, ...next.friendItems].filter(
              (i) => i.fridgeId === session.fridgeId,
            ),
            containers: next.containers.filter(
              (c) => c.fridgeId === session.fridgeId,
            ),
            appliedEventIds: next.appliedCameraEventIds || [],
            defaultOwnerId:
              next.fridges.find((f) => f.id === session.fridgeId)?.ownerId ||
              "me",
          };
          const digest = device.sessionId + JSON.stringify(context);
          if (digest !== lastDigest) {
            await cameraApi("/api/context", {
              token: device.ownerToken,
              method: "POST",
              body: context,
            });
            lastDigest = digest;
          }
          if (active) setError("");
        } catch (e) {
          if (active) setError(e.message);
        } finally {
          if (active) timer = setTimeout(cycle, 3000);
        }
      else if (active) timer = setTimeout(cycle, 3000);
    }
    cycle();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);
  return error;
}
