import { recipeNutrients } from "../../../../packages/shared/nutrition.mjs";
import { recipeFits } from "../../../../packages/shared/dietary.mjs";
import { allowedRecipes } from "./planning.mjs";
import {
  catalog,
  recipes,
  today,
  daysFromNow,
  daysLeft,
  uid,
  initialState,
  nutrition,
} from "../data/food.mjs";
export const MY_FRIDGE = "my-fridge";
export const defaultProfile = {
  name: "You",
  weightKg: "",
  heightM: "",
  activity: "Moderate",
  birthday: "",
  gender: "Prefer not to say",
  goal: "Less waste",
  cuisines: ["Mediterranean"],
  allergies: "",
  budgetCad: 65,
  city: "",
  complete: false,
};
export function upgradeState(raw) {
  const base = raw || initialState();
  return {
    ...base,
    schemaVersion: 4,
    profile: {
      targetMode: "auto",
      referenceSex: "",
      lifeStage: "Neither",
      diets: [],
      allergenAvoid: [],
      avatar: "",
      ...defaultProfile,
      ...base.profile,
    },
    goals: {
      kcal: 2000,
      protein: 75,
      carbs: 250,
      fat: 65,
      fiber: 28,
      ...base.goals,
    },
    fridges: (
      base.fridges || [
        {
          id: MY_FRIDGE,
          name: base.household || "My fridge",
          ownerId: "me",
          members: ["me", "roommate"],
          kind: "Fridge",
          shared: true,
        },
        {
          id: "ava-fridge",
          name: "Ava’s fridge",
          ownerId: "ava",
          members: ["ava"],
          kind: "Fridge",
          shared: true,
        },
        {
          id: "allen-pantry",
          name: "Allen’s fridge",
          ownerId: "allen",
          members: ["allen"],
          kind: "Fridge",
          shared: true,
        },
      ]
    ).map((f) => ({
      ...f,
      kind: "Fridge",
      name: f.kind === "Pantry" ? f.name.replace(/pantry/gi, "fridge") : f.name,
    })),
    members: base.members || [
      { id: "me", name: base.profile?.name || "You", demo: false },
      { id: "roommate", name: "Roommate", demo: true },
      { id: "ava", name: "Ava", demo: true },
      { id: "allen", name: "Allen", demo: true },
    ],
    activeFridgeId: base.activeFridgeId || MY_FRIDGE,
    items: base.items.map((i) => ({
      ...(catalog.find((c) => c.name === i.name) || {}),
      fridgeId: MY_FRIDGE,
      ownerId: "me",
      containerId: "",
      ...i,
      ...(!i.customNutrition && catalog.some((c) => c.name === i.name)
        ? Object.fromEntries(
            Object.entries(catalog.find((c) => c.name === i.name)).filter(
              ([k]) =>
                ![
                  "name",
                  "id",
                  "grams",
                  "expires",
                  "ownerId",
                  "fridgeId",
                  "containerId",
                ].includes(k),
            ),
          )
        : {}),
    })),
    friendItems: base.friendItems || [
      {
        ...catalog[6],
        id: "ava-chickpeas",
        fridgeId: "ava-fridge",
        ownerId: "ava",
        containerId: "",
        grams: 500,
        expires: daysFromNow(4),
      },
      {
        ...catalog[7],
        id: "allen-bread",
        fridgeId: "allen-pantry",
        ownerId: "allen",
        containerId: "",
        grams: 400,
        expires: daysFromNow(3),
      },
      {
        ...catalog[4],
        id: "ava-eggs",
        fridgeId: "ava-fridge",
        ownerId: "ava",
        containerId: "",
        grams: 300,
        expires: daysFromNow(7),
      },
    ],
    containers: (
      base.containers || [
        {
          id: "container-1",
          name: "Greens box",
          shape: "Box",
          lengthCm: 16,
          widthCm: 12,
          heightCm: 7,
          diameterCm: 0,
          tareGrams: 85,
          fridgeId: MY_FRIDGE,
        },
      ]
    ).map((c) => ({ count: 1, photo: "", densityByFood: {}, ...c })),
    completedGroceries:
      base.completedGroceries ||
      base.groceries
        .filter((g) => g.checked)
        .map((g) => ({ ...g, completedAt: new Date().toISOString() })),
    staples: base.staples || [
      ...new Map(
        base.items.map((i) => [
          i.name,
          {
            id: uid(),
            name: i.name,
            usualGrams: i.grams,
            minimumGrams: Math.round(i.grams * 0.25),
            enabled: true,
          },
        ]),
      ).values(),
    ],
    pointsLedger: base.pointsLedger || [],
    assignedChallenges: base.assignedChallenges || [],
    trades: base.trades || [],
    dinners: base.dinners || [],
    scannerEvents: base.scannerEvents || [],
    plans: base.plans || [],
    scannerSettings: {
      placement: "Outside fridge",
      trigger: "Door opens",
      transport: "Wi-Fi gateway",
      ...base.scannerSettings,
    },
    logs: base.logs.map((l) => ({ userId: "me", ...l })),
    challenges: base.challenges || [],
    demoMode: base.demoMode ?? true,
  };
}
export const allInventory = (s) => [...s.items, ...s.friendItems];
export const memberName = (s, id) =>
  id === "shared"
    ? "Household shared"
    : id === "me"
      ? s.profile.name || "You"
      : s.members.find((m) => m.id === id)?.name || "Unknown";
