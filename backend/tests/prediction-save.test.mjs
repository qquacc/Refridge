import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers.mjs";
import { buildPredictedFood } from "../../packages/shared/predicted-food.mjs";
import { initialState } from "../../apps/main/src/data/food.mjs";
import { upgradeState, logRemoval } from "../../apps/main/src/lib/domain.mjs";
import { applyCameraEvent } from "../../apps/main/src/lib/camera-events.mjs";

test("ingredient nutrition is weighted and missing values stay unknown", () => {
  const food = buildPredictedFood({ name: "Test dish", method: "ingredients", ingredients: [
    { name: "a", estimatedPercent: 60, reference: { cnfId: "a", nutrientsPer100g: { "208": 100, "203": 10, "301": 20 } } },
    { name: "b", estimatedPercent: 40, reference: { cnfId: "b", nutrientsPer100g: { "208": 200, "203": 5 } } },
  ] });
  assert.equal(food.kcal, 140);
  assert.equal(food.protein, 8);
  assert.equal(food.fat, null);
  assert.equal(food.nutrientsPer100g["301"], undefined);
  assert.throws(() => buildPredictedFood({ name: "Bad", method: "ingredients", ingredients: [{ name: "a", estimatedPercent: 90 }] }), /total 100/);
});

test("saved dish prediction is hydrated, confirmed, added to the fridge once, and usable for intake", async (t) => {
  const x = await setup(t), o = await x.owner();
  const id = "00000000-0000-4000-8000-000000000001";
  await x.app.store.mutate((state) => {
    const s = state.sessions[o.sessionId];
    s.context = { inventory: [], containers: [], revision: 1 };
    s.events = [{ id, createdAt: Date.now(), expectedCameraIds: ["top", "side"], images: [{ id: "top", cameraId: "top" }, { id: "side", cameraId: "side" }], status: "pending", analysis: { state: "needs-review", raw: { changes: [{ foodName: "pizza slice", grams: 135, direction: "in", ingredients: [{ name: "mozzarella cheese", estimatedPercent: 100 }] }] } } }];
  });
  const hydrated = await x.request("/api/session", { token: o.ownerToken });
  const prediction = hydrated.data.events[0].analysis.raw.changes[0];
  assert(prediction.nutritionReferences.length > 0);
  assert(prediction.draftFood.kcal > 0);
  const body = { direction: "in", foodName: "Pizza slice", grams: 135, fridgeId: "my-fridge", ownerId: "me", expires: "2026-11-12", containerId: "", prediction: { index: 0, method: "reference", referenceId: prediction.nutritionReferences[0].cnfId, ingredients: prediction.ingredients.map((i) => ({ name: i.name, estimatedPercent: i.estimatedPercent, cnfId: i.reference?.cnfId || "" })) } };
  const request = () => x.request(`/api/events/${id}/confirm`, { token: o.ownerToken, method: "POST", body });
  const confirmed = await request();
  assert.equal(confirmed.status, 200);
  assert(confirmed.data.confirmation.food.kcal > 0);
  assert.equal(confirmed.data.confirmation.food.name, "Pizza slice");
  assert.equal((await request()).status, 200);
  const session = (await x.request("/api/session", { token: o.ownerToken })).data;
  assert.equal(session.context.inventory.length, 1);
  assert.equal(session.context.inventory[0].id, "camera-" + id);
  const before = upgradeState(initialState());
  const once = applyCameraEvent(before, confirmed.data), twice = applyCameraEvent(once, confirmed.data);
  assert.equal(once.items.length, before.items.length + 1);
  assert.equal(twice, once);
  const dish = once.items.find((i) => i.cameraEventId === id);
  assert.equal(dish.grams, 135);
  assert.equal(dish.id, session.context.inventory[0].id);
  assert.equal(dish.ingredients.length, 1);
  assert.equal(dish.estimated, true);
  const eaten = logRemoval(once, dish.id, 50, "eaten");
  assert.equal(eaten.items.find((i) => i.id === dish.id).grams, 85);
  assert(eaten.logs[0].nutrients.kcal > 0);
  const conflict = await x.request(`/api/events/${id}/confirm`, { token: o.ownerToken, method: "POST", body: { ...body, grams: 200 } });
  assert.equal(conflict.status, 409);
});

test("outgoing dishes reuse saved food and skip prediction ingredients and nutrition searches", async () => {
  const { enrichFoodPredictions } = await import("../predictions.mjs");
  const { buildAutomaticPlan } = await import("../../packages/shared/auto-inventory.mjs");
  const known = { id: "dish", name: "Pizza slice", cnfId: null, grams: 135, nutrientsPer100g: { "208": 250 } };
  const analysis = { occluded: false, uncertain: false, changes: [{ foodName: "pizza-ish", direction: "out", inventoryItemId: "dish", foodId: null, grams: 120, wholeItem: true, confidence: 0.99, directionConfidence: 0.99, ingredients: [{ name: "cheese", estimatedPercent: 100 }], draftFood: {}, nutritionReferences: [{}] }] };
  await enrichFoodPredictions(analysis, [known]);
  const change = analysis.changes[0];
  assert.equal(change.foodName, "Pizza slice");
  assert.equal(change.grams, 135);
  assert.deepEqual(change.ingredients, []);
  assert.equal(change.draftFood, undefined);
  assert.equal(change.nutritionReferences, undefined);
  const plan = buildAutomaticPlan({ inventory: [known], containers: [] }, analysis, "event", () => null);
  assert.deepEqual(plan.review, []);
  assert.equal(plan.operations[0].newGrams, 0);
  assert.equal(plan.operations[0].food.nutrientsPer100g["208"], 250);
  change.inventoryItemId = null;
  const unmatched = buildAutomaticPlan({ inventory: [known], containers: [] }, analysis, "event", () => null);
  assert.match(unmatched.review[0], /Food came out/);
  assert(!unmatched.review.join().includes("Prediction:"));
});
