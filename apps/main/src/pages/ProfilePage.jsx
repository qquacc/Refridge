import CityField from "../components/CityField.jsx";
import Icon from "../components/Icon.jsx";
import { saveWeight } from "../lib/insights.mjs";
import { today } from "../data/food.mjs";
import React, { useState } from "react";
import { Panel, Field, ErrorMessage } from "../components/FeatureUI.jsx";
import {
  allergens,
  dietaryChoices,
} from "../../../../packages/shared/dietary.mjs";
import { automaticTargets } from "../../../../packages/shared/nutrition.mjs";
import { photoDataUrl } from "../lib/photos.mjs";
export default function ProfilePage({ state, setState, notify }) {
  const [photo, setPhoto] = useState(state.profile.avatar || "");
  const [error, setError] = useState("");
  const calc = automaticTargets(state.profile);
  function save(e) {
    e.preventDefault();
    try {
      const f = new FormData(e.currentTarget);
      const profile = {
        ...state.profile,
        name: String(f.get("name")).trim(),
        weightKg: f.get("weightKg") ? Number(f.get("weightKg")) : "",
        heightM: f.get("heightM") ? Number(f.get("heightM")) : "",
        birthday: String(f.get("birthday")),
        gender: String(f.get("gender")),
        referenceSex: String(f.get("referenceSex")),
        activity: String(f.get("activity")),
        lifeStage: String(f.get("lifeStage")),
        allergies: String(f.get("allergies")),
        allergenAvoid: f.getAll("allergen"),
        diets: f.getAll("diet"),
        avatar: photo,
        complete: true,
      };
      if (!profile.name) throw Error("Enter your display name.");
      setState((s) => {
        const next = {
        ...s,
        profile,
        members: s.members.map((m) =>
          m.id === "me" ? { ...m, name: profile.name, avatar: photo } : m,
        ),
      };
        return profile.weightKg && Number(profile.weightKg) !== Number(s.profile.weightKg) ? saveWeight(next, { date: today(), kg: profile.weightKg }, today()) : next;
      });
      notify("Profile and dietary preferences saved");
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <div className="feature-page">
      <Panel
        title="Your profile"
        subtitle="Your profile is saved privately to your account. Update these details whenever you like."
      >
        <button type="button" className="btn outline repeat-onboarding" onClick={() => setState((s) => ({ ...s, onboarding: { completed: false, step: 0 } }))}><Icon name="profile" size={18} /> Repeat guided setup →</button>
        <ErrorMessage error={error} />
        <CityField value={state.profile.city} location={state.profile.cityLocation} onChange={(city, cityLocation) => setState((s) => ({ ...s, profile: { ...s.profile, city, cityLocation } }))} />
        <form className="feature-form" onSubmit={save}>
          <div className="profile-photo-row">
            {photo ? (
              <img
                src={photo}
                alt="Profile preview"
                className="profile-photo"
              />
            ) : (
              <div className="profile-photo profile-photo-placeholder" role="img" aria-label="No profile photo selected">
                <Icon name="profile" size={36} />
              </div>
            )}
            <label className="file-label">
              Choose profile photo
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  try {
                    setPhoto(await photoDataUrl(e.target.files[0], 256));
                  } catch (e) {
                    setError(e.message);
                  }
                }}
              />
            </label>
            {photo && (
              <button
                className="text-btn"
                type="button"
                onClick={() => setPhoto("")}
              >
                Remove photo
              </button>
            )}
          </div>
          <div className="form-grid">
            <Field
              label="Display name"
              name="name"
              required
              defaultValue={
                state.profile.name === "You" ? "" : state.profile.name
              }
            />
            <Field
              label="Birthday"
              name="birthday"
              type="date"
              max={new Date().toLocaleDateString("en-CA")}
              defaultValue={state.profile.birthday}
            />
            <Field
              label="Weight (kg)"
              name="weightKg"
              type="number"
              step="0.1"
              min="1"
              max="700"
              defaultValue={state.profile.weightKg}
            />
            <Field
              label="Height (m)"
              name="heightM"
              type="number"
              step="0.01"
              min="0.3"
              max="3"
              defaultValue={state.profile.heightM}
            />
            <Field label="Gender">
              <select name="gender" defaultValue={state.profile.gender}>
                {[
                  "Prefer not to say",
                  "Woman",
                  "Man",
                  "Non-binary",
                  "Self-described",
                ].map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </Field>
            <Field label="Reference sex for nutrition equations">
              <select
                name="referenceSex"
                defaultValue={state.profile.referenceSex}
              >
                <option value="">
                  Use selected Man/Woman reference, if provided
                </option>
                <option value="male">Male reference</option>
                <option value="female">Female reference</option>
              </select>
            </Field>
            <Field label="Activity">
              <select name="activity" defaultValue={state.profile.activity}>
                {["Low", "Light", "Moderate", "High", "Very high"].map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </Field>
            <Field label="Pregnancy / lactation">
              <select name="lifeStage" defaultValue={state.profile.lifeStage}>
                <option>Neither</option>
                <option>Pregnant</option>
                <option>Breastfeeding</option>
              </select>
            </Field>
          </div>
          <p className="form-hint">
            Your details help personalize food goals. If automatic goals aren’t
            suitable for you, you can enter your own in Food goals. Your gender
            and the reference used for estimates can be chosen separately.
          </p>
          <fieldset>
            <legend>Allergens to exclude from suggestions</legend>
            <div className="check-chips">
              {allergens.map((a) => (
                <label key={a}>
                  <input
                    type="checkbox"
                    name="allergen"
                    value={a}
                    defaultChecked={state.profile.allergenAvoid.includes(a)}
                  />
                  {a}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Dietary preferences</legend>
            <div className="check-chips">
              {dietaryChoices.map((a) => (
                <label key={a}>
                  <input
                    type="checkbox"
                    name="diet"
                    value={a}
                    defaultChecked={state.profile.diets.includes(a)}
                  />
                  {a}
                </label>
              ))}
            </div>
          </fieldset>
          <Field
            label="Other allergies or dietary notes"
            name="allergies"
            maxLength={400}
            defaultValue={state.profile.allergies}
          />
          <p className="form-hint">
            Tell us what to avoid so we can filter meal ideas. Always check labels
            and how food was prepared, especially for allergies.
          </p>
          <button type="submit" className="btn primary">
            Save profile
          </button>
        </form>
      </Panel>
      <Panel
        title="Your maintenance reference"
        subtitle={calc.available ? calc.method : calc.reason}
      >
        {calc.available ? (
          <div className="feature-metrics">
            <div className="feature-metric">
              <span>Estimated maintenance energy</span>
              <strong>{calc.targets.kcal} kcal</strong>
            </div>
            <div className="feature-metric">
              <span>Body mass index</span>
              <strong>{calc.bmi}</strong>
              <small>
                Informational; BMI alone does not determine nutrient needs.
              </small>
            </div>
            <div className="feature-metric">
              <span>Equation reference</span>
              <strong>{calc.reference}</strong>
              <a href={calc.source} target="_blank" rel="noreferrer">
                Health Canada source ↗
              </a>
            </div>
          </div>
        ) : (
          <p className="body-copy">
            Complete the fields above or set individual targets in Food goals.
          </p>
        )}
      </Panel>
    </div>
  );
}
