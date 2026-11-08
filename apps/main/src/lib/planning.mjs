import { recipeCosts } from "./costs.mjs";
import { calculateGoalTargets } from "../../../../packages/shared/goal-targets.mjs";
import { catalog, today, daysFromNow, uid } from "../data/food.mjs";
import { recipeFits } from "../../../../packages/shared/dietary.mjs";
import { mealRecipes, cuisines } from "../../../../packages/shared/recipes.mjs";
import {
  recipeNutrients,
} from "../../../../packages/shared/nutrition.mjs";
export { cuisines };
export function activeInventory(s, ids = [s.activeFridgeId]) {
  return [...s.items, ...s.friendItems].filter(
    (i) => i.grams > 0 && ids.includes(i.fridgeId),
  );
}
export function allowedRecipes(s, ids = [s.activeFridgeId]) {
  const pool = activeInventory(s, ids);
  const recent = s.logs.filter((l) => l.date >= daysFromNow(-7));
  const score = (r) => {
    const available =
      r.ingredients.reduce(
        (a, [name, g]) =>
          a +
          Math.min(
            1,
            pool
              .filter((i) => i.name === name)
              .reduce((n, i) => n + i.grams, 0) / g,
          ),
        0,
      ) / r.ingredients.length;
    const soon = r.ingredients.filter(([name]) =>
      pool.some(
        (i) => i.name === name && i.expires && i.expires <= daysFromNow(s.profile.goal === "Less waste" ? 3 : 2),
      ),
    ).length;
    const repetition = recent.filter((l) => l.recipeId === r.id).length;
    const cuisineCount = recent.filter((l) => l.cuisine === r.cuisine).length;
    const macros = recipeNutrients(r, catalog);
    return (
      available * (s.profile.goal === "Affordability" ? 30 : 20) +
      (s.profile.goal === "Bulking"
        ? (macros.protein || 0) / 10 + (macros.kcal || 0) / 500
        : 0) +
      (s.profile.cuisines.includes(r.cuisine) ? 2 : 0) +
      (s.profile.goal === "Less waste" ? soon * 2 : 0) -
      repetition * 4 -
      cuisineCount * 0.3
    );
  };
  return mealRecipes
    .filter((r) => recipeFits(r, s.profile, catalog).safe)
     .sort((a, b) => {
      if (s.profile.goal === "Affordability") {
        const x = recipeCosts(s, a, pool), y = recipeCosts(s, b, pool);
        if (x.purchaseComplete !== y.purchaseComplete) return x.purchaseComplete ? -1 : 1;
        if (x.purchaseComplete && y.purchaseComplete && Math.abs(x.checkout - y.checkout) > .01) return x.checkout - y.checkout;
        if (x.complete && y.complete && Math.abs(x.perServing - y.perServing) > .01) return x.perServing - y.perServing;
      }
      return score(b) - score(a);
    });
}
export function suggestCuisines(s) {
  const recipes = allowedRecipes(
    s,
    s.fridges.filter((f) => f.shared || f.ownerId === "me").map((f) => f.id),
  );
  const recommended = [...new Set(recipes.map((r) => r.cuisine))];
  const recent = s.logs.slice(-10).map((l) => l.cuisine);
  return [
    ...recommended,
    ...cuisines.filter((c) => !recommended.includes(c)),
  ].sort(
    (a, b) =>
      (recommended.includes(b) ? 4 : 0) -
      (recommended.includes(a) ? 4 : 0) +
      (recent.filter((x) => x === a).length -
        recent.filter((x) => x === b).length),
  );
}
export function reconcileGroceries(s) {
  const items = [...s.items, ...s.friendItems].filter(
    (i) =>
      s.fridges.find((f) => f.id === i.fridgeId)?.ownerId === "me" &&
      ["me", "shared"].includes(i.ownerId),
  );
  const pending = s.groceries.filter((g) => !g.checked && !g.auto),
    generated = [];
  for (const staple of s.staples || []) {
    if (!staple.enabled || (s.grocerySettings?.pauseUntil || 0) > Date.now()) continue;
    const available = items
      .filter((i) => i.name === staple.name)
      .reduce((a, i) => a + i.grams, 0);
    const lastComplete = (s.completedGroceries || [])
      .filter((c) => c.name.toLowerCase() === staple.name.toLowerCase())
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0];
    const snoozed =
      lastComplete &&
      Date.now() - new Date(lastComplete.completedAt).getTime() <
        12 * 60 * 60 * 1000;
    if (
      available < staple.minimumGrams &&
      !snoozed &&
      !pending.some((g) => g.name.toLowerCase() === staple.name.toLowerCase())
    )
      generated.push({
        id: "auto-" + staple.id,
        name: staple.name,
        grams: Math.max(0, staple.usualGrams - available),
        auto: true,
        stapleId: staple.id,
        reason: `${available} g left; usual stock ${staple.usualGrams} g`,
        checked: false,
      });
  }
  return { ...s, groceries: [...pending, ...generated] };
}
export function clearShoppingList(s, now = Date.now()) {
  return { ...s, groceries: [], grocerySettings: { ...s.grocerySettings, pauseUntil: now + 12 * 60 * 60 * 1000 } };
}
export function completeGrocery(s, id) {
  const item = s.groceries.find((g) => g.id === id);
  if (!item) return s;
  return {
    ...s,
    groceries: s.groceries.filter((g) => g.id !== id),
    completedGroceries: [
      { ...item, completedAt: new Date().toISOString() },
      ...(s.completedGroceries || []),
    ],
  };
}
export const challengeDefinitions = [
  {
    id: "cook",
    name: "Make a meal from your fridge",
    points: 30,
    reason: "Cook and log any suggested recipe.",
    test: (s) =>
      s.logs.some((l) => l.date === today() && l.source === "recipe"),
  },
  {
    id: "plants",
    name: "Bring three plant foods to your day",
    points: 20,
    reason: "Log three different fruit, vegetable, or legume foods.",
    test: (s) =>
      new Set(
        s.logs
          .filter((l) => l.date === today())
          .filter((l) =>
            catalog.some(
              (c) =>
                c.name === l.name &&
                ["Fruit", "Vegetables", "Protein"].includes(c.category) &&
                ![
                  "Eggs",
                  "Chicken breast",
                  "Salmon",
                  "Tuna",
                  "Shrimp",
                ].includes(c.name),
            ),
          )
          .map((l) => l.name),
      ).size >= 3,
  },
  {
    id: "plan",
    name: "Plan a shared meal",
    points: 15,
    reason: "Save a meal plan using two or more fridges.",
    test: (s) =>
      s.dinners.some(
        (d) => d.createdDate === today() && d.fridgeIds.length > 1,
      ),
  },
];
const extraChallenges = [
  {
    id: "fruit",
    name: "Add a fruit to your day",
    points: 15,
    reason: "Log a fruit food you ate.",
    test: (s) =>
      s.logs.some(
        (l) =>
          l.date === today() &&
          catalog.some((c) => c.name === l.name && c.category === "Fruit"),
      ),
  },
  {
    id: "legumes",
    name: "Try a legume",
    points: 20,
    reason: "Log beans, chickpeas, or lentils as food you ate.",
    test: (s) =>
      s.logs.some(
        (l) => l.date === today() && /beans|chickpeas|lentils/i.test(l.name),
      ),
  },
  {
    id: "explore",
    name: "Explore a different cuisine",
    points: 20,
    reason: "Cook a recipe from a cuisine absent from your earlier diary.",
    test: (s) =>
      s.logs.some(
        (l) =>
          l.date === today() &&
          l.source === "recipe" &&
          l.cuisine &&
          !s.logs.some(
            (old) => old.date < today() && old.cuisine === l.cuisine,
          ),
      ),
  },
];
export function reconcileChallenges(s) {
  let points = [...(s.pointsLedger || [])];
  const rotating = [...challengeDefinitions.slice(1), ...extraChallenges];
  const day = Math.floor(Date.parse(today() + "T12:00:00Z") / 86400000);
  const selected = [
    challengeDefinitions[0],
    rotating[day % rotating.length],
    rotating[(day + 1) % rotating.length],
  ];
  const assigned = selected.map((c) => ({
    ...c,
    assignmentId: today() + ":" + c.id,
    date: today(),
    completed: c.test(s) || points.some((p) => p.id === today() + ":" + c.id && (p.userId || "me") === "me"),
  }));
  for (const c of assigned)
    if (c.completed && !points.some((p) => p.id === c.assignmentId))
      points.push({
        id: c.assignmentId,
        date: today(),
        points: c.points,
        reason: c.name,
        userId: "me",
      });
  return {
    ...s,
    assignedChallenges: assigned.map(({ test, ...c }) => c),
    pointsLedger: points,
  };
}
export function periodKey(date, period) {
  const d = new Date(date + "T12:00:00");
  if (period === "daily") return date;
  if (period === "monthly") return date.slice(0, 7);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function pointsFor(ledger, user, period, date = today()) {
  const key = periodKey(date, period);
  return ledger
    .filter((p) => p.userId === user && periodKey(p.date, period) === key)
    .reduce((a, p) => a + p.points, 0);
}
export function learnUsualStock(s) {
  const totals = new Map();
  for (const i of [...s.items, ...s.friendItems])
    if (
      i.grams > 0 &&
      ["me", "shared"].includes(i.ownerId) &&
      s.fridges.find((f) => f.id === i.fridgeId)?.ownerId === "me"
    )
      totals.set(i.name, (totals.get(i.name) || 0) + i.grams);
  let staples = [...(s.staples || [])];
  for (const [name, grams] of totals) {
    const index = staples.findIndex((t) => t.name === name);
    if (index < 0)
      staples.push({
        id: "usual-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        name,
        usualGrams: grams,
        minimumGrams: Math.round(grams * 0.25),
        enabled: true,
        learned: true,
      });
    else if (!staples[index].manual && grams > staples[index].usualGrams)
      staples[index] = {
        ...staples[index],
        usualGrams: grams,
        minimumGrams: Math.round(grams * 0.25),
        learned: true,
      };
  }
  return { ...s, staples };
}
export function refreshDerived(s) {
  let next = reconcileGroceries(learnUsualStock(s));
  next = reconcileChallenges(next);
  if (next.profile.targetMode !== "manual") {
    const calculated = calculateGoalTargets(next.profile);
    next = {
      ...next,
      targetCalculation: calculated,
      goals: calculated.available
        ? { ...next.goals, ...calculated.targets }
        : next.goals,
    };
  }
  return next;
}
export function createTradeRequest(s, { wantedId, offeredId }) {
  const all = [...s.items, ...s.friendItems];
  const want = all.find((i) => i.id === wantedId),
    offer = offeredId ? all.find((i) => i.id === offeredId) : null;
  if (!want || want.ownerId === "me")
    throw Error("Select food belonging to someone else.");
  if (offer && offer.ownerId !== "me") throw Error("Offer food you own.");
  return {
    ...s,
    trades: [
      {
        id: uid(),
        type: "in-person",
        wantedId,
        offeredId: offer?.id || null,
        wantName: want.name,
        offerName: offer?.name || "Free request",
        toId: want.ownerId,
        status: "pending",
        created: today(),
        note: "Discuss quantity and exchange in person; no automatic stock transfer.",
      },
      ...s.trades,
    ],
  };
}
