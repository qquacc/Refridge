import { searchNutrition } from "./nutrition.mjs";
export async function enrichFoodPredictions(analysis) {
  for (const change of analysis.changes || []) {
    if (!change || typeof change.foodName !== "string" || !change.foodName.trim()) continue;
    change.foodName = change.foodName.trim().slice(0, 100);
    change.nutritionSuggestions = (await searchNutrition(change.foodName)).slice(0, 3)
      .map(({ cnfId, name }) => ({ cnfId, name }));
    change.ingredients = (Array.isArray(change.ingredients) ? change.ingredients : [])
      .filter((i) => i && typeof i.name === "string" && i.name.trim())
      .slice(0, 8).map((i) => ({
        name: i.name.trim().slice(0, 100),
        estimatedPercent: Number.isFinite(i.estimatedPercent) && i.estimatedPercent >= 0 && i.estimatedPercent <= 100 ? i.estimatedPercent : null,
      }));
    const total = change.ingredients.reduce((n, i) => n + (i.estimatedPercent ?? 0), 0);
    if (total && Math.abs(total - 100) > 2)
      change.ingredients = change.ingredients.map((i) => ({ ...i, estimatedPercent: null }));
  }
  return analysis;
}
