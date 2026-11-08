import React, { useEffect, useState } from "react";
import { Panel, Field } from "../components/FeatureUI.jsx";
import TrendChart from "../components/TrendChart.jsx";
import { today } from "../data/food.mjs";
import { wellbeingMetrics, wellbeingSeries, metricAverage, saveCheckIn } from "../lib/wellbeing.mjs";
const empty = { mood: "", energy: "", stress: "", sleepHours: "", notes: "" };
export default function WellbeingPage({ state, setState, notify }) {
  const [date, setDate] = useState(today()), [draft, setDraft] = useState(empty), [error, setError] = useState("");
  const [days, setDays] = useState(30), [metric, setMetric] = useState("energy");
  const entries = state.wellbeing?.checkIns || [], selected = entries.find((e) => e.date === date);
  useEffect(() => { setDraft(selected ? Object.fromEntries(Object.keys(empty).map((k) => [k, selected[k] ?? ""])) : empty); setError(""); }, [date, selected]);
  const series = wellbeingSeries(state, today(), days);
  function save(event) {
    event.preventDefault();
    try {
      const input = { ...draft, date };
      saveCheckIn(entries, input, today());
      setState((s) => ({ ...s, wellbeing: { ...s.wellbeing, checkIns: saveCheckIn(s.wellbeing?.checkIns || [], input, today()) } }));
      setError(""); notify("Well-being check-in saved to your account");
    } catch (e) { setError(e.message); }
  }
  return <div className="feature-page wellbeing-page">
    <div className="wellbeing-intro"><span className="eyebrow">SMALL CHECK-INS. A LONGER VIEW.</span><h2>Notice your patterns.</h2><p>Track how you feel alongside your recorded eating habits. Check in when it’s useful—there are no streaks to keep.</p></div>
    <Panel title={selected ? "Edit your check-in" : "A moment for yourself"} subtitle="All answers are optional. Save at least one. These entries stay in your account and are not part of the friend feed.">
      <form className="feature-form" onSubmit={save}>
        <Field label="Check-in date" type="date" value={date} max={today()} required onChange={(e) => setDate(e.target.value)} />
        <div className="form-grid">{[["mood", "How is your mood?", ["Very low", "Low", "In between", "Good", "Very good"]], ["energy", "How is your energy?", ["Very low", "Low", "Moderate", "High", "Very high"]], ["stress", "How stressed do you feel?", ["Not at all", "A little", "Moderately", "Quite stressed", "Very stressed"]]].map(([key, label, choices]) => <Field key={key} label={label}><select value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}><option value="">Not recorded</option>{choices.map((choice, i) => <option key={choice} value={i + 1}>{i + 1} · {choice}</option>)}</select></Field>)}
        <Field label="How much did you sleep? (hours)" type="number" min="0" max="24" step="0.25" placeholder="Not recorded" value={draft.sleepHours} onChange={(e) => setDraft({ ...draft, sleepHours: e.target.value })} /></div>
        <Field label="Anything that adds context? (optional)"><textarea rows={2} maxLength={500} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="A busy day, a restful weekend, a change in routine…" /></Field>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary">{selected ? "Update check-in" : "Save check-in"}</button>
      </form>
    </Panel>
    <Panel title="Your longer view" subtitle="Explore changes over 30, 90, or 365 days. Trends show recorded data, not causes or diagnoses.">
      <div className="trend-controls"><Field label="Time period"><select value={days} onChange={(e) => setDays(Number(e.target.value))}><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option><option value={365}>Last year</option></select></Field><Field label="Explore"><select value={metric} onChange={(e) => setMetric(e.target.value)}>{Object.entries(wellbeingMetrics).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></Field></div>
      <div className="wellbeing-metrics">{Object.entries(wellbeingMetrics).map(([key, config]) => { const avg = metricAverage(series, key); return <button key={key} className={key === metric ? "selected" : ""} onClick={() => setMetric(key)} aria-pressed={key === metric}><span>{config.label}</span><strong>{avg.value === null ? "—" : Math.round(avg.value * 10) / 10}<small> {config.unit}</small></strong><small>{avg.count ? `Average across ${avg.count} recorded day${avg.count === 1 ? "" : "s"}` : "Not recorded yet"}</small></button>; })}</div>
      <h3>{wellbeingMetrics[metric].label}</h3><TrendChart series={series} metric={metric} />
      <details className="trend-data"><summary>View the recorded values</summary>{series.some((d) => Number.isFinite(d[metric])) ? <table><thead><tr><th scope="col">Date</th><th scope="col">{wellbeingMetrics[metric].label}</th></tr></thead><tbody>{series.filter((d) => Number.isFinite(d[metric])).reverse().map((d) => <tr key={d.date}><td>{d.date}</td><td>{Math.round(d[metric] * 10) / 10} {wellbeingMetrics[metric].unit}{d[metric + "Partial"] ? " · partial data" : ""}</td></tr>)}</tbody></table> : <p>No values recorded in this period.</p>}</details>
    </Panel>
    <Panel title="Your check-in history" subtitle="Select a date to edit that entry.">{entries.length ? <div className="checkin-history">{[...entries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30).map((entry) => <button className="summary-food" key={entry.date} onClick={() => { setDate(entry.date); window.scrollTo({ top: 0, behavior: "smooth" }); }}><strong>{entry.date}</strong><span>{["mood", "energy", "stress", "sleepHours"].filter((key) => Number.isFinite(entry[key])).map((key) => `${wellbeingMetrics[key].label}: ${entry[key]}`).join(" · ")}</span>{entry.notes && <small>{entry.notes}</small>}</button>)}</div> : <p className="body-copy">Your first check-in starts your history.</p>}</Panel>
  </div>;
}
