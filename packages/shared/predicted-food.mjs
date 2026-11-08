const macroIds = { kcal: "208", protein: "203", carbs: "205", fat: "204", fiber: "291" };
export function buildPredictedFood({ name, ingredients = [], reference = null, method = "reference" }) {
  const total = ingredients.reduce((n, i) => n + (i.estimatedPercent ?? 0), 0);
  const complete = ingredients.length > 0 && ingredients.every((i) => Number.isFinite(i.estimatedPercent) && i.estimatedPercent > 0 && i.reference) && Math.abs(total - 100) < 0.01;
  if (method === "ingredients" && !complete) throw Error("Match every ingredient and make the percentages total 100 before using ingredient nutrition.");
  let values = {}, source;
  if (method === "ingredients") {
    const ids = new Set(ingredients.flatMap((i) => Object.keys(i.reference.nutrientsPer100g || {})));
    for (const id of ids) {
      if (ingredients.every((i) => Number.isFinite(i.reference.nutrientsPer100g?.[id])))
        values[id] = Math.round(ingredients.reduce((n, i) => n + i.reference.nutrientsPer100g[id] * i.estimatedPercent / 100, 0) * 1000) / 1000;
    }
    source = { publisher: "Health Canada", dataset: "Canadian Nutrient File 2015", method: "Estimated ingredient mixture", foodIds: ingredients.map((i) => i.reference.cnfId) };
  } else if (reference) {
    values = { ...reference.nutrientsPer100g };
    source = { ...reference.nutritionSource, method: "Approximate dish reference" };
  } else source = { method: "Unmatched dish; nutrition unknown" };
  return {
    name, description: name, category: "Prepared dishes", emoji: "🍽️", color: "#e8ece2",
    cnfId: method === "reference" ? reference?.cnfId || null : null,
    nutrientsPer100g: values,
    ...Object.fromEntries(Object.entries(macroIds).map(([k, id]) => [k, Number.isFinite(values[id]) ? values[id] : null])),
    nutritionSource: source, estimated: true, estimateMethod: "camera-dish-prediction",
    ingredients: ingredients.map(({ name, estimatedPercent, reference }) => ({ name, estimatedPercent, cnfId: reference?.cnfId || null })),
  };
}
