import { initialState, catalog, nutrition, recipes, recipeNutrition } from '../apps/main/src/data/food.mjs';
import { upgradeState } from '../apps/main/src/lib/domain.mjs';
import { refreshDerived } from '../apps/main/src/lib/planning.mjs';
export function sampleState(now = Date.now()) {
  const date = (offset) => { const d = new Date(now); d.setDate(d.getDate() + offset); return d.toLocaleDateString('en-CA'); };
  const state = upgradeState({ ...initialState(), items: [], logs: [], groceries: [] });
  state.profile = { ...state.profile, name: 'Nathaniel', birthday: '1998-05-18', weightKg: 76, heightM: 1.78, gender: 'Man', referenceSex: 'male', activity: 'Moderate', goal: 'Less waste', complete: true };
  state.household = "Nathaniel's Kitchen";
  state.onboarding = { completed: true, version: 2 };
  state.sampleAccount = true;
  state.sampleDataVersion = 3;
  state.containers = [];
  state.socialSettings = { enabled: false };
  state.members = [{ id: 'me', name: 'Nathaniel' }, { id: 'allen', name: 'Allen', demo: true }, { id: 'ava', name: 'Ava', demo: true }];
  state.fridges = [
    { id: 'my-fridge', name: "Nathaniel's Kitchen", ownerId: 'me', members: ['me'], shared: true, kind: 'Fridge' },
    { id: 'allen-fridge', name: "Allen's Fridge", ownerId: 'allen', members: ['allen'], shared: true, kind: 'Fridge' },
    { id: 'ava-fridge', name: "Ava's Fridge", ownerId: 'ava', members: ['ava'], shared: true, kind: 'Fridge' },
  ];
  state.items = catalog.filter((_, i) => i < 14 || [24, 25, 27, 28, 37, 38, 39, 42, 46].includes(i)).map((food, i) => ({ ...food, id: `sample-food-${i}`, fridgeId: 'my-fridge', ownerId: 'me', grams: [250, 450, 600, 300, 360, 200][i % 6], expires: date(1 + i % 12) }));
  state.friendItems = ['allen', 'ava'].flatMap((owner, j) => catalog.slice(5 + j * 3, 10 + j * 3).map((food, i) => ({ ...food, id: `sample-${owner}-${i}`, fridgeId: `${owner}-fridge`, ownerId: owner, grams: 300 + i * 80, expires: date(2 + i) })));
  state.logs = Array.from({ length: 90 }, (_, day) => Array.from({ length: 7 }, (_, meal) => {
    const food = catalog[[2, 28, 38, 8, 10, 0, 17][meal]], grams = 110 + (day + meal) % 5 * 35;
    return { id: `sample-log-${day}-${meal}`, date: date(-day), userId: 'me', name: food.name, emoji: food.emoji, grams, nutrients: nutrition(food, grams), source: 'Sample diary · Canadian food reference', estimated: true };
  })).flat();
  state.wellbeing = { checkIns: Array.from({ length: 90 }, (_, i) => ({ date: date(-i), mood: [4, 4, 3, 5, 4, 3, 4][i % 7], energy: [4, 3, 4, 5, 3][i % 5], stress: [2, 3, 2, 1, 3][i % 5], sleepHours: [7.5, 8, 7, 8.2, 6.8][i % 5], notes: 'Sample check-in for demonstration.' })) };
  state.weightTracking = { enabled: true, entries: Array.from({ length: 30 }, (_, i) => ({ date: date(-i * 3), kg: Math.round((76 + i * .035 + Math.sin(i * 1.2) * .3) * 10) / 10 })).reverse() };
  state.pointsLedger = Array.from({ length: 21 }, (_, i) => ['me', 'allen', 'ava'].map((userId, j) => ({ id: `sample-award-${i}-${userId}`, userId, date: date(-i), points: [15, 20, 25][(i + j) % 3], reason: 'Sample food-saving challenge' }))).flat();
  state.trades = [{ id: 'sample-trade', type: 'in-person', wantedId: state.friendItems[0].id, offeredId: state.items[0].id, wantName: state.friendItems[0].name, offerName: state.items[0].name, toId: 'allen', status: 'pending', created: date(0), note: 'Sample exchange — discuss quantity in person.' }];
  const stamp = (minutes) => new Date(now - minutes * 60000).toISOString();
  state.profile.city = 'Calgary';
  state.profile.cityLocation = { id: '5913490', name: 'Calgary', ascii: 'Calgary', province: 'Alberta', country: 'Canada', countryCode: 'CA', latitude: 51.05011, longitude: -114.08529, timezone: 'America/Edmonton' };
  state.profile.accountFor = 'myself';
  state.profile.budgetCad = 85;
  state.profile.mealsPerDay = 3;
  state.foodPrices = Object.fromEntries(catalog.slice(0, 57).map((food, i) => [food.name.toLowerCase(), { name: food.name, cad: Math.round((2.5 + i % 8 * .65) * 100) / 100, grams: 500, sample: true, updatedAt: stamp(60) }]));
  state.groceries = [{ id: 'sample-shop-oats', name: 'Oats', grams: 500, checked: false }, { id: 'sample-shop-apple', name: 'Apple', grams: 1000, checked: false }, { id: 'sample-shop-broccoli', name: 'Broccoli', grams: 500, checked: false }];
  state.completedGroceries = [{ id: 'sample-completed-yogurt', name: 'Greek yogurt', grams: 500, completedAt: stamp(120) }, { id: 'sample-completed-eggs', name: 'Eggs', grams: 600, completedAt: stamp(120) }];
  const meal = recipes[0];
  state.logs.push({ id: 'sample-cooked-today', name: meal.name, emoji: meal.emoji, userId: 'me', date: date(0), recipeId: meal.id, cuisine: meal.cuisine, source: 'recipe', nutrients: recipeNutrition(meal), estimated: true });
  state.dinners = [{ id: 'sample-dinner', recipeId: meal.id, name: meal.name, fridgeIds: ['my-fridge', 'ava-fridge'], servings: 2, createdDate: date(0), status: 'planned', missing: [] }];
  state.trades.push({ id: 'sample-ava-trade', type: 'in-person', wantedId: state.friendItems[5].id, offeredId: null, wantName: state.friendItems[5].name, offerName: 'Free request', toId: 'ava', status: 'accepted', created: date(-1), note: 'Sample agreement — arrange pickup in person.' });
  state.demoMessages = [
    { id: 'sample-chat-allen-1', fromId: 'allen', toId: 'me', text: 'Hey Nathaniel! I have extra chickpeas. Want to trade for some spinach?', kind: 'text', createdAt: stamp(180) },
    { id: 'sample-chat-allen-2', fromId: 'me', toId: 'allen', text: 'Sounds good! We could make grain bowls together this week.', kind: 'text', createdAt: stamp(175) },
    { id: 'sample-chat-allen-3', fromId: 'me', toId: 'allen', text: 'Meal collab · What should we cook together?', kind: 'system', prompt: 'meal', createdAt: stamp(170) },
    { id: 'sample-chat-allen-4', fromId: 'allen', toId: 'me', text: 'Thursday works for me. I can bring the chickpeas and rice. Dominic said he’ll bring his famous hot sauce!', kind: 'text', createdAt: stamp(165) },
    { id: 'sample-chat-ava-1', fromId: 'ava', toId: 'me', text: 'I saved some vegetables from going to waste today. How is your week going?', kind: 'text', createdAt: stamp(90) },
    { id: 'sample-chat-ava-2', fromId: 'me', toId: 'ava', text: 'Nice! I used up my spinach at lunch. Ready for a friendly challenge?', kind: 'text', createdAt: stamp(85) },
    { id: 'sample-chat-ava-3', fromId: 'ava', toId: 'me', text: 'Friendly competition · Ready for a food-saving challenge?', kind: 'system', prompt: 'competition', createdAt: stamp(80) },
    { id: 'sample-chat-ava-4', fromId: 'ava', toId: 'me', text: 'Let’s see who can cook more meals from what is already in the fridge this week!', kind: 'text', createdAt: stamp(75) },
  ];
  state.remoteTrades = []; state.remotePointsLedger = []; state.friendRequests = [];
  state.staples = state.items.slice(0, 5).map((f, i) => ({ id: `sample-staple-${i}`, name: f.name, usualGrams: 500, minimumGrams: 100, enabled: true }));
  return refreshDerived(state);
}

