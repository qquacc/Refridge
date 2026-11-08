import test from "node:test";
import assert from "node:assert/strict";
import { groupFridgeFoods, fridgeCategory } from "../src/lib/fridge-layout.mjs";
import { saveCheckIn, wellbeingSeries, metricAverage } from "../src/lib/wellbeing.mjs";
import { finishOnboardingStep, onboardingQuestions, currentOnboardingStep } from "../src/lib/onboarding.mjs";
import { upgradeState } from "../src/lib/domain.mjs";
import { initialState } from "../src/data/food.mjs";

test("fridge layout puts every available food on exactly one shelf with condiments first and meat last", () => {
  const foods = [
    { id: "sauce", name: "Soy sauce", category: "Other", grams: 40 },
    { id: "carrot", name: "Carrot", category: "Vegetables", grams: 80 },
    { id: "meat", name: "Chicken breast", category: "Protein", grams: 200 },
    { id: "meal", name: "Chicken curry", category: "Prepared dishes", grams: 300 },
    { id: "grains", name: "Brown rice", category: "Grains", grams: 250 },
    { id: "empty", name: "Empty milk", category: "Dairy", grams: 0 },
    { id: "old", name: "Greek yogurt", category: "Dairy", grams: 100, expires: "2026-11-06" },
    { id: "new", name: "Greek yogurt", category: "Dairy", grams: 100, expires: "2026-11-10" },
  ];
  const groups = groupFridgeFoods(foods), ids = groups.flatMap((g) => g.foods.map((f) => f.id));
  assert.equal(groups[0].id, "condiments"); assert.equal(groups.at(-1).id, "meat");
  assert.equal(groups.at(-2).id, "vegetables");
  assert.equal(ids.length, foods.length - 1); assert.equal(new Set(ids).size, ids.length);
  assert.equal(fridgeCategory(foods[2]), "meat"); assert.equal(fridgeCategory(foods[3]), "prepared");
  assert.equal(fridgeCategory(foods[4]), "staples");
  assert.deepEqual(groups.find((g) => g.id === "dairy").foods.map((f) => f.id), ["old", "new"]);
});

test("daily check-ins validate ranges, allow missing answers, and update a date without duplication", () => {
  const once = saveCheckIn([], { date: "2026-11-07", mood: "4", energy: "", stress: null, sleepHours: "0" }, "2026-11-07");
  assert.equal(once[0].energy, null); assert.equal(once[0].sleepHours, 0);
  const twice = saveCheckIn(once, { date: "2026-11-07", energy: "2" }, "2026-11-07");
  assert.equal(twice.length, 1); assert.equal(twice[0].energy, 2);
  assert.throws(() => saveCheckIn([], { date: "2026-11-08", mood: 3 }, "2026-11-07"), /earlier/);
  assert.throws(() => saveCheckIn([], { date: "2026-02-31", mood: 3 }, "2026-11-07"), /valid/);
  assert.throws(() => saveCheckIn([], { date: "2026-11-07", mood: 6 }, "2026-11-07"), /1–5/);
  assert.throws(() => saveCheckIn([], { date: "2026-11-07", sleepHours: 25 }, "2026-11-07"), /0–24/);
  assert.throws(() => saveCheckIn([], { date: "2026-11-07" }, "2026-11-07"), /at least one/);
});

test("trends distinguish unlogged days, known zero values, partial nutrients, and other people’s intake", () => {
  const state = { wellbeing: { checkIns: [{ date: "2026-11-07", energy: 4, mood: null }] }, logs: [
    { date: "2026-11-07", userId: "me", nutrients: { protein: 0, fiber: 5 } },
    { date: "2026-11-07", userId: "me", nutrients: { protein: null, fiber: null } },
    { date: "2026-11-06", userId: "other", nutrients: { protein: 100, fiber: 100 } },
  ] };
  const series = wellbeingSeries(state, "2026-11-07", 3);
  assert.deepEqual(series.map((d) => d.date), ["2026-11-05", "2026-11-06", "2026-11-07"]);
  assert.equal(series[1].protein, null); assert.equal(series[2].protein, 0);
  assert.equal(series[2].proteinPartial, true); assert.equal(series[2].fiber, 5);
  assert.equal(series[2].mood, null);
  assert.deepEqual(metricAverage(series, "energy"), { value: 4, count: 1 });
  assert.deepEqual(metricAverage(series, "mood"), { value: null, count: 0 });
});

