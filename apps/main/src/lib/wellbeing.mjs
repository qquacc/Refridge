export const wellbeingMetrics = {
  mood: { label: "Mood", unit: "/ 5", maximum: 5, colour: "#476b56" },
  energy: { label: "Energy", unit: "/ 5", maximum: 5, colour: "#a86d30" },
  stress: { label: "Stress", unit: "/ 5", maximum: 5, colour: "#8e6683" },
  sleepHours: { label: "Sleep", unit: "hours", maximum: 12, colour: "#52768c" },
  protein: { label: "Recorded protein", unit: "g", maximum: 100, colour: "#6b7b42" },
  fiber: { label: "Recorded fibre", unit: "g", maximum: 30, colour: "#9b703b" },
};
function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const d = new Date(value + "T12:00:00");
  return Number.isFinite(d.getTime()) && d.getFullYear() === Number(value.slice(0, 4)) && d.getMonth() + 1 === Number(value.slice(5, 7)) && d.getDate() === Number(value.slice(8));
}
export function saveCheckIn(entries, input, today) {
  if (!validDate(input.date) || input.date > today) throw Error("Choose today or an earlier valid date.");
  const entry = { date: input.date, notes: String(input.notes || "").trim().slice(0, 500) };
  let answered = 0;
  for (const key of ["mood", "energy", "stress", "sleepHours"]) {
    const raw = input[key];
    if (raw === "" || raw === null || raw === undefined) { entry[key] = null; continue; }
    const n = Number(raw);
    if (!Number.isFinite(n) || (key === "sleepHours" ? n < 0 || n > 24 : !Number.isInteger(n) || n < 1 || n > 5)) throw Error("Use 1–5 for ratings and 0–24 hours for sleep.");
    entry[key] = n; answered++;
  }
  if (!answered) throw Error("Answer at least one check-in question.");
  return [...entries.filter((e) => e.date !== entry.date), entry].sort((a, b) => a.date.localeCompare(b.date));
}
export function wellbeingSeries(state, endDate, days = 30) {
  const byDate = new Map((state.wellbeing?.checkIns || []).map((e) => [e.date, e]));
  const logs = new Map();
  for (const log of state.logs || []) {
    if ((log.userId || "me") !== "me") continue;
    const list = logs.get(log.date) || []; list.push(log); logs.set(log.date, list);
  }
  return Array.from({ length: days }, (_, index) => {
    const d = new Date(endDate + "T12:00:00"); d.setDate(d.getDate() - (days - 1 - index));
    const date = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
    const entry = byDate.get(date), dayLogs = logs.get(date) || [];
    const row = { date, records: dayLogs.length };
    for (const key of ["mood", "energy", "stress", "sleepHours"]) row[key] = Number.isFinite(entry?.[key]) ? entry[key] : null;
    for (const key of ["protein", "fiber"]) {
      const known = dayLogs.map((l) => l.nutrients?.[key]).filter(Number.isFinite);
      row[key] = known.length ? known.reduce((n, v) => n + v, 0) : null;
      row[key + "Partial"] = dayLogs.length > known.length;
    }
    return row;
  });
}
export function metricAverage(series, metric) {
  const known = series.map((d) => d[metric]).filter(Number.isFinite);
  return { value: known.length ? known.reduce((a, b) => a + b, 0) / known.length : null, count: known.length };
}
