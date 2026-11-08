import { readFile } from "node:fs/promises";
import path from "node:path";
import { canadianCatalog } from "../packages/shared/data/cnf-catalog.mjs";
let database, index;
export async function loadNutrition() {
  if (!database) {
    let bytes;
    try {
      bytes = await readFile(
        new URL("./data/cnf-foods.json", import.meta.url),
        "utf8",
      );
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
      bytes = await readFile(
        path.join(process.cwd(), "backend/data/cnf-foods.json"),
        "utf8",
      );
    }
    database = JSON.parse(bytes);
    index = new Map(database.map((f) => [f.id, f]));
  }
  return database;
}
export function canadianFood(id) {
  const curated = canadianCatalog.find((c) => c.cnfId === String(id));
  if (curated) return curated;
  const r = index?.get(String(id));
  if (!r) return null;
  const ids = {
    kcal: "208",
    protein: "203",
    carbs: "205",
    fat: "204",
    fiber: "291",
  };
  return {
    name: r.name,
    description: r.name,
    cnfId: r.id,
    category: "Other",
    emoji: "🍽️",
    color: "#e8ece2",
    nutrientsPer100g: r.values,
    densityReference: r.densityReference,
    nutritionSource: {
      publisher: "Health Canada",
      dataset: "Canadian Nutrient File 2015",
      foodId: r.id,
      url: "https://aliments-nutrition.canada.ca/cnf-fce/?lang=eng",
    },
    ...Object.fromEntries(
      Object.entries(ids).map(([k, n]) => [k, r.values[n] ?? null]),
    ),
  };
}
export async function searchNutrition(query) {
  const all = await loadNutrition();
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  return all
    .map((f) => ({
      f,
      score: terms.reduce(
        (n, t) => n + (f.name.toLowerCase().includes(t) ? 1 : 0),
        0,
      ),
    }))
    .filter((x) => x.score === terms.length)
    .sort((a, b) => a.f.name.length - b.f.name.length)
    .slice(0, 25)
    .map(({ f }) => canadianFood(f.id));
}
