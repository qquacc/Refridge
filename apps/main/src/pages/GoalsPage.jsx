import React from "react";
import { Panel, Field } from "../components/FeatureUI.jsx";
import { suggestCuisines } from "../lib/planning.mjs";
import { automaticTargets } from "../../../../packages/shared/nutrition.mjs";
export default function GoalsPage({ state, setState, notify, navigate }) {
  const calc = automaticTargets(state.profile),
    choices = suggestCuisines(state);
  function save(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setState((s) => ({
      ...s,
      profile: {
        ...s.profile,
        goal: String(f.get("goal")),
        cuisines: f.getAll("cuisine"),
        targetMode: String(f.get("targetMode")),
      },
      goals:
        f.get("targetMode") === "manual"
          ? Object.fromEntries(
              ["kcal", "protein", "carbs", "fat", "fiber"].map((k) => [
                k,
                Number(f.get(k)),
              ]),
            )
          : s.goals,
    }));
    notify("Food preferences saved");
  }
  return (
    <div className="feature-page">
      <Panel
        title="Food priorities"
        subtitle="Recommendations use what is available, your dietary rules, and recent meals."
      >
        <form className="feature-form" onSubmit={save}>
          <div className="form-grid">
            <Field label="Priority">
              <select name="goal" defaultValue={state.profile.goal}>
                {[
                  "Less waste",
                  "Affordability",
                  "Bulking",
                  "Balanced variety",
                ].map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </Field>
            <Field label="Daily target method">
              <select name="targetMode" defaultValue={state.profile.targetMode}>
                <option value="auto">Calculate from profile</option>
                <option value="manual">Use custom targets below</option>
              </select>
            </Field>
          </div>
          <h3>Daily targets</h3>
          <p className="body-copy">
            {calc.available
              ? `${calc.targets.kcal} kcal estimated from profile · ${calc.method}`
              : calc.reason}
          </p>
          <button
            type="button"
            className="text-btn"
            onClick={() => navigate("profile")}
          >
            Update profile inputs ↗
          </button>
          <div className="form-grid">
            {[
              ["kcal", "Calories (kcal)"],
              ["protein", "Protein (g)"],
              ["carbs", "Carbohydrates (g)"],
              ["fat", "Fat (g)"],
              ["fiber", "Fibre (g)"],
            ].map(([k, label]) => (
              <Field
                key={k}
                label={label}
                name={k}
                type="number"
                min="1"
                max="20000"
                required
                defaultValue={state.goals[k]}
              />
            ))}
          </div>
          <p className="form-hint">
            Custom fields apply only in custom mode. Automatic energy estimates
            use Health Canada equations, not BMI alone. No automatic weight-loss
            restriction or bulking surplus is prescribed. Affordability
            prioritises ingredients already in stock; live local sale prices are
            not connected. Bulking ranks higher-protein, energy-containing
            meals.
          </p>
          <h3>Cuisines to explore · {choices.length} options</h3>
          <p className="form-hint">
            Options near the top fit the recipe library and your recent food
            pattern. Not every cuisine has a full recipe collection yet.
          </p>
          <div className="cuisine-grid">
            {choices.map((c, i) => (
              <label key={c} className={i < 8 ? "recommended" : ""}>
                <input
                  type="checkbox"
                  name="cuisine"
                  value={c}
                  defaultChecked={state.profile.cuisines.includes(c)}
                />
                {c}
                {i < 8 && <small>Suggested</small>}
              </label>
            ))}
          </div>
          <button className="btn primary" type="submit">
            Save preferences
          </button>
        </form>
      </Panel>
    </div>
  );
}
