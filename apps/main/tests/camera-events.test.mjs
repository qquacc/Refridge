import test from "node:test";
import assert from "node:assert/strict";
import { initialState } from "../src/data/food.mjs";
import { upgradeState } from "../src/lib/domain.mjs";
import { applyCameraEvent } from "../src/lib/camera-events.mjs";
test("two-view event adds food once even when its confirmation is retried", () => {
  const state = upgradeState(initialState());
  const event = {
    id: "event-1",
    status: "confirmed",
    images: [{ id: "left" }, { id: "right" }],
    confirmation: {
      direction: "in",
      foodName: "Avocado",
      grams: 100,
      fridgeId: "my-fridge",
      ownerId: "me",
      expires: "2027-01-01",
    },
  };
  const once = applyCameraEvent(state, event),
    twice = applyCameraEvent(once, event);
  assert.equal(once.items.length, state.items.length + 1);
  assert.equal(twice, once);
  assert.equal(once.scannerEvents[0].source, "paired-camera");
});
test("outgoing camera event deducts stock and logs intake once", () => {
  const s = upgradeState(initialState());
  const e = {
    id: "event-2",
    status: "confirmed",
    confirmation: {
      direction: "out",
      grams: 50,
      itemId: "food-0",
      action: "eaten",
    },
  };
  const n = applyCameraEvent(s, e);
  assert.equal(n.items[0].grams, 100);
  assert.equal(n.logs.length, 1);
  assert.equal(applyCameraEvent(n, e).logs.length, 1);
});
test("ignored events do not mutate inventory", () => {
  const s = upgradeState(initialState());
  const n = applyCameraEvent(s, {
    id: "e",
    status: "ignored",
    confirmation: { direction: "ignore" },
  });
  assert.equal(n.items, s.items);
  assert.equal(n.logs.length, 0);
});
test("unconfirmed events cannot change food", () => {
  assert.throws(() =>
    applyCameraEvent(upgradeState(initialState()), {
      id: "e",
      status: "pending",
    }),
  );
});
