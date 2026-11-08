import { streak } from './domain.mjs';
import { nutrientTotals, nutrientDefinitions, nutrientInfo, microTargets } from '../../../../packages/shared/nutrition.mjs';
export function shiftDate(date, days) { const d = new Date(date + 'T12:00:00'); d.setDate(d.getDate() + days); return d.toLocaleDateString('en-CA'); }
const validDate = (date) => /^\d{4}-\d{2}-\d{2}$/.test(date || '') && !Number.isNaN(Date.parse(date)) && new Date(date + 'T12:00:00').toLocaleDateString('en-CA') === date;
export function saveWeight(state, input, today) {
  const kg = Number(input.kg);
  if (!validDate(input.date) || input.date > today) throw Error('Choose a valid date that is not in the future.');
  if (!Number.isFinite(kg) || kg < 1 || kg > 700) throw Error('Enter a weight between 1 and 700 kg.');
  const entries = [...(state.weightTracking?.entries || []).filter((e) => e.date !== input.date), { date: input.date, kg: Math.round(kg * 10) / 10 }].sort((a, b) => a.date.localeCompare(b.date));
  return { ...state, profile: { ...state.profile, weightKg: entries.at(-1).kg }, weightTracking: { ...state.weightTracking, entries, snoozedUntil: null } };
}
export function weightReminder(state, today) {
  const latest = [...(state.weightTracking?.entries || [])].filter((e) => e.date <= today).sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  return { due: state.weightTracking?.enabled !== false && (!state.weightTracking?.dismissedUntil || state.weightTracking.dismissedUntil <= today) && (!state.weightTracking?.snoozedUntil || state.weightTracking.snoozedUntil <= today) && (!latest || shiftDate(latest.date, 3) <= today), streak: streak(state.logs, today), latest };
}
const mean = (values) => values.length ? values.reduce((s, n) => s + n, 0) / values.length : null;
export function correlation(pairs, minimum = 8) {
  const known = pairs.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (known.length < minimum) return null;
  const mx = mean(known.map((p) => p[0])), my = mean(known.map((p) => p[1]));
  let xx = 0, yy = 0, xy = 0;
  for (const [x, y] of known) { xx += (x - mx) ** 2; yy += (y - my) ** 2; xy += (x - mx) * (y - my); }
  return xx > 0 && yy > 0 ? { r: Math.max(-1, Math.min(1, xy / Math.sqrt(xx * yy))), count: known.length } : null;
}
export function wrappedInsights(state, today, days = 30) {
  const start = shiftDate(today, 1 - days);
  const logs = state.logs.filter((l) => (l.userId || 'me') === 'me' && l.date >= start && l.date <= today);
  const byDay = new Map(); for (const log of logs) { const list = byDay.get(log.date) || []; list.push(log); byDay.set(log.date, list); }
  const weights = [...(state.weightTracking?.entries || [])].filter((e) => e.date >= start && e.date <= today && Number.isFinite(e.kg)).sort((a, b) => a.date.localeCompare(b.date));
  const checkIns = (state.wellbeing?.checkIns || []).filter((e) => e.date >= start && e.date <= today);
  const series = Array.from({ length: days }, (_, i) => {
    const date = shiftDate(start, i), food = byDay.get(date) || [], check = checkIns.find((e) => e.date === date);
    const row = { date, weight: weights.find((e) => e.date === date)?.kg ?? null, energy: check?.energy ?? null, sleep: check?.sleepHours ?? null };
    for (const key of ['kcal', 'protein', 'fiber']) { const known = food.map((l) => l.nutrients?.[key]).filter(Number.isFinite); row[key] = known.length ? known.reduce((a, b) => a + b, 0) : null; row[key + 'Complete'] = food.length > 0 && known.length === food.length; }
    return row;
  });
  const counts = new Map(); for (const l of logs) counts.set(l.name, (counts.get(l.name) || 0) + 1);
  const favorite = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  // Pair average recorded calories BETWEEN weigh-ins with change per day, not raw weight.
  const pairs = [];
  for (let i = 1; i < weights.length; i++) {
    const previous = weights[i - 1], current = weights[i];
    const interval = series.filter((r) => r.date >= previous.date && r.date < current.date);
    if (interval.length >= 2 && interval.every((r) => r.kcalComplete)) pairs.push([mean(interval.map((r) => r.kcal)), (current.kg - previous.kg) / interval.length]);
  }
  const weightCalories = weights.length > 1 && Date.parse(weights.at(-1).date) - Date.parse(weights[0].date) >= 21 * 86400000 ? correlation(pairs) : null;
  const sleepEnergy = correlation(checkIns.map((e) => [e.sleepHours, e.energy]));
  const totals = nutrientTotals(logs), targets = microTargets(state.profile);
  const micros = nutrientDefinitions.filter((d) => targets[d.id] && !['203','204','205','208','291'].includes(d.id)).map((d) => ({ name: nutrientInfo(d).name, unit: d.unit, total: totals.values[d.id], knownRecords: totals.coverage[d.id] || 0, records: logs.length })).filter((d) => Number.isFinite(d.total)).slice(0, 8);
  return { series, logs: logs.length, loggedDays: byDay.size, variety: counts.size, favorite, weights, weightChange: weights.length > 1 ? weights.at(-1).kg - weights[0].kg : null, weightCalories, weightPairs: pairs.length, sleepEnergy, checkIns: checkIns.length, micros, averages: Object.fromEntries(['kcal','protein','fiber','sleep','energy'].map((k) => [k, mean(series.map((r) => r[k]).filter(Number.isFinite))])) };
}
