import { calculateGoalTargets } from "../../../../packages/shared/goal-targets.mjs";
export function calculatePriorityPlan(state, profile = state.profile, date = new Date()) {
  const targets = calculateGoalTargets(profile, date);
  const dateString = date.toLocaleDateString("en-CA"), start = new Date(date); start.setDate(start.getDate() - 6);
  const from = start.toLocaleDateString("en-CA"), soonDate = new Date(date); soonDate.setDate(soonDate.getDate() + 3);
  const until = soonDate.toLocaleDateString("en-CA");
  const pool = [...state.items, ...(state.friendItems || [])].filter((i) => i.grams > 0 && i.fridgeId === state.activeFridgeId && ["me", "shared"].includes(i.ownerId));
  const soon = pool.filter((i) => i.expires && i.expires >= dateString && i.expires <= until);
  const overdue = pool.filter((i) => i.expires && i.expires < dateString);
  const logs = (state.logs || []).filter((l) => (l.userId || "me") === "me" && l.date >= from && l.date <= dateString);
  const names = new Set(logs.map((l) => String(l.name || "").trim().toLowerCase()).filter(Boolean));
  const budget = Number(profile.budgetCad), meals = Number(profile.mealsPerDay ?? 3);
  const budgetValid = Number.isFinite(budget) && budget > 0 && Number.isInteger(meals) && meals >= 1 && meals <= 6;
  const varietyTarget = Math.max(1, Math.min(50, Number(profile.varietyWeeklyTarget) || 12));
  return { targets, budget: budgetValid ? { weekly: budget, daily: budget / 7, perMeal: budget / (7 * meals), mealsPerWeek: meals * 7 } : null,
    mealsPerDay: Number.isInteger(meals) && meals >= 1 && meals <= 6 ? meals : 3,
    soon, soonGrams: soon.reduce((n, i) => n + Number(i.grams), 0), overdueGrams: overdue.reduce((n, i) => n + Number(i.grams), 0),
    unknownDates: pool.filter((i) => !i.expires).length,
    variety: { distinct: names.size, target: varietyTarget, remaining: Math.max(0, varietyTarget - names.size), recordedDays: new Set(logs.map((l) => l.date)).size },
  };
}
export function recipeStockCoverage(recipe, inventory) {
  let total = 0, available = 0, missing = 0;
  for (const [name, grams] of recipe.ingredients) {
    const stock = inventory.filter((i) => i.name === name && i.grams > 0).reduce((n, i) => n + Number(i.grams), 0);
    total += grams; available += Math.min(grams, stock); if (stock < grams) missing++;
  }
  return { percent: total ? Math.round(available / total * 100) : 0, missing };
}
