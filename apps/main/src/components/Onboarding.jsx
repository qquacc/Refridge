import React, { useEffect, useRef, useState } from "react";
import { allergens, dietaryChoices } from "../../../../packages/shared/dietary.mjs";
import { ageAt } from "../../../../packages/shared/nutrition.mjs";
import { today } from "../data/food.mjs";
import { finishOnboardingStep, onboardingQuestions, currentOnboardingStep } from "../lib/onboarding.mjs";
export default function Onboarding({ state, setState, saveStatus, error: cloudError, onLogout, signingOut, onComplete }) {
  const step = state.profile.accountFor ? currentOnboardingStep(state) : -1;
  const [draft, setDraft] = useState({ ...state.profile, activity: ({ Moderate: "Active", Light: "Low active", Low: "Inactive", High: "Very active" })[state.profile.activity] || state.profile.activity }), [error, setError] = useState("");
  const family = draft.accountFor === "family";
  const question = step === -1 ? "Who are you setting this up for?" : family ? ["What’s their name?", "How old are they?", "What’s their weight?", "How tall are they?", "What’s their gender?", "How do they like to eat?", "Any ingredients they need to avoid?", "How active is their typical day?", "What matters most to them?"][step] : onboardingQuestions[step];
  const heading = useRef(null);
  useEffect(() => { heading.current?.focus(); setError(""); }, [step]);
  function toggle(key, value) { setDraft((d) => ({ ...d, [key]: (d[key] || []).includes(value) ? d[key].filter((v) => v !== value) : [...(d[key] || []), value] })); }
  function next(skip = false) {
    try { const updated = finishOnboardingStep(state, draft, step, today(), skip); setState(updated); setDraft(updated.profile); if (updated.onboarding.completed) onComplete?.(); }
    catch (e) { setError(e.message); }
  }
  return <main className="onboarding-shell">
    <header><span className="setup-brand"><img src="/fridge-mark.svg" alt="" />Refridge<span>.</span></span><div className="setup-account-actions"><span>{saveStatus}</span><button type="button" className="btn outline header-logout" disabled={signingOut} onClick={onLogout}>{signingOut ? "Logging out…" : "Log out"}</button></div></header>
    <section className="onboarding-card">
      <p className="eyebrow">A KITCHEN THAT KNOWS YOU · {step + 2} OF {onboardingQuestions.length + 1}</p>
      <progress aria-label="Setup progress" max={onboardingQuestions.length + 1} value={step + 2} />
      <h1 ref={heading} tabIndex={-1}>{question}</h1>
      <p className="onboarding-hint">{step === -1 ? "Choose yourself, or help a close family member such as a parent or senior get started." : family ? "Answer about the person you’re helping. Their details will be used for this kitchen’s food goals and trends." : ["A first name or nickname is perfect.", "Your date of birth keeps your age up to date. This is optional.", "Optional. Enter kilograms to help estimate your food goals.", "Optional. Enter centimetres; we’ll save this to your profile.", "Choose what fits, or prefer not to say. You can change this later.", "We’ll use this to filter meal ideas. Choose any that fit.", "This helps filter suggestions. Always check food labels and recipes yourself.", "Pick the closest description. You can change it later.", "Let’s start with one priority. You can explore everything in the app."][step]}</p>
      <form onSubmit={(e) => { e.preventDefault(); next(); }}>
        {step === -1 && <div className="setup-choices single">{[["myself", "For myself", "Track my food, goals, and wellbeing."], ["family", "For a close family member", "Help someone close to me, such as a parent or senior."]].map(([value, label, description]) => <label key={value}><input type="radio" name="accountFor" required checked={draft.accountFor === value} onChange={() => setDraft({ ...draft, accountFor: value })} /><span><strong>{label}</strong><small style={{ display: "block", marginTop: 6 }}>{description}</small></span></label>)}</div>}
        {step === 0 && <label className="setup-field">{family ? "Their name" : "Your name"}<input autoComplete={family ? "off" : "given-name"} value={draft.name || ""} maxLength={80} required onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>}
        {step === 1 && <label className="setup-field">Date of birth<input type="date" max={today()} value={draft.birthday || ""} onChange={(e) => setDraft({ ...draft, birthday: e.target.value })} />{draft.birthday && ageAt(draft.birthday) !== null && <span>{ageAt(draft.birthday)} years old</span>}</label>}
        {step === 2 && <label className="setup-field">Weight (kg)<input type="number" inputMode="decimal" min="1" max="700" step="0.1" placeholder="e.g. 70" value={draft.weightKg ?? ""} onChange={(e) => setDraft({ ...draft, weightKg: e.target.value })} /></label>}
        {step === 3 && <label className="setup-field">Height (cm)<input type="number" inputMode="decimal" min="30" max="300" step="0.1" placeholder="e.g. 175" value={draft.heightM === "" || draft.heightM == null ? "" : Math.round(Number(draft.heightM) * 1000) / 10} onChange={(e) => setDraft({ ...draft, heightM: e.target.value === "" ? "" : Number(e.target.value) / 100 })} /></label>}
        {step === 4 && <div className="setup-choices single">{["Woman", "Man", "Non-binary", "Self-described", "Prefer not to say"].map((gender) => <label key={gender}><input name="gender" type="radio" checked={draft.gender === gender} onChange={() => setDraft({ ...draft, gender })} /><span>{gender}</span></label>)}</div>}
        {step === 5 && <div className="setup-choices">{dietaryChoices.map((d) => <label key={d}><input type="checkbox" checked={(draft.diets || []).includes(d)} onChange={() => toggle("diets", d)} /><span>{d}</span></label>)}</div>}
        {step === 6 && <><div className="setup-choices">{allergens.map((a) => <label key={a}><input type="checkbox" checked={(draft.allergenAvoid || []).includes(a)} onChange={() => toggle("allergenAvoid", a)} /><span>{a}</span></label>)}</div><label className="setup-field">Anything else to avoid? (optional)<input value={draft.allergies || ""} maxLength={400} onChange={(e) => setDraft({ ...draft, allergies: e.target.value })} /></label></>}
        {step === 7 && <div className="setup-choices single">{[["Inactive", "Mostly sitting"], ["Low active", "Some walking and movement"], ["Active", "Regular activity"], ["Very active", "Very active most days"]].map(([value, label]) => <label key={value}><input name="activity" type="radio" checked={(({ Moderate: "Active", Light: "Low active", Low: "Inactive", High: "Very active" })[draft.activity] || draft.activity) === value} onChange={() => setDraft({ ...draft, activity: value })} /><span>{label}</span></label>)}</div>}
        {step === 8 && <div className="setup-choices single">{["Less waste", "Affordability", "Balanced variety"].map((g) => <label key={g}><input name="goal" type="radio" checked={draft.goal === g} onChange={() => setDraft({ ...draft, goal: g })} /><span>{g}</span></label>)}</div>}
        {(error || cloudError) && <p className="error" role="alert">{error || cloudError}</p>}
        <div className="setup-actions">{step >= 0 && <button type="button" className="btn outline" onClick={() => setState((s) => step === 0 ? { ...s, profile: { ...s.profile, accountFor: "" } } : { ...s, onboarding: { version: 2, completed: false, step: step - 1 } })}>Back</button>}<button className="btn primary" type="submit">{step === onboardingQuestions.length - 1 ? (family ? "Open their fridge" : "Open my fridge") : "Continue"} →</button></div>
        {step > 0 && <button type="button" className="text-btn" onClick={() => next(true)}>Skip this question</button>}
      </form>
      <button className="text-btn setup-later" onClick={() => setState((s) => ({ ...s, onboarding: { version: 2, completed: true, step: 0, deferred: true } }))}>Set up later</button>
    </section>
  </main>;
}
