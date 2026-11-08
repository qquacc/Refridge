import { applyInventoryOperations } from "../../../../packages/shared/auto-inventory.mjs";
import { nutrition, today } from "../data/food.mjs";
import { catalog, uid } from "../data/food.mjs";
import { putFood, logRemoval } from "./domain.mjs";
export function applyCameraEvent(state, event) {
  if (event.status !== "confirmed" && event.status !== "ignored")
    throw Error("Confirm this event on the server first.");
  if ((state.appliedCameraEventIds || []).includes(event.id)) return state;
  const input = event.confirmation;
  if (!input) throw Error("This event has no confirmed details.");
  let next = state;
  if (input.direction === "automation") {
    const all = applyInventoryOperations(
      [...state.items, ...state.friendItems],
      input.operations || [],
    );
    const extraLogs = input.estimatedConsumption
      ? (input.operations || [])
          .filter((o) => o.direction === "out" && o.food?.ownerId === "me")
          .map((o) => ({
            id: "auto-meal-" + event.id + "-" + o.itemId,
            date: event.createdAt
              ? new Date(event.createdAt).toLocaleDateString("en-CA")
              : today(),
            userId: "me",
            name: o.foodName,
            grams: o.grams,
            source: "camera-removal-estimate",
            estimated: true,
            nutrients: nutrition(o.food, o.grams),
          }))
      : [];
    next = {
      ...state,
      items: all.filter((i) => i.fridgeId === "my-fridge"),
      friendItems: all.filter((i) => i.fridgeId !== "my-fridge"),
      logs: [...state.logs, ...extraLogs],
    };
  } else if (input.direction === "in") {
    const food = catalog.find((c) => c.name === input.foodName);
    if (!food) throw Error("Choose a food from the catalog.");
    next = putFood(state, {
      ...food,
      grams: input.grams,
      expires: input.expires,
      fridgeId: input.fridgeId,
      ownerId: input.ownerId,
      containerId: input.containerId || "",
      cameraEventId: event.id,
    });
  } else if (input.direction === "out")
    next = logRemoval(state, input.itemId, input.grams, input.action);
  return {
    ...next,
    appliedCameraEventIds: [...(next.appliedCameraEventIds || []), event.id],
    scannerEvents: [
      {
        id: uid(),
        remoteEventId: event.id,
        date: new Date().toISOString(),
        source: "paired-camera",
        status: "confirmed",
        ...input,
      },
      ...next.scannerEvents,
    ],
  };
}
