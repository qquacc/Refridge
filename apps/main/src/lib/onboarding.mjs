import { saveWeight } from "./insights.mjs";
export const onboardingQuestions = ["What’s your name?", "How old are you?", "What’s your weight?", "How tall are you?", "What’s your gender?", "How do you like to eat?", "Any ingredients you need to avoid?", "How active is a typical day?", "What matters most to you?", "Which city do you live in?"];
export function currentOnboardingStep(state) {
  const saved = state.onboarding?.step || 0;
  // Resuming the old flow should ask the newly added body questions first.
  return Math.max(0, Math.min(onboardingQuestions.length - 1, state.onboarding?.version === 2 ? saved : Math.min(saved, 2)));
}
export function finishOnboardingStep(state, draft, step, today, skip = false) {
  const profile = { ...state.profile };
  if (step === -1) {
    if (!["myself", "family"].includes(draft.accountFor)) throw Error("Choose who this account is for.");
    return { ...state, profile: { ...profile, accountFor: draft.accountFor }, onboarding: { ...state.onboarding, version: 2, completed: false, step: currentOnboardingStep(state) } };
  }
  if (step === 0) {
    if (!String(draft.name || "").trim()) throw Error("Enter the name you’d like us to use.");
    profile.name = String(draft.name).trim().slice(0, 80);
  }
  if (!skip) {
    if (step === 1) {
      const date = draft.birthday || "";
      const parsed = new Date(date + "T12:00:00");
      if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today || !Number.isFinite(parsed.getTime()) || parsed.getFullYear() !== Number(date.slice(0, 4)) || parsed.getMonth() + 1 !== Number(date.slice(5, 7)) || parsed.getDate() !== Number(date.slice(8)))) throw Error("Enter a valid birthday that isn’t in the future.");
      profile.birthday = date;
    }
    if (step === 2) {
      if (draft.weightKg !== "" && draft.weightKg != null) {
        const value = Number(draft.weightKg);
        if (!Number.isFinite(value) || value < 1 || value > 700) throw Error("Enter a weight between 1 and 700 kg, or skip this question.");
        profile.weightKg = value;
      } else profile.weightKg = "";
    }
    if (step === 3) {
      if (draft.heightM !== "" && draft.heightM != null) {
        const value = Number(draft.heightM);
        if (!Number.isFinite(value) || value < 0.3 || value > 3) throw Error("Enter a height between 30 and 300 cm, or skip this question.");
        profile.heightM = value;
      } else profile.heightM = "";
    }
    if (step === 4) {
      if (!["Woman", "Man", "Non-binary", "Self-described", "Prefer not to say"].includes(draft.gender)) throw Error("Choose a gender option, or skip this question.");
      profile.gender = draft.gender;
    }
    if (step === 5) profile.diets = draft.diets || [];
    if (step === 6) { profile.allergenAvoid = draft.allergenAvoid || []; profile.allergies = String(draft.allergies || "").slice(0, 400); }
    if (step === 7) profile.activity = draft.activity;
    if (step === 8) profile.goal = draft.goal;
    if (step === 9) { profile.city = String(draft.city || "").trim().slice(0, 80); profile.cityLocation = draft.cityLocation || null; }
  }
  const completed = step === onboardingQuestions.length - 1;
  if (completed) profile.complete = true;
  const next = { ...state, profile, members: state.members.map((m) => m.id === "me" ? { ...m, name: profile.name } : m), onboarding: { version: 2, completed, step: completed ? 0 : step + 1 } };
  return step === 2 && !skip && Number(profile.weightKg) > 0 ? saveWeight(next, { date: today, kg: profile.weightKg }, today) : next;
}
