import React, { useState } from "react";
import { Panel, Metric } from "../components/FeatureUI.jsx";
import { today } from "../data/food.mjs";
import {
  nutrientDefinitions,
  nutrientTotals,
  nutrientInfo,
  microTargets,
  automaticTargets,
  macroIds,
} from "../../../../packages/shared/nutrition.mjs";
const progressColor = (ratio) => ratio < .25 ? "#ef2638" : ratio < .75 ? "#f58a12" : "#098d37";
export default function NutritionPage({ state, setState, navigate, setModal }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("Micronutrients");
  const [date, setDate] = useState(today());
  const logs = state.logs.filter(
      (l) => (l.userId || "me") === "me" && l.date === date,
    ),
    total = nutrientTotals(logs),
    targets = microTargets(state.profile),
    calc = automaticTargets(state.profile);
  const sum = (k) => {
    const known = logs.filter((l) => Number.isFinite(l.nutrients?.[k]));
    return logs.length && !known.length
      ? "Unknown"
      : (known.length < logs.length ? "≥ " : "") +
          Math.round(known.reduce((a, l) => a + l.nutrients[k], 0));
  };
  return (
    <div className="feature-page today-page">
      <Panel
        title={date === today() ? "Today’s nutrition" : "Daily nutrition"}
        subtitle="Estimates from logged food, with the exact CNF reference attached."
        action={
          <input
            aria-label="Diary date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        }
      >
        <div className="feature-metrics">
          {[
            ["kcal", "Calories", "kcal"],
            ["protein", "Protein", "g"],
            ["carbs", "Carbohydrates", "g"],
            ["fat", "Fat", "g"],
            ["fiber", "Fibre", "g"],
          ].map(([id, label, unit]) => {
            const known = logs.filter((l) => Number.isFinite(l.nutrients?.[id]));
            const amount = known.reduce((sum, l) => sum + l.nutrients[id], 0);
            const target = Number(state.goals[id]);
            const ratio = target > 0 ? amount / target : 0;
            return <div className="today-macro-card" key={id}>
            <Metric
              label={label}
              value={`${sum(id)} ${unit}`}
              note={`${state.goals[id]} ${unit} ${state.profile.targetMode === "manual" ? "custom" : calc.available ? "calculated" : "example"} daily target`}
            />
            <div className="today-nutrient-track" aria-hidden="true"><span style={{ width: `${known.length && target > 0 ? Math.min(100, Math.max(0, ratio * 100)) : 0}%`, backgroundColor: progressColor(ratio) }} /></div>
            </div>;
          })}
        </div>
        <div className="button-row">
          <button
            className="btn outline"
            onClick={() => setModal({ type: "outside" })}
          >
            Log a meal
          </button>
          <button className="btn outline" onClick={() => { const own = state.fridges.find((f) => f.ownerId === "me"); if (own) setState((s) => ({ ...s, activeFridgeId: own.id })); setModal({ type: "add" }); }}>Add food to fridge manually</button>
          <button className="text-btn" onClick={() => navigate("goals")}>
            Food goals and target sources ↗
          </button>
        </div>
      </Panel>
      <Panel
        title="Nutrients"
        subtitle="Explore your recorded intake. Open any nutrient for its role, reference, and data coverage."
        action={
          <input
            aria-label="Find nutrient"
            placeholder="Find a nutrient…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        }
      >
        <div className="info-banner">
          <p>
            Log your meals to build a clearer picture over time. Missing values
            mean we don’t have that information yet, and one day’s totals don’t tell the whole story.
          </p>
        </div>
        <div className="today-nutrient-filters" aria-label="Nutrient filters">
          {["Biggest gaps", "Macros", "Micronutrients", "All nutrients"].map((name) => <button key={name} type="button" aria-pressed={filter === name} onClick={() => setFilter(name)}>{name}</button>)}
        </div>
        {filter === "Biggest gaps" && !nutrientDefinitions.some((d) => targets[d.id] && Number.isFinite(total.values[d.id]) && total.coverage[d.id] === logs.length && total.values[d.id] < targets[d.id]) && <p className="body-copy">No gaps to show from complete recorded values. Log food to start tracking; missing values remain unknown.</p>}
        <div className="nutrient-table">
          {nutrientDefinitions
            .filter((d) => filter === "Macros" ? Object.values(macroIds).includes(d.id)
              : filter === "Micronutrients" ? !!targets[d.id] && !Object.values(macroIds).includes(d.id)
              : filter === "Biggest gaps" ? !!targets[d.id] && Number.isFinite(total.values[d.id]) && total.coverage[d.id] === logs.length && total.values[d.id] < targets[d.id]
              : true)
            .sort((a, b) => filter === "Biggest gaps" ? total.values[a.id] / targets[a.id] - total.values[b.id] / targets[b.id] : 0)
            .filter((d) =>
              (d.name + " " + nutrientInfo(d).name)
                .toLowerCase()
                .includes(query.toLowerCase()),
            )
            .map((d) => {
              const info = nutrientInfo(d),
                known = total.values[d.id] !== undefined,
                complete = known && total.coverage[d.id] === logs.length,
                target = targets[d.id];
              return (
                <details key={d.id}>
                  <summary>
                    <span>{info.name}</span>
                    <strong>
                      {known
                        ? `${complete ? "" : "≥ "}${Math.round(total.values[d.id] * 100) / 100} ${d.unit}`
                        : "Unknown"}
                    </strong>
                    <small>
                      {target && known
                        ? `${Math.round((total.values[d.id] / target) * 100)}% reference${complete ? "" : " · partial data"}`
                        : complete
                          ? "Known values"
                          : "No complete value"}
                    </small>
                    <span className="today-nutrient-track" aria-hidden="true"><span style={{ width: `${target && known ? Math.min(100, Math.max(0, total.values[d.id] / target * 100)) : 0}%`, backgroundColor: progressColor(target && known ? total.values[d.id] / target : 0) }} /></span>
                  </summary>
                  <div>
                    <p>{info.role}</p>
                    <p>{info.risk}</p>
                    {target && (
                      <p>
                        Reference intake: {target} {d.unit}/day.{" "}
                        {complete && total.values[d.id] < target
                          ? "Recorded intake is below the reference today; one day is not a diagnosis."
                          : ""}
                      </p>
                    )}
                    <p>
                      Coverage: {total.coverage[d.id] || 0} fully known records
                      out of {logs.length}. Unlogged foods and unknown amounts
                      can change the total.
                    </p>
                    <a
                      href="https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables.html"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Health Canada reference tables ↗
                    </a>
                  </div>
                </details>
              );
            })}
        </div>
      </Panel>
      <Panel
        title="Foods logged"
        subtitle="Opening a record shows its nutrient source."
      >
        {logs.map((l) => (
          <details key={l.id} className="food-log-detail">
            <summary>
              <strong>{l.name}</strong>
              <span>
                {Math.round(l.nutrients?.kcal || 0)} kcal
                {l.estimated ? " · estimated" : ""}
              </span>
            </summary>
            <p>
              {l.grams ? l.grams + " g · " : ""}
              {l.source}
            </p>
            <p>
              {l.nutrients?.source
                ? JSON.stringify(l.nutrients.source)
                : "See recipe ingredient CNF references; older custom entries may have incomplete nutrient data."}
            </p>
          </details>
        ))}
        {!logs.length && (
          <div className="empty">No food logged for this date.</div>
        )}
      </Panel>
    </div>
  );
}
