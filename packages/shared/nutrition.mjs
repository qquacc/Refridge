import { nutrientDefinitions } from "./data/cnf-nutrients.mjs";
export { nutrientDefinitions };
export const macroIds = {
  kcal: "208",
  protein: "203",
  carbs: "205",
  fat: "204",
  fiber: "291",
};
export function perPortion(food, grams) {
  const values = food.nutrientsPer100g || {};
  const n = Object.fromEntries(
    Object.entries(values)
      .filter(([, v]) => Number.isFinite(v))
      .map(([id, v]) => [id, Math.round(((v * grams) / 100) * 1000) / 1000]),
  );
  return {
    ...Object.fromEntries(
      Object.entries(macroIds).map(([key, id]) => [
        key,
        Number.isFinite(n[id])
          ? n[id]
          : Number.isFinite(food[key])
            ? (food[key] * grams) / 100
            : null,
      ]),
    ),
    cnf: n,
    source: food.nutritionSource || null,
  };
}
export function nutrientTotals(logs) {
  const totals = {},
    coverage = {};
  for (const l of logs) {
    for (const [id, value] of Object.entries(l.nutrients?.cnf || {})) {
      if (Number.isFinite(value)) {
        totals[id] = (totals[id] || 0) + value;
        coverage[id] =
          (coverage[id] || 0) +
          ((l.nutrients.cnfCoverage?.[id] ?? 1) >= 0.999 ? 1 : 0);
      }
    }
  }
  return { values: totals, coverage, entries: logs.length };
}
export function ageAt(birthday, date = new Date()) {
  if (!birthday) return null;
  const b = new Date(birthday + "T12:00:00");
  if (!Number.isFinite(b.getTime()) || b > date) return null;
  let age = date.getFullYear() - b.getFullYear();
  if (
    date.getMonth() < b.getMonth() ||
    (date.getMonth() === b.getMonth() && date.getDate() < b.getDate())
  )
    age--;
  return age;
}
export const goalSource =
  "https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/equations-estimate-energy-requirement.html";
