import test from "node:test";
import assert from "node:assert/strict";
import { initialState, today, catalog } from "../src/data/food.mjs";
import { upgradeState, makePersonalMeal } from "../src/lib/domain.mjs";
import {
  learnUsualStock,
  allowedRecipes,
  reconcileGroceries,
  completeGrocery,
  reconcileChallenges,
  periodKey,
  pointsFor,
  createTradeRequest,
} from "../src/lib/planning.mjs";
import { foodFits, recipeFits } from "../../../packages/shared/dietary.mjs";
import {
  automaticTargets,
  perPortion,
  nutrientTotals,
  recipeNutrients,
} from "../../../packages/shared/nutrition.mjs";
import { mealRecipes, cuisines } from "../../../packages/shared/recipes.mjs";
import {
  buildAutomaticPlan,
  applyInventoryOperations,
} from "../../../packages/shared/auto-inventory.mjs";
import { applyCameraEvent } from "../src/lib/camera-events.mjs";
const fresh = () => upgradeState(initialState());
test("peanut allergy in notes excludes the peanut recipe and prevents cooking it", () => {
  const s = fresh();
  s.profile.allergies = "Peanut allergy";
  assert(!allowedRecipes(s).some((r) => r.id === "peanutbowl"));
  assert.throws(
    () =>
      makePersonalMeal(
        s,
        mealRecipes.find((r) => r.id === "peanutbowl"),
      ),
    /dietary/,
  );
});
test("vegan, wheat, milk and shellfish rules check actual ingredient references", () => {
  assert(!foodFits({ name: "Crab" }, { diets: ["Vegetarian"] }).safe);
  assert(
    !foodFits(
      catalog.find((c) => c.name === "Tortilla"),
      { allergenAvoid: ["Wheat"] },
    ).safe,
  );
  assert(
    !foodFits(
      catalog.find((c) => c.name === "Greek yogurt"),
      { allergenAvoid: ["Milk"] },
    ).safe,
  );
  assert(
    foodFits(
      catalog.find((c) => c.name === "Coconut milk"),
      { diets: ["Dairy-free"] },
    ).safe,
  );
  assert(!recipeFits(mealRecipes[2], { diets: ["Vegan"] }, catalog).safe);
  assert(
    !recipeFits({ ingredients: [["Mystery sauce", 10]] }, {}, catalog).safe,
  );
});
test("all recipes have resolvable Canadian ingredients and verified government source links", () => {
  assert(cuisines.length >= 50);
  assert(mealRecipes.length >= 20);
  for (const r of mealRecipes) {
    for (const [name] of r.ingredients)
      assert(
        catalog.some((c) => c.name === name),
        name,
      );
    assert(r.sourceUrl.startsWith("https://www.canada.ca/"));
    const n = recipeNutrients(r, catalog);
    assert(n.kcal > 0);
    assert(n.sources.length === r.ingredients.length);
  }
});
test("groceries reflect current shortage, update grams, and disappear after restocking", () => {
  let s = fresh();
  s.groceries = [];
  s.staples = [
    {
      id: "spinach",
      name: "Baby spinach",
      minimumGrams: 50,
      usualGrams: 200,
      enabled: true,
    },
  ];
  s.items[0].grams = 30;
  s = reconcileGroceries(s);
  assert.equal(s.groceries[0].grams, 170);
  s.items[0].grams = 10;
  s = reconcileGroceries(s);
  assert.equal(s.groceries.length, 1);
  assert.equal(s.groceries[0].grams, 190);
  s.items[0].grams = 200;
  assert.equal(reconcileGroceries(s).groceries.length, 0);
});
test("completed groceries keep a memory, pause regeneration, and clearing history releases the pause", () => {
  let s = fresh();
  s.groceries = [];
  s.items[0].grams = 0;
  s = reconcileGroceries(s);
  const g = s.groceries.find((g) => g.name === "Baby spinach");
  s = completeGrocery(s, g.id);
  assert(s.completedGroceries.some((c) => c.id === g.id && c.completedAt));
  assert(
    !reconcileGroceries(s).groceries.some((g) => g.name === "Baby spinach"),
  );
  s.completedGroceries = [];
  assert(
    reconcileGroceries(s).groceries.some((g) => g.name === "Baby spinach"),
  );
});
test("roommate stock does not satisfy a personal grocery replenishment rule", () => {
  let s = fresh();
  s.items[0].ownerId = "roommate";
  s.groceries = [];
  s = reconcileGroceries(s);
  assert(s.groceries.some((g) => g.name === "Baby spinach"));
});
test("weekly periods start Monday across month and year boundaries", () => {
  assert.equal(periodKey("2026-11-08", "weekly"), "2026-11-02");
  assert.equal(periodKey("2026-11-09", "weekly"), "2026-11-09");
  assert.equal(periodKey("2027-01-01", "weekly"), "2026-12-28");
  const ledger = [
    { date: "2026-11-08", points: 20, userId: "me" },
    { date: "2026-11-09", points: 30, userId: "me" },
  ];
  assert.equal(pointsFor(ledger, "me", "weekly", "2026-11-09"), 30);
  assert.equal(pointsFor(ledger, "me", "monthly", "2026-11-09"), 50);
});
test("challenges award once from recorded actions and never from a completion button", () => {
  let s = fresh();
  s.logs = [{ date: today(), source: "recipe", name: "Lunch" }];
  s = reconcileChallenges(s);
  assert.equal(s.pointsLedger.length, 1);
  assert.equal(s.pointsLedger[0].points, 30);
  assert.equal(reconcileChallenges(s).pointsLedger.length, 1);
  assert.equal(s.assignedChallenges.length, 3);
});
test("in-person free and food trade requests contain no amount or automatic stock transfer", () => {
  const s = fresh();
  const n = createTradeRequest(s, { wantedId: "allen-bread" });
  assert.equal(n.trades[0].offerName, "Free request");
  assert(!("wantedGrams" in n.trades[0]));
  assert.deepEqual(s.items, n.items);
  assert.throws(() => createTradeRequest(s, { wantedId: "food-0" }));
});
test("adult targets follow the published EER equation and do not use BMI alone", () => {
  const p = {
    birthday: "2000-01-01",
    weightKg: 70,
    heightM: 1.75,
    referenceSex: "male",
    activity: "Low",
    lifeStage: "Neither",
  };
  const n = automaticTargets(p, new Date("2026-11-08T12:00:00"));
  assert.equal(
    n.targets.kcal,
    Math.round(753.07 - 10.83 * 26 + 6.5 * 175 + 14.1 * 70),
  );
  assert(
    automaticTargets({ ...p, activity: "Moderate" }, new Date("2026-11-08"))
      .targets.kcal > n.targets.kcal,
  );
  assert(!automaticTargets({ ...p, lifeStage: "Pregnant" }).available);
  assert(!automaticTargets({ ...p, birthday: "2020-01-01" }).available);
});
test("unknown nutrient values are not zeros and partial recipe fields report partial coverage", () => {
  assert.equal(perPortion({}, 100).kcal, null);
  const n = recipeNutrients(
    {
      ingredients: [
        ["A", 100],
        ["B", 100],
      ],
    },
    [
      { name: "A", nutrientsPer100g: { 301: 10 } },
      { name: "B", nutrientsPer100g: {} },
    ],
  );
  assert.equal(n.cnf["301"], 10);
  assert.equal(nutrientTotals([{ nutrients: n }]).coverage["301"], 0);
});
const spinach = catalog.find((c) => c.name === "Baby spinach");
const known = {
  ...spinach,
  id: "tracked",
  fridgeId: "my-fridge",
  ownerId: "me",
  grams: 200,
};
const context = {
  fridgeId: "my-fridge",
  inventory: [known],
  containers: [],
  defaultOwnerId: "me",
};
const change = (extra = {}) => ({
  foodId: spinach.cnfId,
  inventoryItemId: "tracked",
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
  ...extra,
});
const scene = (c) => ({
  occluded: false,
  uncertain: false,
  summary: "Tracked food removed",
  changes: [c],
});
const lookup = (id) => catalog.find((c) => c.cnfId === id);
test("a tracked whole outgoing item uses its recorded weight and applies once on the main phone", () => {
  const p = buildAutomaticPlan(context, scene(change()), "event", lookup);
  assert.equal(p.operations[0].grams, 200);
  let s = fresh();
  s.items = [known];
  s.friendItems = [];
  const event = {
    id: "event",
    status: "confirmed",
    confirmation: {
      direction: "automation",
      operations: p.operations,
      estimatedConsumption: false,
    },
  };
  const n = applyCameraEvent(s, event);
  assert.equal(n.items[0].grams, 0);
  assert.equal(n.logs.length, 0);
  assert.equal(applyCameraEvent(n, event), n);
});
test("unknown mass, ambiguous scenes and invalid confidence never silently mutate stock", () => {
  for (const c of [
    change({ confidence: NaN }),
    change({ foodId: "invented" }),
    change({ wholeItem: false }),
    change({ confidence: 0.6 }),
  ]) {
    const p = buildAutomaticPlan(context, scene(c), "e", lookup);
    assert(p.review.length);
    assert.equal(p.operations.length, 0);
  }
  assert(
    buildAutomaticPlan(
      context,
      { ...scene(change()), occluded: true },
      "e",
      lookup,
    ).review.length,
  );
});
test("container portions use food density and outgoing fill means remaining stock", () => {
  const container = {
    id: "box",
    shape: "Box",
    lengthCm: 10,
    widthCm: 10,
    heightCm: 5,
    count: 2,
    densityByFood: { [spinach.cnfId]: 0.5 },
  };
  const ctx = { ...context, containers: [container] };
  const p = buildAutomaticPlan(
    ctx,
    scene(
      change({
        wholeItem: false,
        containerId: "box",
        massMethod: "container",
        fillPercent: 40,
      }),
    ),
    "e",
    lookup,
  );
  assert.equal(p.operations[0].grams, 100);
  assert.equal(p.operations[0].newGrams, 100);
});
test("a batch cannot overfill the same last physical container", () => {
  const ctx = {
    ...context,
    inventory: [],
    containers: [
      {
        id: "box",
        shape: "Box",
        lengthCm: 10,
        widthCm: 10,
        heightCm: 5,
        count: 1,
        densityByFood: { [spinach.cnfId]: 0.5 },
      },
    ],
  };
  const c = change({
    direction: "in",
    inventoryItemId: null,
    containerId: "box",
    massMethod: "container",
    fillPercent: 40,
    wholeItem: false,
  });
  const p = buildAutomaticPlan(
    ctx,
    { ...scene(c), changes: [c, c] },
    "e",
    lookup,
  );
  assert(p.review.length);
  assert.equal(p.operations.length, 0);
});
test("concurrent stock edits fail a whole transaction without partial writes", () => {
  const ops = [
    { kind: "quantity", itemId: "tracked", expectedGrams: 200, newGrams: 0 },
    { kind: "quantity", itemId: "missing", expectedGrams: 1, newGrams: 0 },
  ];
  assert.throws(() => applyInventoryOperations([known], ops));
  assert.equal(known.grams, 200);
  assert.throws(() =>
    applyInventoryOperations([{ ...known, grams: 150 }], ops.slice(0, 1)),
  );
});

test("newly observed foods become usual stock and manual amounts are preserved", () => {
  let s = fresh();
  s.staples = [];
  s.items = s.items.slice(0, 1);
  s = learnUsualStock(s);
  assert.equal(s.staples[0].usualGrams, 150);
  s.items[0].grams = 250;
  s = learnUsualStock(s);
  assert.equal(s.staples[0].usualGrams, 250);
  s.staples[0] = { ...s.staples[0], usualGrams: 100, manual: true };
  assert.equal(learnUsualStock(s).staples[0].usualGrams, 100);
});
