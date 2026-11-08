import { microTargets, perPortion } from "../../../../packages/shared/nutrition.mjs";
import { daysLeft } from "../data/food.mjs";

// Friendly names and units for nutrients that have a daily reference.
export const highlightNutrients = {
  203: ["Protein", "g"], 291: ["Fibre", "g"], 301: ["Calcium", "mg"], 303: ["Iron", "mg"], 304: ["Magnesium", "mg"],
  305: ["Phosphorus", "mg"], 306: ["Potassium", "mg"], 309: ["Zinc", "mg"], 312: ["Copper", "mg"], 317: ["Selenium", "µg"],
  814: ["Vitamin A", "µg"], 323: ["Vitamin E", "mg"], 339: ["Vitamin D", "µg"], 401: ["Vitamin C", "mg"], 404: ["Thiamin (B1)", "mg"],
  405: ["Riboflavin (B2)", "mg"], 415: ["Vitamin B6", "mg"], 418: ["Vitamin B12", "µg"], 815: ["Folate", "µg"], 430: ["Vitamin K", "µg"],
};
// Health Canada label Daily Values, used until the profile has enough detail for personal references.
const labelDailyValues = { 203: 50, 291: 28, 301: 1300, 303: 18, 304: 420, 305: 1250, 306: 3400, 309: 11, 312: 0.9, 317: 55, 814: 900, 323: 15, 339: 20, 401: 90, 404: 1.2, 405: 1.3, 415: 1.7, 418: 2.4, 815: 400, 430: 120 };

export function dailyReferences(profile = {}, goals = {}) {
  const personal = microTargets(profile);
  const refs = { ...labelDailyValues, ...personal };
  if (Number(goals.protein) > 0) refs[203] = Number(goals.protein);
  if (Number(goals.fiber) > 0) refs[291] = Number(goals.fiber);
  return { refs, personal: Object.keys(personal).length > 0 };
}

const per100 = (food) => {
  const values = { ...(food.nutrientsPer100g || {}) };
  if (!Number.isFinite(values[203]) && Number.isFinite(food.protein)) values[203] = food.protein;
  if (!Number.isFinite(values[291]) && Number.isFinite(food.fiber)) values[291] = food.fiber;
  return values;
};

// Ranks nutrients by how much of a day's reference 100 g of this food provides.
export function foodHighlights(food, profile, goals, limit = 3) {
  const { refs, personal } = dailyReferences(profile, goals), values = per100(food), grams = Number(food.grams) || 0;
  const ranked = Object.entries(highlightNutrients)
    .filter(([id]) => Number.isFinite(values[id]) && values[id] > 0 && refs[id] > 0)
    .map(([id, [name, unit]]) => ({ id, name, unit, per100g: values[id], percent100g: values[id] / refs[id] * 100, inItem: values[id] * grams / 100, percentItem: values[id] * grams / 100 / refs[id] * 100 }))
    .sort((a, b) => b.percent100g - a.percent100g);
  return { top: ranked[0] || null, others: ranked.slice(1, limit), personal };
}

export function itemMacros(food) {
  const n = perPortion(food, Number(food.grams) || 0);
  return { kcal: n.kcal, protein: n.protein, carbs: n.carbs, fat: n.fat };
}

export function freshness(expires) {
  if (!expires) return { tone: "unknown", label: "No date saved", short: "No date", ratio: null, left: null };
  const left = daysLeft(expires);
  const tone = left < 0 ? "past" : left <= 1 ? "urgent" : left <= 3 ? "soon" : "fresh";
  const label = left < 0 ? `Past saved date by ${-left} ${-left === 1 ? "day" : "days"}` : left === 0 ? "Use today" : left === 1 ? "1 day left" : `${left} days left`;
  const short = left < 0 ? "Past date" : left === 0 ? "Today" : `${left}d`;
  return { tone, label, short, left, ratio: Math.max(0, Math.min(1, left / 14)) };
}

export const formatAmount = (value, unit) => {
  if (!Number.isFinite(value)) return "—";
  const digits = value >= 100 ? 0 : value >= 10 ? 1 : value >= 1 ? 1 : 2;
  return `${Number(value.toFixed(digits)).toLocaleString()} ${unit}`;
};
