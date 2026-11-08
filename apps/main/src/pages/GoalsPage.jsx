import React, { useState } from "react";
import { Panel, Field } from "../components/FeatureUI.jsx";
import { suggestCuisines, allowedRecipes, activeInventory } from "../lib/planning.mjs";
import { calculatePriorityPlan, recipeStockCoverage } from "../lib/goal-plan.mjs";
import { goalSources } from "../../../../packages/shared/goal-targets.mjs";
const fields = [["kcal", "Calories (kcal)"], ["protein", "Protein (g)"], ["carbs", "Carbohydrates (g)"], ["fat", "Fat (g)"], ["fiber", "Fibre (g)"]];
export default function GoalsPage({ state, setState, notify, navigate, setModal }) {
  const [draft, setDraft] = useState({ ...state.profile, mealsPerDay: state.profile.mealsPerDay ?? 3, bulkingSurplusPercent: state.profile.bulkingSurplusPercent ?? 5, bulkingProteinPerKg: state.profile.bulkingProteinPerKg ?? 1.8, varietyWeeklyTarget: state.profile.varietyWeeklyTarget ?? 12 });
  const [custom, setCustom] = useState({ ...state.goals }), [error, setError] = useState("");
  const plan = calculatePriorityPlan(state, draft), calc = plan.targets, manual = draft.targetMode === "manual";
  const targets = manual ? custom : calc.available ? calc.targets : null;
  const choices = suggestCuisines({ ...state, profile: draft }), recipes = allowedRecipes({ ...state, profile: draft }).slice(0, 3), pool = activeInventory(state);
  const change = (key, value) => setDraft((d) => ({ ...d, [key]: value }));
  function save(e) {
    e.preventDefault();
    if (!Number.isInteger(Number(draft.mealsPerDay)) || Number(draft.mealsPerDay) < 1 || Number(draft.mealsPerDay) > 6) { setError("Choose 1–6 meals per day."); return; }
    if (manual && fields.some(([k]) => !Number.isFinite(Number(custom[k])) || Number(custom[k]) <= 0)) { setError("Enter positive custom targets."); return; }
    if (draft.goal === "Affordability" && !plan.budget) { setError("Enter a positive weekly budget."); return; }
    setState((s) => ({ ...s, profile: { ...s.profile, ...draft, mealsPerDay: Number(draft.mealsPerDay), budgetCad: Number(draft.budgetCad), bulkingSurplusPercent: Number(draft.bulkingSurplusPercent), bulkingProteinPerKg: Number(draft.bulkingProteinPerKg), varietyWeeklyTarget: Number(draft.varietyWeeklyTarget) }, goals: manual ? Object.fromEntries(fields.map(([k]) => [k, Number(custom[k])])) : s.goals }));
    setError(""); notify("Priority and calculated food goals saved");
  }
  return <div className="feature-page">
    <Panel title="Food priorities" subtitle="Choose a priority to preview its calculations. Save to apply it across your food goals and meal suggestions.">
      <form className="feature-form" onSubmit={save}>
        <div className="form-grid"><Field label="Priority"><select value={draft.goal} onChange={(e) => change("goal", e.target.value)}>{["Less waste", "Affordability", "Bulking", "Balanced variety"].map((g) => <option key={g}>{g}</option>)}</select></Field>
        <Field label="Daily target method"><select value={draft.targetMode} onChange={(e) => change("targetMode", e.target.value)}><option value="auto">Calculate from profile and priority</option><option value="manual">Use custom targets</option></select></Field>
        <Field label="Meals per day for planning" type="number" min="1" max="6" step="1" value={draft.mealsPerDay} onChange={(e) => change("mealsPerDay", e.target.value)} required /></div>
        {draft.goal === "Bulking" && <div className="notice"><h3>Adult muscle-gain planning</h3><p>Start from your profile’s maintenance estimate. The default adds 5% energy and uses 1.8 g protein/kg, within the sports-nutrition reference range. This is a planning estimate, not a guaranteed rate of gain.</p>
          <div className="form-grid"><Field label="Energy surplus (%)" type="number" min="0" max="10" step="1" value={draft.bulkingSurplusPercent} onChange={(e) => change("bulkingSurplusPercent", e.target.value)} required /><Field label="Protein (g per kg body weight)" type="number" min="1.4" max="2" step="0.1" value={draft.bulkingProteinPerKg} onChange={(e) => change("bulkingProteinPerKg", e.target.value)} required /></div>
          <p><a href={goalSources.protein} target="_blank" rel="noreferrer">Protein and exercise reference ↗</a> · <a href={goalSources.surplus} target="_blank" rel="noreferrer">Energy-surplus study ↗</a></p>
        </div>}
        {draft.goal === "Affordability" && <div className="notice"><h3>Make your budget concrete</h3><Field label="Your weekly food budget (CAD)" type="number" min="0.01" max="10000" step="0.01" value={draft.budgetCad} onChange={(e) => change("budgetCad", e.target.value)} required />{plan.budget && <div className="feature-metrics"><div className="feature-metric"><span>Daily spending limit</span><strong>${plan.budget.daily.toFixed(2)}</strong><small>${plan.budget.weekly.toFixed(2)} ÷ 7 days</small></div><div className="feature-metric"><span>Average per-meal limit</span><strong>${plan.budget.perMeal.toFixed(2)}</strong><small>Weekly budget ÷ {plan.budget.mealsPerWeek} meals</small></div></div>}<p>These are your spending limits, not quoted food prices. Meals using ingredients already in stock rank higher. Nutrition targets stay at the profile baseline.</p><a href="https://food-guide.canada.ca/en/tips-for-healthy-eating/healthy-eating-on-a-budget/" target="_blank" rel="noreferrer">Canada’s Food Guide: eating on a budget ↗</a></div>}
        {draft.goal === "Less waste" && <div className="notice"><h3>Plan around what needs attention</h3><div className="feature-metrics"><div className="feature-metric"><span>Saved dates within 3 days</span><strong>{plan.soon.length} items</strong><small>{Math.round(plan.soonGrams)} g of your or shared stock</small></div><div className="feature-metric"><span>Past their saved dates</span><strong>{Math.round(plan.overdueGrams)} g</strong><small>Review separately; not included in the use-soon total</small></div></div><p>{plan.unknownDates} items have no saved date. Recipe ranking prioritizes ingredients nearing their saved dates. Dates alone do not establish food safety.</p></div>}
        {draft.goal === "Balanced variety" && <div className="notice"><h3>A little more variety</h3><Field label="Weekly distinct foods/dishes to explore" type="number" min="1" max="50" step="1" value={draft.varietyWeeklyTarget} onChange={(e) => change("varietyWeeklyTarget", e.target.value)} required /><div className="feature-metrics"><div className="feature-metric"><span>Distinct foods/dishes logged in 7 days</span><strong>{plan.variety.distinct} / {plan.variety.target}</strong><small>{plan.variety.recordedDays} days with food records</small></div><div className="feature-metric"><span>Ideas left to explore</span><strong>{plan.variety.remaining}</strong><small>Your planning target minus distinct logged names</small></div></div><p>The default 12 is an editable exploration goal, not a clinical requirement or a count of plants. Recipe ranking limits repetition and uses your dietary preferences.</p></div>}
        <h3>{manual ? "Your custom daily targets" : "Calculated daily targets"}</h3>
        <p className="body-copy">{manual ? "Custom targets stay unchanged when you switch priorities." : calc.available ? calc.note : calc.reason}</p>
        {!manual && calc.available && draft.goal === "Bulking" && calc.age >= 19 && <p className="form-hint">Your muscle-gain plan adds a little extra energy and adjusts protein to your saved weight. You can change these preferences above.</p>}
        <button type="button" className="text-btn" onClick={() => navigate("profile")}>Update profile inputs ↗</button>
        <div className="form-grid">{fields.map(([key, label]) => <Field key={key} label={label} name={key} type="number" min="1" max="20000" step="1" required={manual} disabled={!manual} value={targets?.[key] ?? ""} placeholder="Needs profile inputs" onChange={(e) => setCustom({ ...custom, [key]: e.target.value })} />)}</div>
        {targets && <p className="form-hint">Per-meal planning guide ({plan.mealsPerDay} meals): approximately {Math.round(Number(targets.kcal) / plan.mealsPerDay)} kcal and {Math.round(Number(targets.protein) / plan.mealsPerDay)} g protein. Meals do not have to be identical.</p>}
        {!calc.available && !manual && <p className="form-hint">Add a few details to your profile to get personalized estimates, or enter your own goals. Your saved goals will stay in place until then.</p>}
        <h3>Cuisines to explore</h3><div className="cuisine-grid">{choices.map((c, i) => <label key={c} className={i < 8 ? "recommended" : ""}><input type="checkbox" checked={(draft.cuisines || []).includes(c)} onChange={() => change("cuisines", draft.cuisines.includes(c) ? draft.cuisines.filter((v) => v !== c) : [...draft.cuisines, c])} />{c}{i < 8 && <small>Suggested</small>}</label>)}</div>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary" type="submit">Save priority & goals</button>
      </form>
    </Panel>
    <Panel title={`Meal ideas for ${draft.goal.toLowerCase()}`} subtitle="Preview uses the selected priority and your dietary rules; save to apply it elsewhere.">{recipes.map((recipe) => { const coverage = recipeStockCoverage(recipe, pool); return <button className="summary-food" key={recipe.id} onClick={() => setModal({ type: "recipe", recipe })}><span>{recipe.emoji}</span><strong>{recipe.name}</strong><small>{coverage.percent}% of ingredient grams in stock · {coverage.missing} ingredients need topping up</small></button>; })}</Panel>
  </div>;
}
