import React, { useEffect, useRef, useState } from "react";
import { allergens, dietaryChoices } from "../../../../packages/shared/dietary.mjs";
import { ageAt } from "../../../../packages/shared/nutrition.mjs";
import { today } from "../data/food.mjs";
import { finishOnboardingStep, onboardingQuestions } from "../lib/onboarding.mjs";
export default function Onboarding({ state, setState, saveStatus, error: cloudError }) {
  const step = Math.max(0, Math.min(5, state.onboarding?.step || 0));
  const [draft, setDraft] = useState({ ...state.profile, activity: ({ Moderate: "Active", Light: "Low active", Low: "Inactive", High: "Very active" })[state.profile.activity] || state.profile.activity }), [error, setError] = useState("");
  const heading = useRef(null);
  useEffect(() => { heading.current?.focus(); setError(""); }, [step]);
  function toggle(key, value) { setDraft((d) => ({ ...d, [key]: (d[key] || []).includes(value) ? d[key].filter((v) => v !== value) : [...(d[key] || []), value] })); }
  function next(skip = false) {
    try { const updated = finishOnboardingStep(state, draft, step, today(), skip); setState(updated); setDraft(updated.profile); }
    catch (e) { setError(e.message); }
  }
  return <main className="onboarding-shell">
    <header><span className="setup-brand"><img src="/fridge-mark.svg" alt="" />Refridge<span>.</span></span><span>{saveStatus}</span></header>
    <section className="onboarding-card">
      <p className="eyebrow">A KITCHEN THAT KNOWS YOU · {step + 1} OF 6</p>
      <progress aria-label="Setup progress" max={6} value={step + 1} />
      <h1 ref={heading} tabIndex={-1}>{onboardingQuestions[step]}</h1>
      <p className="onboarding-hint">{["A first name or nickname is perfect.", "Your date of birth keeps your age up to date. This is optional.", "We’ll use this to filter meal ideas. Choose any that fit.", "This helps filter suggestions. Always check food labels and recipes yourself.", "Pick the closest description. You can change it later.", "Let’s start with one priority. You can explore everything in the app."][step]}</p>
      <form onSubmit={(e) => { e.preventDefault(); next(); }}>
        {step === 0 && <label className="setup-field">Your name<input autoComplete="given-name" value={draft.name || ""} maxLength={80} required onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>}
        {step === 1 && <label className="setup-field">Date of birth<input type="date" max={today()} value={draft.birthday || ""} onChange={(e) => setDraft({ ...draft, birthday: e.target.value })} />{draft.birthday && ageAt(draft.birthday) !== null && <span>{ageAt(draft.birthday)} years old</span>}</label>}
        {step === 2 && <div className="setup-choices">{dietaryChoices.map((d) => <label key={d}><input type="checkbox" checked={(draft.diets || []).includes(d)} onChange={() => toggle("diets", d)} /><span>{d}</span></label>)}</div>}
        {step === 3 && <><div className="setup-choices">{allergens.map((a) => <label key={a}><input type="checkbox" checked={(draft.allergenAvoid || []).includes(a)} onChange={() => toggle("allergenAvoid", a)} /><span>{a}</span></label>)}</div><label className="setup-field">Anything else to avoid? (optional)<input value={draft.allergies || ""} maxLength={400} onChange={(e) => setDraft({ ...draft, allergies: e.target.value })} /></label></>}
        {step === 4 && <div className="setup-choices single">{[["Inactive", "Mostly sitting"], ["Low active", "Some walking and movement"], ["Active", "Regular activity"], ["Very active", "Very active most days"]].map(([value, label]) => <label key={value}><input name="activity" type="radio" checked={(({ Moderate: "Active", Light: "Low active", Low: "Inactive", High: "Very active" })[draft.activity] || draft.activity) === value} onChange={() => setDraft({ ...draft, activity: value })} /><span>{label}</span></label>)}</div>}
        {step === 5 && <div className="setup-choices single">{["Less waste", "Affordability", "Balanced variety"].map((g) => <label key={g}><input name="goal" type="radio" checked={draft.goal === g} onChange={() => setDraft({ ...draft, goal: g })} /><span>{g}</span></label>)}</div>}
        {(error || cloudError) && <p className="error" role="alert">{error || cloudError}</p>}
        <div className="setup-actions">{step > 0 && <button type="button" className="btn outline" onClick={() => setState((s) => ({ ...s, onboarding: { completed: false, step: step - 1 } }))}>Back</button>}<button className="btn primary" type="submit">{step === 5 ? "Open my fridge" : "Continue"} →</button></div>
        {step > 0 && <button type="button" className="text-btn" onClick={() => next(true)}>Skip this question</button>}
      </form>
      <button className="text-btn setup-later" onClick={() => setState((s) => ({ ...s, onboarding: { completed: true, step: 0, deferred: true } }))}>Set up later</button>
    </section>
  </main>;
}
