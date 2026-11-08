import { canadianCatalog } from "../../../../packages/shared/data/cnf-catalog.mjs";
import {
  perPortion,
  recipeNutrients,
} from "../../../../packages/shared/nutrition.mjs";
import { mealRecipes } from "../../../../packages/shared/recipes.mjs";
export const today = () => new Date().toLocaleDateString("en-CA");
export const daysFromNow = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("en-CA");
};
export const daysLeft = (date) =>
  Math.round(
    (new Date(date + "T12:00:00") - new Date(today() + "T12:00:00")) / 86400000,
  );
export const uid = () =>
  globalThis.crypto?.randomUUID?.() ||
  `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
export const catalog = canadianCatalog;
export function initialState() {
  return {
    items: catalog.slice(0, 6).map((x, i) => ({
      ...x,
      id: "food-" + i,
      grams: [150, 300, 450, 250, 300, 200][i],
      expires: daysFromNow([1, 3, 5, 4, 9, 2][i]),
    })),
    groceries: [
      { id: "g1", name: "Oat milk", checked: false },
      { id: "g2", name: "Rolled oats", checked: false },
      { id: "g3", name: "Lemons", checked: true },
    ],
    logs: [],
    household: "My kitchen",
    goals: { kcal: 2000, protein: 75, fiber: 28 },
  };
}
export function nutrition(food, grams) {
  return perPortion(food, grams);
}
export function totals(logs) {
  return logs
    .filter((l) => l.date === today())
    .reduce(
      (s, l) =>
        Object.fromEntries(
          Object.keys(s).map((k) => [k, s[k] + (l.nutrients[k] || 0)]),
        ),
      { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
    );
}
export function consume(state, id, grams) {
  const food = state.items.find((i) => i.id === id);
  if (!food || !Number.isFinite(grams) || grams <= 0 || grams > food.grams)
    throw Error("Choose an amount within the available quantity.");
  return {
    ...state,
    items: state.items.map((i) =>
      i.id === id
        ? { ...i, grams: Math.round((i.grams - grams) * 10) / 10 }
        : i,
    ),
    logs: [
      ...state.logs,
      {
        id: uid(),
        date: today(),
        name: food.name,
        emoji: food.emoji,
        grams,
        nutrients: nutrition(food, grams),
        source: "fridge",
      },
    ],
  };
}
export const recipes = mealRecipes;
export const recipeNutrition = (recipe) => recipeNutrients(recipe, catalog);
export function missingIngredients(recipe, items) {
  return recipe.ingredients.filter(
    ([name, g]) => !items.some((i) => i.name === name && i.grams >= g),
  );
}
export function cook(state, recipe) {
  if (missingIngredients(recipe, state.items).length)
    throw Error("Add the missing ingredients before logging this meal.");
  let next = state;
  for (const [name, g] of recipe.ingredients)
    next = consume(next, next.items.find((i) => i.name === name).id, g);
  return {
    ...next,
    logs: [
      ...state.logs,
      {
        id: uid(),
        date: today(),
        name: recipe.name,
        emoji: recipe.emoji,
        nutrients: recipeNutrition(recipe),
        source: "recipe",
      },
    ],
  };
}
