import test from "node:test";
import assert from "node:assert/strict";
import { initialState, today, daysFromNow } from "../src/data/food.mjs";
import {
  upgradeState,
  containerVolume,
  portionFromContainer,
  recipeMissing,
  makePersonalMeal,
  requestTrade,
  resolveTrade,
  allInventory,
  logRemoval,
  streak,
  weeklyPoints,
  planDinner,
  recipeLibrary,
  scannerConfirmation,
  wrapped,
  putFood,
} from "../src/lib/domain.mjs";
const fresh = () => upgradeState(initialState());
test("v1 migration preserves inventory and logs and adds ownership and macro goals", () => {
  const raw = initialState();
  raw.logs = [
    { id: "old", date: today(), name: "Lunch", nutrients: { kcal: 100 } },
  ];
  const s = upgradeState(raw);
  assert.equal(s.items[0].id, raw.items[0].id);
  assert.equal(s.items[0].ownerId, "me");
  assert.equal(s.logs[0].userId, "me");
  assert.equal(s.goals.carbs, 250);
  assert.equal(upgradeState(s).friendItems.length, s.friendItems.length);
});
test("box and cylinder dimensions produce volume in mL; density is required for grams", () => {
  assert.equal(
    containerVolume({ shape: "Box", lengthCm: 10, widthCm: 10, heightCm: 5 }),
    500,
  );
  assert.equal(
    containerVolume({ shape: "Cylinder", diameterCm: 10, heightCm: 5 }),
    393,
  );
  assert.equal(
    portionFromContainer(
      { shape: "Box", lengthCm: 10, widthCm: 10, heightCm: 5 },
      50,
      0.8,
    ),
    200,
  );
  assert.throws(() => portionFromContainer({}, 50, ""));
  assert.throws(() => portionFromContainer({}, 101, 1));
});
test("recipe availability aggregates separate containers", () => {
  const r = { ingredients: [["Eggs", 100]] };
  assert.equal(
    recipeMissing(r, [
      { name: "Eggs", grams: 60 },
      { name: "Eggs", grams: 40 },
    ]).length,
    0,
  );
  assert.deepEqual(recipeMissing(r, [{ name: "Eggs", grams: 50 }], 2), [
    ["Eggs", 150],
  ]);
});
test("personal meal cannot consume a roommate’s private food", () => {
  let s = fresh();
  s.items = s.items.map((i) =>
    i.name === "Greek yogurt" ? { ...i, ownerId: "roommate" } : i,
  );
  assert.throws(() => makePersonalMeal(s, recipeLibrary[2]));
  assert.throws(() => logRemoval(s, "food-2", 10));
});
test("personal recipe logs once and deducts combined ingredients across containers", () => {
  const s = fresh();
  const n = makePersonalMeal(s, recipeLibrary[2]);
  assert.equal(n.logs.length, 1);
  assert.equal(n.logs[0].cuisine, "Breakfast");
  assert.equal(n.items.find((i) => i.name === "Greek yogurt").grams, 280);
  assert.equal(s.items.find((i) => i.name === "Greek yogurt").grams, 450);
});
test("discarding updates stock without contributing to intake or streak", () => {
  const n = logRemoval(fresh(), "food-0", 50, "discarded");
  assert.equal(n.items[0].grams, 100);
  assert.equal(n.logs.length, 0);
  assert.equal(streak(n.logs), 0);
});
test("trade requests do not reserve stock; accepting transfers both quantities exactly once", () => {
  const s = fresh();
  const n = requestTrade(s, {
    offeredId: "food-1",
    wantedId: "allen-bread",
    offeredGrams: 100,
    wantedGrams: 80,
  });
  assert.equal(n.items[1].grams, 300);
  const accepted = resolveTrade(n, n.trades[0].id, "accepted");
  assert.equal(accepted.items.find((i) => i.id === "food-1").grams, 200);
  assert.equal(accepted.items.find((i) => i.name === "Sourdough").grams, 80);
  assert.equal(
    accepted.friendItems.find((i) => i.id === "allen-bread").grams,
    320,
  );
  assert.equal(
    accepted.friendItems.find((i) => i.name === "Avocado").grams,
    100,
  );
  assert.throws(() => resolveTrade(accepted, n.trades[0].id, "accepted"));
});
test("changed stock prevents over-trading without partially mutating either fridge", () => {
  let s = requestTrade(fresh(), {
    offeredId: "food-1",
    wantedId: "allen-bread",
    offeredGrams: 250,
    wantedGrams: 80,
  });
  s = logRemoval(s, "food-1", 100);
  const before = JSON.stringify(s);
  assert.throws(() => resolveTrade(s, s.trades[0].id, "accepted"));
  assert.equal(JSON.stringify(s), before);
});
test("declined trade leaves food quantities untouched", () => {
  const s = requestTrade(fresh(), {
    offeredId: "food-1",
    wantedId: "allen-bread",
    offeredGrams: 100,
    wantedGrams: 80,
  });
  const n = resolveTrade(s, s.trades[0].id, "declined");
  assert.equal(n.items[1].grams, 300);
  assert.equal(n.trades[0].status, "declined");
});
test("private fridges cannot be pooled into dinner plans", () => {
  let s = fresh();
  s.fridges[1].shared = false;
  assert.throws(() =>
    planDinner(s, {
      recipeId: "green",
      fridgeIds: ["ava-fridge"],
      servings: 2,
      date: today(),
    }),
  );
});
test("dinner plan pools ingredients but does not reserve or remove food", () => {
  const s = fresh();
  const n = planDinner(s, {
    recipeId: "green",
    fridgeIds: s.fridges.map((f) => f.id),
    servings: 1,
    date: today(),
  });
  assert.equal(n.dinners[0].missing.length, 0);
  assert.equal(n.items[0].grams, s.items[0].grams);
});
test("streak and weekly leaderboard reward days, not calories or number of entries", () => {
  const logs = [
    { date: today(), userId: "me" },
    { date: today(), userId: "me" },
    { date: daysFromNow(-1), userId: "me" },
    { date: daysFromNow(-2), userId: "ava" },
  ];
  assert.equal(streak(logs), 2);
  assert.equal(weeklyPoints(logs), 20);
});
test("scanner confirms owner, expiry, and quantity, then records one event", () => {
  const s = fresh();
  const n = scannerConfirmation(s, {
    direction: "in",
    foodName: "Chickpeas",
    grams: 200,
    fridgeId: "my-fridge",
    ownerId: "shared",
    expires: daysFromNow(4),
  });
  assert.equal(n.items.at(-1).ownerId, "shared");
  assert.equal(n.scannerEvents.length, 1);
  assert.equal(n.logs.length, 0);
});
test("outbound scanner refuses unknown food and oversize removal", () => {
  assert.throws(() =>
    scannerConfirmation(fresh(), {
      direction: "out",
      itemId: "food-0",
      grams: 200,
      action: "eaten",
    }),
  );
});
test("wrapped excludes other people’s diary entries", () => {
  assert.equal(
    wrapped([
      { name: "A", userId: "me", date: today() },
      { name: "B", userId: "ava", date: today() },
    ]).meals,
    1,
  );
});
test("food owner must belong to the target fridge", () => {
  assert.throws(() =>
    putFood(fresh(), { fridgeId: "my-fridge", ownerId: "unknown", grams: 10 }),
  );
});