test("onboarding persists one answer at a time, can skip optional questions, and completes without inventing a birthday", () => {
  let state = upgradeState(initialState());
  const draft = { ...state.profile, name: "Alex", birthday: "", diets: ["Vegan"], allergenAvoid: ["Peanuts"], allergies: "Sesame", activity: "Active", goal: "Less waste" };
  state = finishOnboardingStep(state, draft, 0, "2026-11-07");
  assert.equal(state.profile.name, "Alex"); assert.equal(state.onboarding.step, 1);
  assert.equal(state.members.find((m) => m.id === "me").name, "Alex");
  state = finishOnboardingStep(state, draft, 1, "2026-11-07", true);
  for (let step = 2; step < onboardingQuestions.length; step++) state = finishOnboardingStep(state, draft, step, "2026-11-07");
  assert.equal(state.onboarding.completed, true); assert.equal(state.profile.complete, true);
  assert.equal(state.profile.birthday, ""); assert.deepEqual(state.profile.allergenAvoid, ["Peanuts"]);
  assert.deepEqual(state.profile.diets, ["Vegan"]);
  assert.throws(() => finishOnboardingStep(state, { ...draft, name: " " }, 0, "2026-11-07"), /name/);
  assert.throws(() => finishOnboardingStep(state, { ...draft, birthday: "2026-02-31" }, 1, "2026-11-07"), /birthday/);
});

test("onboarding asks body questions individually, saves units correctly, and resumes old flows safely", () => {
  let state = upgradeState(initialState());
  const draft = { ...state.profile, weightKg: "72.5", heightM: 1.78, gender: "Non-binary" };
  state = finishOnboardingStep(state, draft, 2, "2026-11-08");
  assert.equal(state.profile.weightKg, 72.5);
  state = finishOnboardingStep(state, draft, 3, "2026-11-08");
  assert.equal(state.profile.heightM, 1.78);
  state = finishOnboardingStep(state, draft, 4, "2026-11-08");
  assert.equal(state.profile.gender, "Non-binary");
  assert.equal(state.profile.referenceSex, "");
  assert.equal(state.profile.lifeStage, "Neither");
  assert.equal(state.onboarding.version, 2);
  assert.equal(currentOnboardingStep({ onboarding: { step: 5 } }), 2);
  assert.equal(currentOnboardingStep({ onboarding: { version: 2, step: 7 } }), 7);
  assert.throws(() => finishOnboardingStep(state, { ...draft, weightKg: -1 }, 2, "2026-11-08"), /weight/);
  assert.throws(() => finishOnboardingStep(state, { ...draft, heightM: 178 }, 3, "2026-11-08"), /height/);
  const skipped = finishOnboardingStep(state, { ...draft, weightKg: "" }, 2, "2026-11-08", true);
  assert.equal(skipped.profile.weightKg, 72.5);
});

