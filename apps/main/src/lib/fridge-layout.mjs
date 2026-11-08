export const fridgeSections = [
  { id: "condiments", title: "Spices & condiments", detail: "Top shelf", emoji: "🫙" },
  { id: "prepared", title: "Ready-to-eat & leftovers", detail: "Meal shelf", emoji: "🍱" },
  { id: "dairy", title: "Dairy, eggs & drinks", detail: "Everyday shelf", emoji: "🥛" },
  { id: "fruit", title: "Fruit", detail: "Produce shelf", emoji: "🍓" },
  { id: "staples", title: "Grains & plant proteins", detail: "Staples shelf", emoji: "🌾" },
  { id: "vegetables", title: "Vegetables", detail: "Vegetable drawer", emoji: "🥬" },
  { id: "meat", title: "Meat & seafood", detail: "Bottom drawer", emoji: "🐟" },
];
export function fridgeCategory(food) {
  const category = String(food.category || "").toLowerCase(), name = String(food.name || "").toLowerCase();
  if (/condiment|spice|seasoning|sauce|oil|spread/.test(category)) return "condiments";
  if (/prepared|dish|meal|leftover/.test(category)) return "prepared";
  if (/meat|fish|seafood|poultry/.test(category)) return "meat";
  if (/vegetable|legume/.test(category)) return "vegetables";
  if (/fruit/.test(category)) return "fruit";
  if (/dairy|egg|beverage|drink/.test(category)) return "dairy";
  if (/\b(pizza|salad|sandwich|curry|soup|stew|casserole|cooked|leftover)\b/.test(name)) return "prepared";
  if (/\b(peppercorn|spice|condiment|ketchup|mustard|mayonnaise|dressing|sauce|salsa|jam|oil|vinegar|salt|cinnamon)\b/.test(name)) return "condiments";
  if (/\b(beef|chicken|turkey|pork|lamb|salmon|tuna|fish|shrimp|steak|meat)\b/.test(name)) return "meat";
  if (/\b(milk|yogurt|yoghurt|cheese|eggs?|butter|juice|drink)\b/.test(name)) return "dairy";
  if (/grain|protein/.test(category)) return "staples";
  return "prepared";
}
export function groupFridgeFoods(foods) {
  const groups = fridgeSections.map((section) => ({ ...section, foods: [] }));
  for (const food of foods) if (Number.isFinite(Number(food.grams)) && Number(food.grams) > 0) groups.find((g) => g.id === fridgeCategory(food)).foods.push(food);
  for (const group of groups) group.foods.sort((a, b) => (a.expires || "9999").localeCompare(b.expires || "9999") || a.name.localeCompare(b.name));
  return groups;
}
