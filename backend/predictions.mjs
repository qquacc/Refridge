import { buildPredictedFood } from "../packages/shared/predicted-food.mjs";
import { searchNutrition, canadianFood, loadNutrition } from "./nutrition.mjs";
const suggestionCache = new Map();
async function suggestions(name) {
  const cleaned = name.toLowerCase().replace(/\b(slice|slices|piece|pieces|portion|toppings?)\b/g, " ").trim();
  const key = cleaned || name;
  if (suggestionCache.has(key)) return suggestionCache.get(key);
  const matches = (await searchNutrition(key)).slice(0, 3);
  if (suggestionCache.size >= 128) suggestionCache.delete(suggestionCache.keys().next().value);
  suggestionCache.set(key, matches);
  return matches;
}
export async function enrichFoodPredictions(analysis, inventory = []) {
  for (const change of analysis.changes || []) {
    if (!change || typeof change.foodName !== "string" || !change.foodName.trim()) continue;
    change.foodName = change.foodName.trim().slice(0, 80);
    if (change.direction === "out") {
      const known = inventory.find((i) => i.id === change.inventoryItemId);
      if (known) {
        change.foodName = known.name;
        change.foodId = known.cnfId || null;
        if (change.wholeItem) change.grams = known.grams;
      }
      change.ingredients = [];
      delete change.nutritionSuggestions;
      delete change.nutritionReferences;
      delete change.draftFood;
      continue;
    }
    change.nutritionSuggestions = (await suggestions(change.foodName)).slice(0, 3)
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
    for (const ingredient of change.ingredients) {
      ingredient.nutritionSuggestions = (await suggestions(ingredient.name)).map((food) => ({ cnfId: food.cnfId, name: food.name }));
      ingredient.references = ingredient.nutritionSuggestions.map((f) => canadianFood(f.cnfId));
      ingredient.reference = ingredient.nutritionSuggestions[0] ? canadianFood(ingredient.nutritionSuggestions[0].cnfId) : null;
    }
    change.nutritionReferences = change.nutritionSuggestions.map((f) => canadianFood(f.cnfId));
    change.draftFood = buildPredictedFood({ name: change.foodName, ingredients: change.ingredients, reference: change.nutritionReferences[0] });
  }
  return analysis;
}

export async function confirmedPredictedFood(event, input) {
  await loadNutrition();
  const prediction = event.analysis?.raw?.changes?.[input.prediction.index];
  if (!prediction?.foodName || prediction.direction === "out") throw Error("This food prediction is no longer available. Refresh and review the event.");
  const ingredients = input.prediction.ingredients.map((i) => ({
    name: i.name, estimatedPercent: i.estimatedPercent,
    reference: i.cnfId ? canadianFood(i.cnfId) : null,
  }));
  const reference = input.prediction.referenceId ? canadianFood(input.prediction.referenceId) : null;
  if (input.prediction.referenceId && !reference) throw Error("Choose a valid nutrition reference.");
  if (input.prediction.ingredients.some((i, n) => i.cnfId && !ingredients[n].reference)) throw Error("An ingredient reference is invalid.");
  return buildPredictedFood({ name: input.foodName, ingredients, reference, method: input.prediction.method });
}