export const getFridgeItems = (s, id = s.activeFridgeId) =>
  allInventory(s).filter((i) => i.fridgeId === id && i.grams > 0);
export function containerVolume(c) {
  const h = Number(c.heightCm);
  const v =
    c.shape === "Cylinder"
      ? Math.PI * (Number(c.diameterCm) / 2) ** 2 * h
      : Number(c.lengthCm) * Number(c.widthCm) * h;
  return Number.isFinite(v) && v > 0 ? Math.round(v) : 0;
}
export function portionFromContainer(container, fillPercent, density) {
  const fill = Number(fillPercent),
    rho = Number(density);
  if (
    !Number.isFinite(fill) ||
    fill < 0 ||
    fill > 100 ||
    !Number.isFinite(rho) ||
    rho <= 0
  )
    throw Error(
      "Use a fill percentage from 0 to 100 and a positive food density.",
    );
  return Math.round(((containerVolume(container) * fill) / 100) * rho);
}
export function inventoryAmount(items, name) {
  return items
    .filter((i) => i.name === name && i.grams > 0)
    .reduce((sum, i) => sum + i.grams, 0);
}
export function recipeMissing(recipe, items, servings = 1) {
  return recipe.ingredients
    .map(([name, g]) => [
      name,
      Math.max(0, Math.round(g * servings - inventoryAmount(items, name))),
    ])
    .filter(([, g]) => g > 0);
}
export function ownAccessibleItems(s) {
  return allInventory(s).filter(
    (i) =>
      i.fridgeId === s.activeFridgeId &&
      ["me", "shared"].includes(i.ownerId) &&
      i.grams > 0,
  );
}
export function splitDeduction(items, ingredients, servings = 1) {
  let copy = items.map((i) => ({ ...i }));
  for (const [name, g] of ingredients) {
    let left = g * servings;
    for (const i of copy
      .filter((i) => i.name === name && i.grams > 0)
      .sort((a, b) =>
        (a.expires || "9999").localeCompare(b.expires || "9999"),
      )) {
      const take = Math.min(left, i.grams);
      i.grams = Math.round((i.grams - take) * 10) / 10;
      left -= take;
      if (left <= 0) break;
    }
    if (left > 0.001) throw Error("Not enough " + name + ".");
  }
  return copy;
}
export function recipeStats(recipe, servings = 1) {
  return recipeNutrients(recipe, catalog, servings);
}
export function makePersonalMeal(s, recipe) {
  if (!recipeFits(recipe, s.profile, catalog).safe)
    throw Error("This recipe conflicts with your dietary restrictions.");
  const eligible = ownAccessibleItems(s);
  if (recipeMissing(recipe, eligible).length)
    throw Error("You need enough of your own or household-shared ingredients.");
  const changed = splitDeduction(eligible, recipe.ingredients);
  return {
    ...s,
    items: s.items.map((i) => changed.find((x) => x.id === i.id) || i),
    friendItems: s.friendItems.map(
      (i) => changed.find((x) => x.id === i.id) || i,
    ),
    logs: [
      ...s.logs,
      {
        id: uid(),
        userId: "me",
        date: today(),
        name: recipe.name,
        emoji: recipe.emoji,
        source: "recipe",
        recipeId: recipe.id,
        cuisine: recipe.cuisine,
        nutrients: recipeStats(recipe),
      },
    ],
  };
}
export function logRemoval(s, id, grams, action = "eaten", actor = "me") {
  const item = allInventory(s).find((i) => i.id === id);
  if (!item || !Number.isFinite(grams) || grams <= 0 || grams > item.grams)
    throw Error("Choose an amount within the available quantity.");
  if (item.ownerId !== actor && item.ownerId !== "shared")
    throw Error(
      "Choose your food or household-shared food. Another person’s stock needs their approval.",
    );
  const change = (arr) =>
    arr.map((i) =>
      i.id === id
        ? { ...i, grams: Math.round((i.grams - grams) * 10) / 10 }
        : i,
    );
  return {
    ...s,
    items: change(s.items),
    friendItems: change(s.friendItems),
    logs:
      action === "eaten"
        ? [
            ...s.logs,
            {
              id: uid(),
              userId: actor,
              date: today(),
              name: item.name,
              emoji: item.emoji,
              grams,
              source: "fridge",
              nutrients: nutrition(item, grams),
            },
          ]
        : s.logs,
  };
}
export function putFood(s, item) {
  const fridge = s.fridges.find((f) => f.id === item.fridgeId);
  if (!fridge) throw Error("Choose a fridge.");
  if (!fridge.members.includes(item.ownerId) && item.ownerId !== "shared")
    throw Error("Choose an owner who belongs to this fridge.");
  if (!Number.isFinite(item.grams) || item.grams <= 0)
    throw Error("Enter a positive food weight.");
  const field = item.fridgeId === MY_FRIDGE ? "items" : "friendItems";
  return { ...s, [field]: [...s[field], { ...item, id: item.cameraEventId ? "camera-" + item.cameraEventId : uid() }] };
}
export function requestTrade(
  s,
  { offeredId, wantedId, offeredGrams, wantedGrams },
) {
  const a = allInventory(s).find((i) => i.id === offeredId),
    b = allInventory(s).find((i) => i.id === wantedId);
  if (
    !a ||
    !b ||
    a.id === b.id ||
    a.ownerId !== "me" ||
    b.ownerId === "me" ||
    b.ownerId === "shared" ||
    !s.fridges.find((f) => f.id === b.fridgeId)?.shared
  )
    throw Error("Offer your food and select food from a shared friend fridge.");
  if (
    !Number.isFinite(offeredGrams) ||
    !Number.isFinite(wantedGrams) ||
    offeredGrams <= 0 ||
    wantedGrams <= 0 ||
    offeredGrams > a.grams ||
    wantedGrams > b.grams
  )
    throw Error("The trade must fit both available quantities.");
  return {
    ...s,
    trades: [
      {
        id: uid(),
        offeredId,
        wantedId,
        offeredGrams,
        wantedGrams,
        fromId: "me",
        toId: b.ownerId,
        status: "pending",
        created: today(),
        offerName: a.name,
        wantName: b.name,
      },
      ...s.trades,
    ],
  };
}
export function resolveTrade(s, id, decision) {
  const trade = s.trades.find((t) => t.id === id);
  if (!trade || trade.status !== "pending")
    throw Error("This trade is no longer pending.");
  if (!["accepted", "declined", "cancelled"].includes(decision))
    throw Error("Choose a valid trade decision.");
  if (decision !== "accepted")
    return {
      ...s,
      trades: s.trades.map((t) =>
        t.id === id ? { ...t, status: decision } : t,
      ),
    };
  const all = allInventory(s);
  const a = all.find((i) => i.id === trade.offeredId),
    b = all.find((i) => i.id === trade.wantedId);
  if (
    !a ||
    !b ||
    a.ownerId !== trade.fromId ||
    b.ownerId !== trade.toId ||
    a.grams < trade.offeredGrams ||
    b.grams < trade.wantedGrams
  )
    throw Error("Stock changed. Cancel this request and create a new trade.");
  const updated = all.map((i) =>
    i.id === a.id
      ? { ...i, grams: i.grams - trade.offeredGrams }
      : i.id === b.id
        ? { ...i, grams: i.grams - trade.wantedGrams }
        : i,
  );
  const received = {
    ...b,
    id: uid(),
    grams: trade.wantedGrams,
    fridgeId: a.fridgeId,
    ownerId: "me",
    containerId: "",
  };
  const given = {
    ...a,
    id: uid(),
    grams: trade.offeredGrams,
    fridgeId: b.fridgeId,
    ownerId: b.ownerId,
    containerId: "",
  };
  const changed = [...updated, received, given];
  return {
    ...s,
    items: changed.filter((i) => i.fridgeId === MY_FRIDGE),
    friendItems: changed.filter((i) => i.fridgeId !== MY_FRIDGE),
    trades: s.trades.map((t) =>
      t.id === id ? { ...t, status: "accepted" } : t,
    ),
  };
}
export const recipeLibrary = recipes;
export function rankedRecipes(s) {
  return allowedRecipes(s);
}
function scoreRecipe(r, s, items) {
  const have = r.ingredients.length - recipeMissing(r, items).length;
  const soon = r.ingredients.filter(([n]) =>
    items.some((i) => i.name === n && daysLeft(i.expires) <= 2),
  ).length;
  const cuisine = s.profile.cuisines.includes(r.cuisine) ? 2 : 0;
  const goal = s.profile.goal;
  return (
    have * 5 +
    cuisine +
    (goal === "Less waste"
      ? soon * 3
      : goal === "Affordability"
        ? 5 - r.costCad
        : goal === "Bulking"
          ? recipeStats(r).protein / 10
          : 0)
  );
}
export function streak(logs, now = today()) {
  const dates = new Set(
    logs.filter((l) => (l.userId || "me") === "me").map((l) => l.date),
  );
  let d = new Date(now + "T12:00:00"),
    n = 0;
  if (!dates.has(now)) d.setDate(d.getDate() - 1);
  while (dates.has(d.toLocaleDateString("en-CA"))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}
export function weeklyPoints(logs) {
  const weekAgo = daysFromNow(-6);
  return (
    new Set(
      logs
        .filter(
          (l) =>
            (l.userId || "me") === "me" &&
            l.date >= weekAgo &&
            l.date <= today(),
        )
        .map((l) => l.date),
    ).size * 10
  );
}
export function wrapped(logs) {
  const mine = logs.filter((l) => (l.userId || "me") === "me");
  const foods = {},
    cuisines = {};
  for (const l of mine) {
    foods[l.name] = (foods[l.name] || 0) + 1;
    if (l.cuisine) cuisines[l.cuisine] = (cuisines[l.cuisine] || 0) + 1;
  }
  const top = (obj) =>
    Object.entries(obj).sort((a, b) => b[1] - a[1])[0]?.[0] ||
    "Still discovering";
  return {
    meals: mine.length,
    days: new Set(mine.map((l) => l.date)).size,
    topFood: top(foods),
    topCuisine: top(cuisines),
  };
}
export function planDinner(s, { recipeId, fridgeIds, servings, date }) {
  const r = recipeLibrary.find((r) => r.id === recipeId);
  if (
    !r ||
    !Number.isInteger(servings) ||
    servings < 1 ||
    servings > 20 ||
    !fridgeIds.length ||
    !date
  )
    throw Error("Choose a recipe, date, guests, and at least one fridge.");
  if (fridgeIds.some((id) => !s.fridges.find((f) => f.id === id)?.shared))
    throw Error("Only shared fridges can join a dinner plan.");
  const pool = allInventory(s).filter(
    (i) => fridgeIds.includes(i.fridgeId) && i.grams > 0,
  );
  const missing = recipeMissing(r, pool, servings);
  return {
    ...s,
    dinners: [
      {
        id: uid(),
        recipeId,
        fridgeIds,
        servings,
        date,
        status: "planned",
        name: r.name,
        missing,
      },
      ...s.dinners,
    ],
  };
}
export function scannerConfirmation(s, event) {
  const grams = Number(event.grams);
  let next = s;
  if (event.direction === "in") {
    const food = catalog.find((c) => c.name === event.foodName);
    if (!food) throw Error("Choose a catalog food.");
    next = putFood(s, {
      ...food,
      grams,
      fridgeId: event.fridgeId,
      ownerId: event.ownerId,
      containerId: event.containerId || "",
      expires: event.expires,
    });
  } else {
    next = logRemoval(s, event.itemId, grams, event.action);
  }
  return {
    ...next,
    scannerEvents: [
      {
        ...event,
        id: uid(),
        date: new Date().toISOString(),
        status: "confirmed",
        source: "simulated",
      },
      ...s.scannerEvents,
    ],
  };
}
export const sampleDeals = [
  {
    id: "d1",
    food: "Chickpeas",
    price: 1.49,
    regular: 1.99,
    unit: "540 mL can",
    store: "Sample neighbourhood market",
    pairs: ["Baby spinach", "Cherry tomatoes"],
    recipeId: "green",
  },
  {
    id: "d2",
    food: "Sourdough",
    price: 3.49,
    regular: 4.49,
    unit: "loaf",
    store: "Sample campus grocer",
    pairs: ["Avocado", "Eggs"],
    recipeId: "toast",
  },
  {
    id: "d3",
    food: "Greek yogurt",
    price: 4.99,
    regular: 6.49,
    unit: "750 g tub",
    store: "Sample neighbourhood market",
    pairs: ["Strawberries"],
    recipeId: "yogurt",
  },
];
