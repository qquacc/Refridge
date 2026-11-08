import test from "node:test";
import assert from "node:assert/strict";
import { calculateGoalTargets } from "../../../packages/shared/goal-targets.mjs";
import { calculatePriorityPlan, recipeStockCoverage } from "../src/lib/goal-plan.mjs";
import { refreshDerived } from "../src/lib/planning.mjs";
import { initialState } from "../src/data/food.mjs";
import { upgradeState } from "../src/lib/domain.mjs";
const date = new Date("2026-11-08T12:00:00"), profile = { birthday: "1996-01-01", weightKg: 70, heightM: 1.75, referenceSex: "male", activity: "Active", lifeStage: "Neither", goal: "Balanced variety", budgetCad: 70, mealsPerDay: 3 };
test("adult bulking uses a surplus and weight-based protein with consistent energy arithmetic", () => {
  const base = calculateGoalTargets(profile, date), bulk = calculateGoalTargets({ ...profile, goal: "Bulking" }, date);
  assert.equal(bulk.targets.kcal, Math.round(base.targets.kcal * 1.05));
  assert.equal(bulk.targets.protein, 126);
  assert.equal(bulk.adjustmentKcal, bulk.targets.kcal - base.targets.kcal);
  assert.equal(bulk.targets.fiber, base.targets.fiber);
  assert(Math.abs(bulk.targets.protein * 4 + bulk.targets.carbs * 4 + bulk.targets.fat * 9 - bulk.targets.kcal) <= 3);
  const larger = calculateGoalTargets({ ...profile, goal: "Bulking", bulkingSurplusPercent: 10, bulkingProteinPerKg: 2 }, date);
  assert.equal(larger.targets.protein, 140); assert(larger.targets.kcal > bulk.targets.kcal);
});
test("budget and waste priorities retain nutrition needs; under-19 profiles do not receive a bulking surplus", () => {
  const base = calculateGoalTargets(profile, date);
  for (const goal of ["Affordability", "Less waste"]) assert.deepEqual(calculateGoalTargets({ ...profile, goal }, date).targets, base.targets);
  const teen = calculateGoalTargets({ ...profile, birthday: "2010-01-01", goal: "Bulking" }, date);
  assert.equal(teen.adjustmentKcal, 0); assert.match(teen.note, /adults only/);
  assert.equal(calculateGoalTargets({ ...profile, weightKg: "" }, date).available, false);
});
test("affordability, use-soon stock, and variety use actual inputs and exclude others’ data", () => {
  const state = { ...upgradeState(initialState()), profile, activeFridgeId: "my-fridge", items: [
    { id: "soon", name: "Carrot", grams: 200, expires: "2026-11-10", ownerId: "me", fridgeId: "my-fridge" },
    { id: "old", name: "Milk", grams: 100, expires: "2026-11-07", ownerId: "shared", fridgeId: "my-fridge" },
    { id: "other", name: "Cheese", grams: 500, expires: "2026-11-10", ownerId: "roommate", fridgeId: "my-fridge" },
  ], friendItems: [], logs: [
    { name: "Curry", date: "2026-11-08", userId: "me" }, { name: "curry", date: "2026-11-07", userId: "me" },
    { name: "Salad", date: "2026-11-08", userId: "other" }, { name: "Old food", date: "2026-10-01", userId: "me" },
  ] };
  const plan = calculatePriorityPlan(state, profile, date);
  assert.equal(plan.budget.daily, 10); assert.equal(plan.budget.perMeal, 10 / 3);
  assert.equal(plan.soonGrams, 200); assert.equal(plan.overdueGrams, 100);
  assert.equal(plan.variety.distinct, 1); assert.equal(plan.variety.recordedDays, 2); assert.equal(plan.variety.remaining, 11);
  const coverage = recipeStockCoverage({ ingredients: [["Carrot", 100], ["Milk", 200]] }, state.items);
  assert.equal(coverage.percent, 67); assert.equal(coverage.missing, 1);
});
test("saved automatic goals use priority adjustments while manual values are preserved", () => {
  const state = upgradeState(initialState()); state.profile = { ...state.profile, ...profile, goal: "Bulking", targetMode: "auto" };
  const auto = refreshDerived(state);
  assert.equal(auto.goals.kcal, auto.targetCalculation.targets.kcal);
  assert(auto.targetCalculation.adjustmentKcal > 0);
  const manual = refreshDerived({ ...state, profile: { ...state.profile, targetMode: "manual" }, goals: { kcal: 2000, protein: 100, carbs: 250, fat: 60, fiber: 30 } });
  assert.equal(manual.goals.kcal, 2000); assert.equal(manual.goals.protein, 100);
});
