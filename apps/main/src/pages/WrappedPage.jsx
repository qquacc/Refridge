import React, { useState } from "react";
import { Panel, Metric } from "../components/FeatureUI.jsx";
import {
  nutrientTotals,
  nutrientDefinitions,
  nutrientInfo,
  microTargets,
} from "../../../../packages/shared/nutrition.mjs";
export default function WrappedPage({ state }) {
  const [month, setMonth] = useState(
    new Date().toLocaleDateString("en-CA").slice(0, 7),
  );
  const logs = state.logs.filter(
    (l) => (l.userId || "me") === "me" && l.date.startsWith(month),
  );
  const sum = (k) =>
    Math.round(logs.reduce((a, l) => a + (l.nutrients?.[k] || 0), 0));
  const countBy = (key) =>
    Object.entries(
      logs.reduce((s, l) => {
        if (l[key]) s[l[key]] = (s[l[key]] || 0) + 1;
        return s;
      }, {}),
    ).sort((a, b) => b[1] - a[1]);
  const byDay = [...new Set(logs.map((l) => l.date))].sort();
  const target = microTargets(state.profile);
  return (
    <div className="feature-page">
      <Panel
        title="Your food, remembered"
        subtitle="Your monthly diary: food, nutrition, and cuisine patterns."
        action={
          <input
            aria-label="Wrapped month"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        }
      >
        <div className="feature-metrics">
          <Metric
            label="Calories logged"
            value={sum("kcal").toLocaleString() + " kcal"}
          />
          <Metric
            label="Protein logged"
            value={sum("protein").toLocaleString() + " g"}
          />
          <Metric
            label="Carbohydrates logged"
            value={sum("carbs").toLocaleString() + " g"}
          />
        </div>
      </Panel>
      <div className="feature-columns">
        <Panel
          title="On repeat"
          subtitle="Your favourites, based on logged meals."
        >
          <h3>
            {countBy("name")[0]?.[0] || "Your first favourite is still ahead."}
          </h3>
          <p className="body-copy">
            Favourite cuisine:{" "}
            {countBy("cuisine")[0]?.[0] || "Not enough cuisine data yet"}
          </p>
          <p className="body-copy">
            {logs.length} food/meal entries across {byDay.length} days.
          </p>
        </Panel>
        <Panel
          title="The nutrients in your month"
          subtitle="Totals include known Canadian nutrient values only."
        >
          <div className="nutrient-summary-list">
            {Object.entries(nutrientTotals(logs).values)
              .filter(([id]) =>
                [
                  "301",
                  "303",
                  "304",
                  "401",
                  "339",
                  "418",
                  "815",
                  "306",
                ].includes(id),
              )
              .map(([id, value]) => {
                const def = nutrientDefinitions.find((n) => n.id === id);
                return (
                  <div key={id}>
                    <span>{nutrientInfo(def).name}</span>
                    <strong>
                      {Math.round(value * 10) / 10} {def.unit}
                    </strong>
                  </div>
                );
              })}
          </div>
        </Panel>
      </div>
      <Panel
        title="Day by day"
        subtitle="Above/below applies to the recorded intake, not your actual nutrient status. Missing meals and unknown data matter."
      >
        {byDay.map((date) => {
          const day = logs.filter((l) => l.date === date),
            totals = nutrientTotals(day);
          const differences = Object.entries(target)
            .filter(
              ([id, t]) =>
                totals.coverage[id] === day.length &&
                totals.values[id] !== undefined,
            )
            .map(([id, t]) => ({ id, ratio: totals.values[id] / t }))
            .sort((a, b) => Math.abs(b.ratio - 1) - Math.abs(a.ratio - 1))
            .slice(0, 3);
          return (
            <article className="wrapped-day" key={date}>
              <strong>{date}</strong>
              <span>
                {Math.round(
                  day.reduce((a, l) => a + (l.nutrients?.kcal || 0), 0),
                )}{" "}
                kcal logged
              </span>
              <div>
                {differences.map((d) => (
                  <span className="pill" key={d.id}>
                    {
                      nutrientInfo(
                        nutrientDefinitions.find((n) => n.id === d.id),
                      ).name
                    }
                    : {Math.round(d.ratio * 100)}% of reference (
                    {d.ratio > 1 ? "above" : "below"})
                  </span>
                ))}
              </div>
            </article>
          );
        })}
        {!logs.length && (
          <div className="empty">Log a meal to begin this month’s summary.</div>
        )}
      </Panel>
    </div>
  );
}
