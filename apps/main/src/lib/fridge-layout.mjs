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

// Physical fridge zones used by the home-screen fridge illustration.
// The upper compartment has four shelves (the last split into fruit and
// vegetables), the lower compartment has two frosted drawers, and the open door
// holds three trays: spreads, drinks, and sauces.
export const fridgeZones = [
  { id: "shelf-dairy", place: "shelf", title: "Dairy & eggs", emoji: "🥚" },
  { id: "shelf-meals", place: "shelf", title: "Leftovers & ready meals", emoji: "🍱" },
  { id: "shelf-staples", place: "shelf", title: "Grains & plant proteins", emoji: "🌾" },
  { id: "crisper-fruit", place: "shelf", title: "Fruit", emoji: "🍓" },
  { id: "crisper-veg", place: "shelf", title: "Vegetables", emoji: "🥬" },
  { id: "drawer-seafood", place: "drawer", title: "Seafood", emoji: "🐟" },
  { id: "drawer-meat", place: "drawer", title: "Meat & poultry", emoji: "🥩" },
  { id: "door-spreads", place: "tray", title: "Spreads & butter", emoji: "🧈" },
  { id: "door-drinks", place: "tray", title: "Milk & drinks", emoji: "🧃" },
  { id: "door-sauces", place: "tray", title: "Sauces", emoji: "🫙" },
];
const lower = (v) => String(v || "").toLowerCase();
const isDrink = (food) => /beverage|drink|juice/.test(lower(food.category))
  || /\b(milk|juice|drink|water|soda|kombucha|kefir|lemonade|smoothie|beer|wine|cola|tea|coffee)\b/.test(lower(food.name));
const isSpread = (food) => /\b(butter|jam|jelly|marmalade|spread|tahini|honey|pesto|hummus|cream cheese|nutella)\b/.test(lower(food.name));
const isSauce = (food) => /\b(sauce|ketchup|mustard|mayo|mayonnaise|dressing|salsa|syrup|relish|chutney|vinegar|miso|sriracha|condiment)\b/.test(lower(food.name));
const isSeafood = (food) => /fish|seafood|shellfish/.test(lower(food.category))
  || /\b(salmon|tuna|cod|fish|shrimp|prawns?|crab|lobster|sardines?|trout|scallops?|mussels?|clams?|halibut|tilapia|mackerel|anchov\w*|squid|octopus)\b/.test(lower(food.name));
export function fridgeZone(food) {
  if (/\b(juice|smoothie|kombucha|soda|lemonade)\b/.test(lower(food.name))) return "door-drinks";
  if (isSpread(food)) return "door-spreads";
  if (isSauce(food)) return "door-sauces";
  const category = fridgeCategory(food);
  if (category === "dairy") return isDrink(food) ? "door-drinks" : "shelf-dairy";
  if (category === "meat") return isSeafood(food) ? "drawer-seafood" : "drawer-meat";
  return { condiments: "door-sauces", prepared: "shelf-meals", staples: "shelf-staples", fruit: "crisper-fruit", vegetables: "crisper-veg" }[category];
}
export function zoneFridgeFoods(foods) {
  const zones = fridgeZones.map((zone) => ({ ...zone, foods: [] }));
  for (const food of foods) if (Number.isFinite(Number(food.grams)) && Number(food.grams) > 0) zones.find((z) => z.id === fridgeZone(food)).foods.push(food);
  for (const zone of zones) zone.foods.sort((a, b) => (a.expires || "9999").localeCompare(b.expires || "9999") || a.name.localeCompare(b.name));
  return Object.fromEntries(zones.map((z) => [z.id, z]));
}
const emojiWords = [
  [/juice|smoothie/, "🧃"], [/grapefruit|orange|mandarin|clementine|tangerine|kumquat/, "🍊"], [/lemon|lime/, "🍋"], [/cherr|acerola/, "🍒"], [/apricot|peach|nectarine/, "🍑"],
  [/mango/, "🥭"], [/melon|cantaloupe|honeydew/, "🍈"], [/watermelon/, "🍉"], [/kiwi/, "🥝"], [/pear\b/, "🍐"], [/apple/, "🍎"], [/grape/, "🍇"],
  [/berr|currant/, "🫐"], [/banana|plantain/, "🍌"], [/pineapple/, "🍍"], [/coconut/, "🥥"], [/avocado/, "🥑"], [/tomato/, "🍅"],
  [/lettuce|spinach|kale|chard|cabbage|greens|arugula|bok choy/, "🥬"], [/broccoli|cauliflower/, "🥦"], [/carrot/, "🥕"], [/pepper/, "🫑"],
  [/cucumber|zucchini|squash/, "🥒"], [/corn/, "🌽"], [/potato/, "🥔"], [/onion|leek|shallot/, "🧅"], [/garlic/, "🧄"], [/mushroom/, "🍄"],
  [/eggplant/, "🍆"], [/bean|lentil|chickpea/, "🫘"], [/pea\b|peas\b|edamame/, "🫛"], [/egg\b|eggs\b/, "🥚"], [/cheese|cheddar|feta|mozzarella|brie/, "🧀"],
  [/yogurt|yoghurt|milk|kefir|cream/, "🥛"], [/butter/, "🧈"], [/juice|smoothie/, "🧃"], [/chicken|turkey|poultry/, "🍗"], [/beef|steak|pork|lamb|ham|bacon|sausage/, "🥩"],
  [/salmon|tuna|cod|fish|trout|sardine/, "🐟"], [/shrimp|prawn/, "🍤"], [/crab|lobster/, "🦀"], [/bread|bagel|bun|roll/, "🍞"], [/rice/, "🍚"],
  [/pasta|noodle|spaghetti/, "🍝"], [/pizza/, "🍕"], [/soup|stew|broth/, "🍲"], [/curry/, "🍛"], [/salad/, "🥗"], [/sandwich/, "🥪"], [/tofu/, "🍱"],
  [/honey/, "🍯"], [/sauce|ketchup|salsa|jam|dressing|mustard|mayo|pesto/, "🫙"], [/nut|almond|walnut|cashew|pecan/, "🌰"],
];
// Prefers the saved emoji; otherwise picks a recognisable one from the food name.
export function foodEmoji(food) {
  if (food.emoji && food.emoji !== "🍽️") return food.emoji;
  const name = String(food.name || "").toLowerCase();
  return emojiWords.find(([pattern]) => pattern.test(name))?.[1] || "🍽️";
}
