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
