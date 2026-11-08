export const onboardingQuestions = ["What’s your name?", "How old are you?", "How do you like to eat?", "Any ingredients you need to avoid?", "How active is a typical day?", "What matters most to you?"];
export function finishOnboardingStep(state, draft, step, today, skip = false) {
  const profile = { ...state.profile };
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
    if (step === 2) profile.diets = draft.diets || [];
    if (step === 3) { profile.allergenAvoid = draft.allergenAvoid || []; profile.allergies = String(draft.allergies || "").slice(0, 400); }
    if (step === 4) profile.activity = draft.activity;
    if (step === 5) profile.goal = draft.goal;
  }
  const completed = step === onboardingQuestions.length - 1;
  if (completed) profile.complete = true;
  return { ...state, profile, members: state.members.map((m) => m.id === "me" ? { ...m, name: profile.name } : m), onboarding: { completed, step: completed ? 0 : step + 1 } };
}
