import test from "node:test";
import assert from "node:assert/strict";
import {
  initialState,
  consume,
  cook,
  recipes,
  missingIngredients,
  totals,
  nutrition,
  today,
} from "../src/data.mjs";
test("consumption decreases quantity and logs proportional nutrients", () => {
  const s = initialState();
  const next = consume(s, "food-0", 50);
  assert.equal(next.items[0].grams, 100);
  assert.equal(next.logs[0].nutrients.kcal, 11.5);
  assert.equal(totals(next.logs).kcal, 11.5);
  assert.equal(s.items[0].grams, 150);
});
test("invalid consumption cannot create negative stock", () => {
  for (const amount of [-1, 0, 151, NaN])
    assert.throws(() => consume(initialState(), "food-0", amount));
});
test("cooking consumes ingredients once and logs one combined meal", () => {
  const s = initialState();
  const r = recipes[2];
  const n = cook(s, r);
  assert.equal(n.logs.length, 1);
  assert.equal(n.items.find((i) => i.name === "Greek yogurt").grams, 280);
  assert.equal(n.items.find((i) => i.name === "Strawberries").grams, 100);
  assert.equal(n.logs[0].name, r.name);
});
test("recipes with insufficient ingredients do not mutate inventory", () => {
  const s = initialState();
  assert.equal(missingIngredients(recipes[0], s.items).length, 1);
  assert.throws(() => cook(s, recipes[0]));
  assert.equal(s.logs.length, 0);
});
test("daily totals exclude prior dates", () => {
  assert.equal(
    totals([
      { date: "2000-01-01", nutrients: { kcal: 500 } },
      { date: today(), nutrients: { kcal: 100 } },
    ]).kcal,
    100,
  );
  assert.deepEqual(nutrition({}, 100), {
    kcal: null, protein: null, carbs: null, fat: null, fiber: null,
    cnf: {}, source: null,
  });
});