export function automaticTargets(p, date = new Date()) {
  const age = ageAt(p.birthday, date),
    kg = Number(p.weightKg),
    cm = Number(p.heightM) * 100;
  const sex = p.referenceSex || { Man: "male", Woman: "female" }[p.gender];
  if (
    !age ||
    age < 14 ||
    !["male", "female"].includes(sex) ||
    !(kg > 0 && cm > 0) ||
    (p.lifeStage && p.lifeStage !== "Neither")
  )
    return {
      available: false,
      reason:
        "Add age (14+), height, weight, and a reference sex; pregnancy/lactation needs individually entered targets.",
    };
  const level =
    {
      Low: 0,
      Inactive: 0,
      Light: 1,
      "Low active": 1,
      Moderate: 2,
      Active: 2,
      High: 3,
      "Very high": 3,
      "Very active": 3,
    }[p.activity] ?? 0;
  const adult = age >= 19;
  const coefficients = adult
    ? sex === "male"
      ? [
          [753.07, -10.83, 6.5, 14.1],
          [581.47, -10.83, 8.3, 14.94],
          [1004.82, -10.83, 6.52, 15.91],
          [-517.88, -10.83, 15.61, 19.11],
        ]
      : [
          [584.9, -7.01, 5.72, 11.71],
          [575.77, -7.01, 6.6, 12.14],
          [710.25, -7.01, 6.54, 12.34],
          [511.83, -7.01, 9.07, 12.56],
        ]
    : sex === "male"
      ? [
          [-447.51, 3.68, 13.01, 13.15],
          [19.12, 3.68, 8.62, 20.28],
          [-388.19, 3.68, 12.66, 20.46],
          [-671.75, 3.68, 15.38, 23.25],
        ]
      : [
          [55.59, -22.25, 8.43, 17.07],
          [-297.54, -22.25, 12.77, 14.73],
          [-189.55, -22.25, 11.74, 18.34],
          [-709.59, -22.25, 18.22, 14.25],
        ];
  const [c, a, h, w] = coefficients[level];
  const kcal = Math.round(c + a * age + h * cm + w * kg + (adult ? 0 : 20));
  // A neutral AMDR planning split, not a bulking prescription: 50% carbohydrate, 20% protein, 30% fat.
  const targets = {
    kcal,
    protein: Math.round(Math.max(kg * (adult ? 0.8 : 0.85), (kcal * 0.2) / 4)),
    carbs: Math.round((kcal * 0.5) / 4),
    fat: Math.round((kcal * 0.3) / 9),
    fiber:
      sex === "male"
        ? age <= 50
          ? 38
          : 30
        : age < 19
          ? 26
          : age <= 50
            ? 25
            : 21,
  };
  return {
    available: true,
    age,
    referenceSex: sex,
    bmi: Math.round((kg / (cm / 100) ** 2) * 10) / 10,
    targets,
    source: goalSource,
    method: "Health Canada EER equations; 50/20/30 AMDR planning split",
    reference: adult ? "adult" : "adolescent",
  };
}
const info = {
  203: [
    "Protein",
    "Builds and repairs tissues and contributes amino acids.",
    "Sustained inadequate intake can affect tissue maintenance.",
  ],
  204: [
    "Total fat",
    "Provides energy and helps absorb fat-soluble vitamins.",
    "Very low long-term intake can limit essential fatty acids.",
  ],
  205: [
    "Carbohydrates",
    "A major source of fuel for daily activity.",
    "A single low day does not establish inadequate intake.",
  ],
  208: [
    "Energy",
    "Food energy supports movement, growth, and basic body functions.",
    "Persistent energy intake below needs can affect weight and energy levels.",
  ],
  291: [
    "Fibre",
    "Supports bowel function and contributes to dietary quality.",
    "Habitually low fibre may contribute to constipation.",
  ],
  301: [
    "Calcium",
    "Supports bones, teeth, muscles, and nerve signalling.",
    "Long-term low intake can compromise bone health.",
  ],
  303: [
    "Iron",
    "Helps red blood cells carry oxygen.",
    "Long-term inadequate intake can contribute to iron deficiency and anaemia.",
  ],
  304: [
    "Magnesium",
    "Supports many enzyme reactions, muscles, and nerves.",
    "Sustained deficiency can affect neuromuscular function.",
  ],
  305: [
    "Phosphorus",
    "Supports bones and cellular energy systems.",
    "Deficiency cannot be assessed from this diary alone.",
  ],
  306: [
    "Potassium",
    "Supports nerve signalling and muscle function.",
    "Low dietary intake over time can affect overall dietary quality.",
  ],
  307: [
    "Sodium",
    "Helps regulate fluid balance and nerve signals.",
    "A below-limit value is not a deficiency.",
  ],
  309: [
    "Zinc",
    "Supports immune function and tissue repair.",
    "Prolonged inadequate intake can impair growth and immune function.",
  ],
  312: [
    "Copper",
    "Supports iron metabolism and connective tissue.",
    "Deficiency needs clinical assessment, not a one-day food log.",
  ],
  317: [
    "Selenium",
    "Contributes to antioxidant enzymes and thyroid function.",
    "Both inadequate and excessive usual intake can be harmful.",
  ],
  814: [
    "Vitamin A (RAE)",
    "Supports normal vision and immune function.",
    "Persistent inadequate intake can affect vision.",
  ],
  323: [
    "Vitamin E",
    "Protects cells as an antioxidant.",
    "Deficiency is uncommon and cannot be diagnosed from this log.",
  ],
  339: [
    "Vitamin D",
    "Supports calcium absorption and bone health.",
    "Low long-term status can affect bones; intake is not a blood-level test.",
  ],
  401: [
    "Vitamin C",
    "Supports collagen production and iron absorption.",
    "Sustained deficiency can impair wound healing.",
  ],
  404: [
    "Thiamin (B1)",
    "Helps the body use food energy and supports nerves.",
    "Prolonged deficiency can affect nerves and energy metabolism.",
  ],
  405: [
    "Riboflavin (B2)",
    "Helps enzymes release energy from food.",
    "Long-term inadequate intake can affect skin and mucosal health.",
  ],
  415: [
    "Vitamin B6",
    "Supports amino-acid metabolism and red blood cells.",
    "Prolonged deficiency can affect blood and nerve function.",
  ],
  418: [
    "Vitamin B12",
    "Supports nerves and red blood cells.",
    "Persistent deficiency can cause anaemia and neurological problems.",
  ],
  815: [
    "Folate (DFE)",
    "Supports cell division and blood-cell formation.",
    "Prolonged inadequate intake can contribute to anaemia.",
  ],
  430: [
    "Vitamin K",
    "Supports normal blood clotting.",
    "Intake changes can matter for some medicines; a log cannot diagnose deficiency.",
  ],
  262: [
    "Caffeine",
    "A stimulant recorded for awareness, not an essential nutrient.",
    "There is no minimum caffeine requirement.",
  ],
  601: [
    "Cholesterol",
    "A dietary component; the body also produces it.",
    "No minimum dietary target is assigned.",
  ],
};
export function nutrientInfo(def) {
  if (info[def.id]) {
    const [name, role, risk] = info[def.id];
    return { name, role, risk };
  }
  const name = def.name,
    upper = name.toUpperCase();
  let role = "A measured food component with no separate target in this app.",
    risk =
      "No minimum intake is assigned to this field. Missing data does not establish deficiency.";
  if ((Number(def.id) >= 501 && Number(def.id) <= 518) || def.id === "828") {
    role =
      "An amino acid used in proteins and other body molecules. Assess it in the context of overall protein intake.";
    risk =
      "Individual amino-acid deficiency cannot be diagnosed from an incomplete food diary; adequate varied protein sources matter.";
  } else if (upper.includes("FATTY ACID")) {
    role = upper.includes("TRANS")
      ? "A trans-fat component of dietary fat; no minimum dietary requirement is assigned."
      : upper.includes("SATURATED") && !upper.includes("UNSATURATED")
        ? "A saturated-fat component. Fat provides energy and forms part of body structures."
        : upper.includes("N-3") || upper.includes("OMEGA  N-3")
          ? "An omega-3 fat measurement. Omega-3 fatty acids contribute to cell membranes and normal body function."
          : "An individual or grouped dietary fat measurement. Fat provides energy and contributes to cell membranes.";
    risk =
      "Do not interpret zero for an individual fatty acid as a diagnosed deficiency. Subtypes can overlap with total fat measurements.";
  } else if (
    /SUGAR|SACCARIDE|SUCROSE|GLUCOSE|FRUCTOSE|GALACTOSE|LACTOSE|MALTOSE|STARCH/.test(
      upper,
    )
  ) {
    role =
      "A carbohydrate measurement contributing to dietary energy. Individual sugars and starch are parts of total carbohydrates.";
    risk =
      "There is no separate minimum target for each sugar. Do not add sugar subtypes to total carbohydrates again.";
  } else if (/CAROTENE|CRYPTOXANTHIN|LYCOPENE|LUTEIN/.test(upper)) {
    role =
      "A carotenoid found in foods. Some carotenoids contribute to vitamin A activity; they are reported separately from total vitamin A.";
    risk =
      "No independent target is assigned here. Consider the vitamin A RAE field instead of diagnosing deficiency from a single carotenoid.";
  } else if (/TOCOPHEROL/.test(upper)) {
    role =
      "A form or added component of vitamin E. These fields overlap with vitamin E measurements.";
    risk =
      "Do not sum these forms on top of alpha-tocopherol. A single logged field does not diagnose vitamin E status.";
  } else if (/FOLACIN|FOLIC ACID|FOLATE/.test(upper)) {
    role =
      "A form of folate, which supports cell division and blood-cell formation. Dietary folate equivalents account for differing forms.";
    risk =
      "Use the DFE reference field for comparison; do not add overlapping folate measurements together.";
  } else if (/VITAMIN D/.test(upper)) {
    role =
      "A form or unit expression of vitamin D, which supports calcium absorption and bone health.";
    risk =
      "These fields can overlap with total D2+D3. Do not add international units to micrograms.";
  } else if (upper.includes("RETINOL")) {
    role =
      "Preformed vitamin A, contributing to normal vision and immune function.";
    risk =
      "This overlaps with vitamin A RAE. One low logged day does not establish vitamin A deficiency.";
  } else if (/PLANT STEROL|STIGMASTEROL|CAMPESTEROL|SITOSTEROL/.test(upper)) {
    role =
      "A plant sterol, a plant compound structurally related to cholesterol.";
  } else if (def.id === "255") {
    role =
      "Water present in food contributes to total fluid intake. Drinks and other water intake may not be fully logged.";
  } else if (def.id === "207") {
    role =
      "Ash is the measured mineral residue of food, not a separate nutrient to pursue as a dietary target.";
  } else if (def.id === "268") {
    role =
      "Food energy expressed in kilojoules; it describes the same energy also reported in kilocalories.";
    risk =
      "Do not add kilojoules and kilocalories together. 1 kcal equals 4.184 kJ.";
  } else if (def.id === "221") {
    role = "Alcohol contributes energy but is not an essential nutrient.";
  } else if (["260", "261", "550"].includes(def.id)) {
    role =
      "A sweetener or sugar-alcohol measurement. It is not an essential nutrient with a minimum intake requirement.";
  } else if (def.id === "245") {
    role =
      "Oxalic acid is a food compound, particularly in some plants. It is not an essential nutrient with a daily minimum.";
  } else if (def.id === "263") {
    role =
      "Theobromine is a cocoa-related compound. It is tracked as food composition, not as an essential nutrient.";
  } else if (
    ["406", "409", "410", "416", "862", "863", "874", "315"].includes(def.id)
  ) {
    const roles = {
      406: "Niacin contributes to enzymes involved in releasing energy from food.",
      409: "Niacin equivalents account for dietary niacin and its precursors.",
      410: "Pantothenic acid contributes to coenzyme A and energy metabolism.",
      416: "Biotin supports enzymes involved in carbohydrate, fat and protein metabolism.",
      862: "Choline contributes to cell membranes and the neurotransmitter acetylcholine.",
      863: "Betaine participates in methyl-group metabolism.",
      874: "Added B12 contributes to the same vitamin B12 functions as naturally occurring B12.",
      315: "Manganese contributes to enzymes involved in metabolism and tissue formation.",
    };
    role = roles[def.id];
    risk =
      "Persistent inadequate intake of essential nutrients needs assessment using the overall diet; an incomplete day cannot diagnose deficiency.";
  }
  return { name, role, risk };
}
export function microTargets(p, date = new Date()) {
  const age = ageAt(p.birthday, date),
    sex = p.referenceSex || { Man: "male", Woman: "female" }[p.gender];
  if (
    !age ||
    age < 14 ||
    !["male", "female"].includes(sex) ||
    (p.lifeStage && p.lifeStage !== "Neither")
  )
    return {};
  const m = sex === "male",
    teen = age < 19;
  return {
    301: teen ? 1300 : age > 70 || (!m && age > 50) ? 1200 : 1000,
    303: teen ? (m ? 11 : 15) : m || age > 50 ? 8 : 18,
    304: teen
      ? m
        ? 410
        : 360
      : m
        ? age > 30
          ? 420
          : 400
        : age > 30
          ? 320
          : 310,
    305: teen ? 1250 : 700,
    306: m ? (teen ? 3000 : 3400) : teen ? 2300 : 2600,
    309: m ? 11 : teen ? 9 : 8,
    312: teen ? 0.89 : 0.9,
    317: 55,
    814: m ? 900 : 700,
    323: 15,
    339: age > 70 ? 20 : 15,
    401: teen ? (m ? 75 : 65) : m ? 90 : 75,
    404: m ? 1.2 : 1.1,
    405: m ? 1.3 : 1.1,
    415: teen ? (m ? 1.3 : 1.2) : age > 50 ? (m ? 1.7 : 1.5) : 1.3,
    418: 2.4,
    815: 400,
    430: teen ? 75 : m ? 120 : 90,
  };
}
export function recipeNutrients(recipe, catalog, servings = 1) {
  const parts = recipe.ingredients.map(([name, g]) =>
    perPortion(catalog.find((c) => c.name === name) || {}, g * servings),
  );
  const out = {
    cnf: {},
    cnfCoverage: {},
    sources: recipe.ingredients
      .map(([name]) => catalog.find((c) => c.name === name)?.nutritionSource)
      .filter(Boolean),
  };
  for (const key of Object.keys(macroIds)) {
    const known = parts.filter((p) => Number.isFinite(p[key]));
    out[key] = known.length ? known.reduce((a, p) => a + p[key], 0) : null;
  }
  for (const part of parts)
    for (const [id, v] of Object.entries(part.cnf)) {
      out.cnf[id] = (out.cnf[id] || 0) + v;
      out.cnfCoverage[id] = (out.cnfCoverage[id] || 0) + 1 / parts.length;
    }
  return out;
}