export function enrichSampleState(current, now = Date.now()) {
  if (!current?.sampleAccount || current.sampleDataVersion >= 3) return current;
  if (current.sampleDataVersion >= 2) {
    const seeded = sampleState(now);
    const cameo = seeded.demoMessages.find((m) => m.id === 'sample-chat-allen-4');
    return { ...current, sampleDataVersion: 3, demoMessages: [...(current.demoMessages || []).filter((m) => m.id !== cameo.id), cameo].sort((a, b) => a.createdAt.localeCompare(b.createdAt)) };
  }
  const seeded = sampleState(now);
  const personal = (entries) => (entries || []).filter((e) => !String(e.id || '').startsWith('sample-'));
  return refreshDerived({ ...current, ...seeded,
    household: current.household || seeded.household,
    profile: { ...seeded.profile, ...current.profile, city: seeded.profile.city, cityLocation: seeded.profile.cityLocation },
    items: [...seeded.items, ...personal(current.items).map((i) => ({ ...i, fridgeId: 'my-fridge', ownerId: 'me' }))],
    logs: [...seeded.logs, ...personal(current.logs)],
    demoMessages: [...seeded.demoMessages, ...(current.demoMessages || []).filter((m) => !String(m.id).startsWith('sample-chat-') && ['me','allen','ava'].includes(m.fromId) && ['me','allen','ava'].includes(m.toId))],
    foodPrices: { ...seeded.foodPrices, ...current.foodPrices },
  });
}
