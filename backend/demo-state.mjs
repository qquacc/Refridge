import { initialState, catalog, nutrition } from '../apps/main/src/data/food.mjs';
import { upgradeState } from '../apps/main/src/lib/domain.mjs';
import { refreshDerived } from '../apps/main/src/lib/planning.mjs';
export function sampleState(now = Date.now()) {
  const date = (offset) => { const d = new Date(now); d.setDate(d.getDate() + offset); return d.toLocaleDateString('en-CA'); };
  const state = upgradeState({ ...initialState(), items: [], logs: [], groceries: [] });
  state.profile = { ...state.profile, name: 'Nathaniel', birthday: '1998-05-18', weightKg: 76, heightM: 1.78, gender: 'Man', referenceSex: 'male', activity: 'Moderate', goal: 'Less waste', complete: true };
  state.household = "Nathaniel's Kitchen";
  state.onboarding = { completed: true, version: 2 };
  state.sampleAccount = true;
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
  state.staples = state.items.slice(0, 5).map((f, i) => ({ id: `sample-staple-${i}`, name: f.name, usualGrams: 500, minimumGrams: 100, enabled: true }));
  return refreshDerived(state);
}
