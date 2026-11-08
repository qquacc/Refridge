import React, { useState } from "react";
import { Panel, Metric } from "../components/FeatureUI.jsx";
import { today } from "../data/food.mjs";
import {
  nutrientDefinitions,
  nutrientTotals,
  nutrientInfo,
  microTargets,
  automaticTargets,
} from "../../../../packages/shared/nutrition.mjs";
export default function NutritionPage({ state, navigate, setModal }) {
  const [query, setQuery] = useState("");
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
    <div className="feature-page">
      <Panel
        title="Your nutrition diary"
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
          ].map(([id, label, unit]) => (
            <Metric
              key={id}
              label={label}
              value={`${sum(id)} ${unit}`}
              note={`${state.goals[id]} ${unit} ${state.profile.targetMode === "manual" ? "custom" : calc.available ? "calculated" : "example"} daily target`}
            />
          ))}
        </div>
        <div className="button-row">
          <button
            className="btn outline"
            onClick={() => setModal({ type: "outside" })}
          >
            Log a meal
          </button>
          <button className="text-btn" onClick={() => navigate("goals")}>
            Food goals and target sources ↗
          </button>
        </div>
      </Panel>
      <Panel
        title="All 152 Canadian food-composition fields"
        subtitle="Includes vitamins, minerals, amino acids, fatty acids, sugars, caffeine and more. Not every food contains a measured value for every field."
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
            Unknown is not zero. A low logged day does not diagnose a
            deficiency; risk descriptions refer to persistent inadequate intake.
            CNF contains 152 fields, not every compound that exists in food.
          </p>
        </div>
        <div className="nutrient-table">
          {nutrientDefinitions
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
