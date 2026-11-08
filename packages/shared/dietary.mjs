export const dietaryChoices = [
  "Vegetarian",
  "Vegan",
  "Gluten-free",
  "Dairy-free",
  "Halal preference",
  "Kosher preference",
];
export const allergens = [
  "Peanuts",
  "Tree nuts",
  "Milk",
  "Eggs",
  "Soy",
  "Wheat",
  "Sesame",
  "Fish",
  "Shellfish",
  "Mustard",
  "Sulphites",
];
const words = {
  peanuts: /\b(peanut|groundnut|arachis)/i,
  "tree nuts":
    /\b(almond|walnut|cashew|pecan|pistachio|hazelnut|macadamia|brazil nut|pine nut)/i,
  milk: /\b(milk|yog[ou]+rt|yogurt|cheese|feta|cheddar|mozzarella|cream|whey|casein|butter)\b/i,
  eggs: /\begg(s|nog)?\b/i,
  soy: /\b(soy|tofu|edamame|tempeh|miso|shoyu|tamari)/i,
  wheat:
    /\b(wheat|bread|sourdough|pasta|spaghetti|couscous|bulgur|flour tortilla|tortilla|soy sauce)/i,
  sesame: /\b(sesame|tahini)/i,
  fish: /\b(fish|salmon|tuna|trout|cod|sardine|anchov)/i,
  shellfish:
    /\b(shrimp|prawn|crab|lobster|clam|mussel|oyster|scallop|shellfish)/i,
  mustard: /\bmustard\b/i,
  sulphites: /\b(sulphite|sulfite|sulphur dioxide)/i,
};
export function foodAllergens(food) {
  const text = [food.name, food.description, ...(food.ingredients || [])].join(
    " ",
  );
  return [
    ...new Set([
      ...(food.allergens || []).map((a) => a.toLowerCase()),
      ...Object.entries(words)
        .filter(([, re]) => re.test(text))
        .map(([name]) => name),
    ]),
  ].filter(
    (a) =>
      !(
        a === "milk" &&
        !words.milk.test(
          text.replace(/peanut butter|coconut milk|almond milk|soy milk/gi, ""),
        )
      ),
  );
}
export function restrictions(profile) {
  const text = (profile.allergies || "").toLowerCase();
  const chosen = (profile.allergenAvoid || []).map((a) => a.toLowerCase());
  for (const key of Object.keys(words)) {
    if (words[key].test(text) || text.includes(key)) chosen.push(key);
  }
  return {
    avoid: new Set(chosen),
    diets: new Set(
      [
        ...(profile.diets || []),
        ...dietaryChoices.filter((d) => text.includes(d.toLowerCase())),
      ].map((d) => d.toLowerCase()),
    ),
  };
}
export function foodFits(food, profile) {
  const r = restrictions(profile);
  const tags = foodAllergens(food);
  const reasons = tags.filter((a) => r.avoid.has(a));
  const text = [food.name, food.description].join(" ").toLowerCase();
  if (
    r.diets.has("vegan") &&
    (/chicken|beef|pork|turkey|lamb|fish|salmon|tuna|shrimp|shellfish|crab|lobster|clam|mussel|oyster|honey/.test(
      text,
    ) ||
      tags.some((a) => ["milk", "eggs", "fish", "shellfish"].includes(a)))
  )
    reasons.push("vegan preference");
  if (
    r.diets.has("vegetarian") &&
    /chicken|beef|pork|turkey|lamb|fish|salmon|tuna|shrimp|shellfish|crab|lobster|clam|mussel|oyster/.test(
      text,
    )
  )
    reasons.push("vegetarian preference");
  if (
    r.diets.has("gluten-free") &&
    (/wheat|barley|rye|bulgur|couscous|sourdough/.test(text) ||
      tags.includes("wheat"))
  )
    reasons.push("gluten-free preference");
  if (r.diets.has("dairy-free") && tags.includes("milk"))
    reasons.push("dairy-free preference");
  if (
    r.diets.has("halal preference") &&
    /pork|bacon|ham\b|alcohol|wine|beer/.test(text)
  )
    reasons.push("halal preference");
  if (
    r.diets.has("kosher preference") &&
    (/pork|bacon|ham\b/.test(text) || tags.includes("shellfish"))
  )
    reasons.push("kosher preference");
  return { safe: !reasons.length, reasons: [...new Set(reasons)] };
}
export function recipeFits(recipe, profile, catalog) {
  const reasons = [];
  for (const [name] of recipe.ingredients) {
    const food = catalog.find((f) => f.name === name);
    if (!food) {
      reasons.push("Unknown ingredient: " + name);
      continue;
    }
    for (const reason of foodFits(food, profile).reasons)
      reasons.push(name + ": " + reason);
  }
  const r = restrictions(profile);
  if (r.diets.has("kosher preference")) {
    const tags = recipe.ingredients.flatMap(([n]) =>
      foodAllergens(catalog.find((c) => c.name === n) || { name: n }),
    );
    const meat = recipe.ingredients.some(([n]) =>
      /chicken|beef|pork|turkey|lamb/i.test(n),
    );
    if (meat && tags.includes("milk"))
      reasons.push("meat and milk combination");
  }
  return { safe: !reasons.length, reasons };
}