test("fridge zones put drinks and sauces in the door and every food in exactly one zone", async () => {
  const { zoneFridgeFoods, fridgeZone, foodEmoji } = await import("../src/lib/fridge-layout.mjs");
  const foods = [
    { id: "milk", name: "Milk", category: "Dairy", grams: 1000 }, { id: "yog", name: "Greek yogurt", category: "Dairy", grams: 500 },
    { id: "oj", name: "Orange juice, raw", category: "Fruits", grams: 900 }, { id: "pb", name: "Peanut butter", category: "Legumes", grams: 300 },
    { id: "ts", name: "Tomato sauce", category: "Vegetables", grams: 400 }, { id: "kale", name: "Kale", category: "Vegetables", grams: 150 },
    { id: "apple", name: "Apple", category: "Fruits", grams: 200 }, { id: "fish", name: "Salmon", category: "Protein", grams: 300 },
    { id: "gone", name: "Cheddar", category: "Dairy", grams: 0 },
  ];
  assert.equal(fridgeZone(foods[0]), "door-drinks"); assert.equal(fridgeZone(foods[1]), "shelf-dairy");
  assert.equal(fridgeZone(foods[2]), "door-drinks"); assert.equal(fridgeZone(foods[3]), "door-spreads");
  assert.equal(fridgeZone(foods[4]), "door-sauces"); assert.equal(fridgeZone(foods[5]), "crisper-veg");
  assert.equal(fridgeZone(foods[6]), "crisper-fruit"); assert.equal(fridgeZone(foods[7]), "drawer-seafood");
  assert.equal(fridgeZone({ name: "Chicken breast", category: "Protein" }), "drawer-meat"); assert.equal(fridgeZone({ name: "Butter", category: "Dairy" }), "door-spreads");
  const ids = Object.values(zoneFridgeFoods(foods)).flatMap((z) => z.foods.map((f) => f.id));
  assert.equal(ids.length, foods.length - 1); assert.equal(new Set(ids).size, ids.length);
  assert.equal(foodEmoji({ name: "Apricot, raw", emoji: "🍽️" }), "🍑"); assert.equal(foodEmoji({ name: "Kale", emoji: "🥬" }), "🥬");
});

test("food details pick the nutrient with the largest share of a daily reference and describe freshness", async () => {
  const { foodHighlights, freshness, itemMacros } = await import("../src/lib/food-peek.mjs");
  const { daysFromNow } = await import("../src/data/food.mjs");
  const kale = { name: "Kale", grams: 200, nutrientsPer100g: { 203: 4.3, 401: 93, 430: 705, 208: 49, 205: 8.8, 204: 0.9 } };
  const result = foodHighlights(kale, {}, {});
  assert.equal(result.top.name, "Vitamin K"); assert.equal(Math.round(result.top.percent100g), 588);
  assert.equal(result.top.inItem, 1410); assert.equal(result.others[0].name, "Vitamin C"); assert.equal(result.personal, false);
  const personal = foodHighlights(kale, { birthday: "1990-01-01", gender: "Woman" }, {});
  assert.equal(personal.personal, true); assert.equal(Math.round(personal.top.percent100g), 783);
  assert.equal(foodHighlights({ name: "Mystery", grams: 50 }, {}, {}).top, null);
  assert.equal(itemMacros(kale).kcal, 98);
  assert.equal(freshness(null).tone, "unknown"); assert.equal(freshness(daysFromNow(0)).label, "Use today");
  assert.equal(freshness(daysFromNow(3)).tone, "soon"); assert.equal(freshness(daysFromNow(10)).tone, "fresh");
  assert.equal(freshness(daysFromNow(-2)).tone, "past");
});

test("onboarding saves who the kitchen is for and preserves a family member's profile on resume", () => {
  let state = upgradeState({ ...initialState(), profile: { name: 'You' }, items: [], logs: [], groceries: [] });
  assert.throws(() => finishOnboardingStep(state, {}, -1, '2026-11-08'), /who this account/);
  state = finishOnboardingStep(state, { accountFor: 'family' }, -1, '2026-11-08');
  assert.equal(state.profile.accountFor, 'family');
  assert.equal(state.onboarding.step, 0);
  state = finishOnboardingStep(state, { name: 'Grandma June' }, 0, '2026-11-08');
  assert.equal(state.profile.name, 'Grandma June');
  assert.equal(state.profile.accountFor, 'family');
  assert.equal(currentOnboardingStep(JSON.parse(JSON.stringify(state))), 1);
  const resumed = finishOnboardingStep(state, { accountFor: 'myself' }, -1, '2026-11-08');
  assert.equal(resumed.profile.accountFor, 'myself');
  assert.equal(resumed.onboarding.step, 1);
  assert.equal(resumed.profile.name, 'Grandma June');
});
