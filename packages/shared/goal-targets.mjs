import { automaticTargets } from "./nutrition.mjs";
export const goalSources = {
  protein: "https://pmc.ncbi.nlm.nih.gov/articles/PMC5477153/",
  surplus: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10620361/",
  budget: "https://food-guide.canada.ca/en/tips-for-healthy-eating/healthy-eating-on-a-budget/",
};
export function calculateGoalTargets(profile, date = new Date()) {
  const base = automaticTargets(profile, date);
  if (!base.available) return { ...base, priority: profile.goal };
  if (!Number.isFinite(base.targets.kcal) || base.targets.kcal <= 0) return { available: false, reason: "Check your age, height, weight, and activity inputs before calculating targets.", priority: profile.goal };
  const result = { ...base, baseTargets: { ...base.targets }, priority: profile.goal, adjustmentKcal: 0,
    method: base.method, note: "Maintenance reference. Priorities change your planning calculations without reducing nutrition targets." };
  if (profile.goal !== "Bulking") return result;
  if (base.age < 19) return { ...result, note: "The automatic bulking adjustment is for adults only. This profile keeps its existing age-appropriate reference targets." };
  const requestedSurplus = Number(profile.bulkingSurplusPercent ?? 5), requestedProtein = Number(profile.bulkingProteinPerKg ?? 1.8);
  const surplus = Number.isFinite(requestedSurplus) ? Math.max(0, Math.min(10, requestedSurplus)) : 5;
  const factor = Number.isFinite(requestedProtein) ? Math.max(1.4, Math.min(2, requestedProtein)) : 1.8;
  const kcal = Math.round(base.targets.kcal * (1 + surplus / 100));
  const requestedGrams = Math.round(Number(profile.weightKg) * factor);
  const protein = Math.min(requestedGrams, Math.floor(kcal * 0.25 / 4));
  const fat = Math.round(kcal * 0.30 / 9), carbs = Math.round((kcal - 4 * protein - 9 * fat) / 4);
  return { ...result, targets: { ...base.targets, kcal, protein, fat, carbs }, adjustmentKcal: kcal - base.targets.kcal,
    surplusPercent: surplus, proteinPerKg: factor, proteinCapped: protein < requestedGrams,
    method: "Maintenance × surplus; body-weight protein; 30% energy from fat; carbohydrate from remaining energy",
    note: "An approximate adult resistance-training plan, not a prediction of muscle gain. Protein is capped at 25% of planned energy so the carbohydrate share stays at least about 45%. Fibre keeps the existing reference." };
}
