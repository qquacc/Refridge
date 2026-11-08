import { photoDataUrl } from "../lib/photos.mjs";
import { cameraApi } from "../../../../packages/shared/camera-client.mjs";
import { importBackup } from "../lib/backup.mjs";
import React, { useEffect, useState } from "react";
import Icon from "./Icon.jsx";
import { download } from "../lib/files.mjs";
import {
  today,
  daysFromNow,
  uid,
  catalog,
  recipeNutrition,
} from "../data/food.mjs";
import {
  logRemoval as consume,
  makePersonalMeal as cook,
  recipeMissing as missingIngredients,
  ownAccessibleItems,
} from "../lib/domain.mjs";
export default function FoodModal({
  model,
  close,
  state,
  setState,
  notify,
  addGroceries,
}) {
  const [error, setError] = useState("");
  const [amount, setAmount] = useState(
    model.food ? Math.min(100, model.food.grams) : 50,
  );
  const [choice, setChoice] = useState(catalog[0].name);
  const [photo, setPhoto] = useState("");
  const [recognizing, setRecognizing] = useState(false), [mealEstimate, setMealEstimate] = useState(null);
  const [mealDraft, setMealDraft] = useState({ name: "", kcal: "", protein: "", carbs: "", fat: "", fiber: "" });
  const recognition = React.useRef(null);
  useEffect(() => () => recognition.current?.abort(), []);
  async function recognizeMeal() {
    if (!photo || recognizing) return;
    const controller = new AbortController(); recognition.current = controller;
    const timer = setTimeout(() => controller.abort(), 35000);
    setRecognizing(true); setError("");
    try {
      const result = await cameraApi("/api/meals/recognize", { method: "POST", body: { jpegBase64: photo.split(",")[1] }, signal: controller.signal });
      if (controller.signal.aborted) return;
      setMealDraft({ name: result.name, ...Object.fromEntries(["kcal", "protein", "carbs", "fat", "fiber"].map((k) => [k, result.nutrients[k] ?? ""])) }); setMealEstimate(result);
    } catch (e) { if (!controller.signal.aborted) setError(e.message); else setError("Recognition stopped. Try again or fill in the meal manually."); }
    finally { clearTimeout(timer); setRecognizing(false); }
  }
  const ref = React.useRef(null);
  const title = {
    add: "Something fresh for your fridge",
    consume: "What happened to this food?",
    recipe: model.recipe?.name,
    outside: "A meal, wherever you are",
    install: "Your kitchen, one tap away",
    settings: "Make this kitchen yours",
    sensor: "Try a container reading",
  }[model.type];
  useEffect(() => {
    const before = document.activeElement;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const handler = (e) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab") {
        const nodes = ref.current.querySelectorAll(
          'button,input,select,textarea,[tabindex="0"]',
        );
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", handler);
      before?.focus();
    };
  }, []);
  useEffect(
    () => () => {
      if (photo) URL.revokeObjectURL(photo);
    },
    [photo],
  );
  function submit(e) {
    e.preventDefault();
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      if (model.type === "add") {
        const base = catalog.find((c) => c.name === choice) || catalog[0];
        const custom = choice === "custom";
        const name = custom ? String(f.get("name")).trim() : base.name;
        if (!name) throw Error("Give your food a name.");
        const grams = Number(f.get("grams"));
        if (!Number.isFinite(grams) || grams <= 0)
          throw Error("Enter a positive quantity.");
        const expires = String(f.get("expires"));
        if (!/^\d{4}-\d{2}-\d{2}$/.test(expires))
          throw Error("Choose an expiry date.");
        const item = {
          ...base,
          id: uid(),
          name,
          grams,
          expires,
          ...(custom
            ? {
                emoji: "🍽️",
                category: "Other",
                color: "#e7eadf",
                kcal: 0,
                protein: 0,
                carbs: 0,
                fat: 0,
                fiber: 0,
              }
            : {}),
        };
        if (custom) {
          for (const k of ["kcal", "protein", "carbs", "fat", "fiber"])
            item[k] = Number(f.get(k)) || 0;
        }
        setState((s) => ({ ...s, items: [...s.items, item] }));
        notify("Added to your fridge");
      }
      if (model.type === "consume" || model.type === "sensor") {
        const id =
          model.type === "consume" ? model.food.id : String(f.get("food"));
        const grams = Number(f.get("grams"));
        const action = String(f.get("action"));
        setState(consume(state, id, grams, action));
        notify(
          action === "eaten"
            ? "Food logged and fridge updated"
            : "Quantity updated · no intake logged",
        );
      }
      if (model.type === "outside") {
        const name = String(f.get("name")).trim();
        if (!name) throw Error("Enter a meal name.");
        const nutrients = Object.fromEntries(
          ["kcal", "protein", "carbs", "fat", "fiber"].map((k) => [
            k,
            f.get(k) === "" ? null : Number(f.get(k)),
          ]),
        );
        setState((s) => ({
          ...s,
          logs: [
            ...s.logs,
            {
              id: uid(),
              userId: "me",
              date: today(),
              name,
              emoji: "🍽️",
              source: mealEstimate ? "Gemini photo estimate · reviewed" : "outside",
              estimated: !!mealEstimate,
              grams: mealEstimate?.grams ?? null,
              nutrients,
            },
          ],
        }));
        notify("Meal added to today’s diary");
      }
      if (model.type === "settings") {
        setState((s) => ({
          ...s,
          household: String(f.get("household")).trim() || "My kitchen",
          profile: { ...s.profile, targetMode: "manual" },
          goals: {
            ...s.goals,
            kcal: Number(f.get("kcal")),
            protein: Number(f.get("protein")),
            fiber: Number(f.get("fiber")),
          },
        }));
        notify("Kitchen settings saved");
      }
      close();
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        ref={ref}
      >
        <div className="modal-header">
          <span className="eyebrow">REFRIDGE · YOUR EVERYDAY COMPANION</span>
          <button
            className="icon-btn"
            aria-label="Close dialog"
            onClick={close}
          >
            <Icon name="close" />
          </button>
        </div>
        <h2 id="modal-title">{title}</h2>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {model.type === "add" && (
          <form onSubmit={submit}>
            <p className="modal-intro">
              Start with a familiar food or add one of your own.
            </p>
            <label>
              Food
              <select
                value={choice}
                onChange={(e) => setChoice(e.target.value)}
              >
                {catalog.map((c) => (
                  <option key={c.name}>{c.name}</option>
                ))}
                <option value="custom">Something else…</option>
              </select>
            </label>
            {choice === "custom" && (
              <>
                <label>
                  Food name
                  <input
                    name="name"
                    required
                    maxLength={80}
                    placeholder="e.g. Brown rice"
                  />
                </label>
                <p className="form-hint">
                  Optional nutrition per 100 g. Blank fields are unknown.
                </p>
                <div className="form-grid">
                  {["kcal", "protein", "carbs", "fat", "fiber"].map((k) => (
                    <label key={k}>
                      {k === "kcal" ? "Energy (kcal)" : k + " (g)"}
                      <input
                        name={k}
                        type="number"
                        min="0"
                        step="0.1"
                        placeholder="Unknown"
                      />
                    </label>
                  ))}
                </div>
              </>
            )}
            <div className="form-grid">
              <label>
                Quantity (g)
                <input
                  name="grams"
                  type="number"
                  min="1"
                  max="100000"
                  step="1"
                  required
                  defaultValue="250"
                />
              </label>
              <label>
                Expiry date
                <input
                  name="expires"
                  type="date"
                  required
                  defaultValue={daysFromNow(5)}
                />
              </label>
            </div>
            <button className="btn primary wide" type="submit">
              Add to my fridge
              <Icon name="plus" size={18} />
            </button>
          </form>
        )}
        {(model.type === "consume" || model.type === "sensor") && (
          <form onSubmit={submit}>
            <p className="modal-intro">
              {model.type === "sensor"
                ? "Simulated hardware reading. Confirm why food left the container."
                : "Removing food doesn’t always mean eating it. Tell us what changed."}
            </p>
            {model.type === "sensor" ? (
              <label>
                Container food
                <select name="food" required>
                  {state.items
                    .filter((i) => i.grams > 0)
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} · {i.grams} g available
                      </option>
                    ))}
                </select>
              </label>
            ) : (
              <div className="selected-food">
                <span>{model.food.emoji}</span>
                <div>
                  <strong>{model.food.name}</strong>
                  <small>{model.food.grams} g available</small>
                </div>
              </div>
            )}
            <label>
              Amount removed (g)
              <input
                name="grams"
                type="number"
                min="0.1"
                max={model.food?.grams || 100000}
                step="0.1"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label>
              What happened?
              <select name="action">
                <option value="eaten">I ate it — log intake</option>
                <option value="discarded">
                  Discarded — update quantity only
                </option>
                <option value="moved">
                  Moved elsewhere — update quantity only
                </option>
              </select>
            </label>
            <button
              type="submit"
              className="btn primary wide"
              disabled={
                model.type === "sensor" && !state.items.some((i) => i.grams > 0)
              }
            >
              Confirm update
              <Icon name="check" size={18} />
            </button>
          </form>
        )}
        {model.type === "recipe" &&
          (() => {
            const r = model.recipe;
            const missing = missingIngredients(r, ownAccessibleItems(state));
            const n = recipeNutrition(r);
            return (
              <>
                <div
                  className="modal-recipe-art"
                  style={{ background: r.color }}
                >
                  {r.emoji}
                </div>
                <p className="modal-intro">
                  {r.time} minutes · 1 serving · approximately{" "}
                  {Math.round(n.kcal)} kcal
                </p>
                <h3>What you’ll need</h3>
                <div className="ingredient-list">
                  {r.ingredients.map(([name, g]) => (
                    <div key={name}>
                      <span>
                        {missing.some((m) => m[0] === name) ? (
                          <span className="missing-dot" />
                        ) : (
                          <Icon name="check" size={16} />
                        )}{" "}
                        {name}
                      </span>
                      <span>{g} g</span>
                    </div>
                  ))}
                </div>
                <a href={r.sourceUrl} target="_blank" rel="noreferrer">
                  Canada’s Food Guide recipe inspiration ↗
                </a>
                <h3>Method</h3>
                <ol className="recipe-steps">
                  {r.steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
                <p className="form-hint">
                  Nutrition is an estimate. Extra toppings and changes to the recipe
                  can change the totals.
                </p>
                {missing.length ? (
                  <button
                    className="btn primary wide"
                    onClick={() => {
                      addGroceries(missing.map((m) => m[0]));
                      close();
                    }}
                  >
                    Add missing ingredients
                    <Icon name="plus" size={18} />
                  </button>
                ) : (
                  <button
                    className="btn primary wide"
                    onClick={() => {
                      try {
                        setState(cook(state, r));
                        notify("Meal logged · ingredients updated");
                        close();
                      } catch (e) {
                        setError(e.message);
                      }
                    }}
                  >
                    I made this — log meal
                    <Icon name="check" size={18} />
                  </button>
                )}
              </>
            );
          })()}
        {model.type === "outside" && (
          <form onSubmit={submit}>
            <p className="modal-intro">
              Take a clear meal photo for a quick AI estimate, or enter the details manually. Review all estimates before saving.
            </p>
            <label className="photo-picker">
              {photo ? (
                <img src={photo} alt="Your meal preview" />
              ) : (
                <>
                  <span>📷</span>
                  <strong>Add a meal photo</strong>
                  <small>Choose a photo, then tap Recognize meal</small>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                aria-label="Choose meal photo"
                disabled={recognizing}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    if (!f.type.startsWith("image/")) {
                      setError("Choose an image file.");
                      return;
                    }
                    try { setPhoto(await photoDataUrl(f, 768)); setMealEstimate(null); setError(""); } catch (e) { setError(e.message); }
                  }
                }}
              />
            </label>
            {photo && <button className="btn outline wide" type="button" disabled={recognizing} onClick={recognizeMeal}>{recognizing ? "Recognizing meal…" : "Recognize meal with AI"}</button>}
            {photo && <p className="form-hint">The photo is sent to Gemini for recognition. Refridge doesn’t keep the photo.</p>}
            {mealEstimate && <p className="notice">Approximate serving: {mealEstimate.grams ? `${mealEstimate.grams} g` : "amount unknown"}. {mealEstimate.note} Photo estimates can miss hidden ingredients; always check allergens separately.</p>}
            <label>
              Meal name
              <input
                name="name"
                value={mealDraft.name}
                onChange={(e) => setMealDraft((s) => ({ ...s, name: e.target.value }))}
                disabled={recognizing}
                required
                maxLength={100}
                placeholder="e.g. Lunch at the campus café"
              />
            </label>
            <div className="form-grid">
              {["kcal", "protein", "carbs", "fat", "fiber"].map((k) => (
                <label key={k}>
                  {k === "kcal" ? "Energy (kcal)" : k + " (g)"}
                  <input
                    name={k}
                    value={mealDraft[k]}
                    onChange={(e) => setMealDraft((s) => ({ ...s, [k]: e.target.value }))}
                    disabled={recognizing}
                    type="number"
                    min="0"
                    max="100000"
                    step="0.1"
                    placeholder="Unknown"
                  />
                </label>
              ))}
            </div>
            <button className="btn primary wide" type="submit" disabled={recognizing}>
              Save meal estimate
              <Icon name="check" size={18} />
            </button>
          </form>
        )}
        {model.type === "install" && (
          <>
            <p className="modal-intro">
              Keep Refridge on your iPhone Home Screen for a more app-like
              experience.
            </p>
            <ol className="install-steps">
              <li>
                <span>1</span>
                <div>
                  <strong>Open this page in Safari</strong>
                  <p>Use the deployed HTTPS link on your iPhone.</p>
                </div>
              </li>
              <li>
                <span>2</span>
                <div>
                  <strong>Tap the Share button</strong>
                  <p>Then choose “Add to Home Screen”.</p>
                </div>
              </li>
              <li>
                <span>3</span>
                <div>
                  <strong>Choose Add</strong>
                  <p>Keep “Open as Web App” enabled if shown.</p>
                </div>
              </li>
            </ol>
            <div className="info-banner">
              <Icon name="wifi" />
              <p>
                Open Refridge while connected before using it offline. Reconnect
                to sync your saved changes with your account.
              </p>
            </div>
            <button className="btn primary wide" onClick={close}>
              Got it
              <Icon name="check" size={18} />
            </button>
          </>
        )}
        {model.type === "settings" && (
          <>
            <form onSubmit={submit}>
              <p className="modal-intro">
                Manage your kitchen and keep a backup of your records.
                Changes are saved to your signed-in account when connected.
              </p>
              <label>
                Kitchen name
                <input
                  name="household"
                  maxLength={45}
                  defaultValue={state.household}
                  required
                />
              </label>
              <h3>Your example daily goals</h3>
              <p className="form-hint">
                Set goals that suit you; defaults are placeholders.
              </p>
              <div className="form-grid">
                {[
                  ["kcal", "Energy (kcal)"],
                  ["protein", "Protein (g)"],
                  ["fiber", "Fibre (g)"],
                ].map(([k, l]) => (
                  <label key={k}>
                    {l}
                    <input
                      name={k}
                      type="number"
                      min="1"
                      max="20000"
                      required
                      defaultValue={state.goals[k]}
                    />
                  </label>
                ))}
              </div>
              <button className="btn primary wide" type="submit">
                Save settings
                <Icon name="check" size={18} />
              </button>
            </form>
            <div className="settings-import">
              <strong>Restore a backup</strong>
              <p>Import an exported Refridge JSON file. This replaces your personal food, grocery, profile, and history records. Your current login and live connections stay in place.</p>
              <label className="field"><span>Import JSON backup</span><input type="file" accept=".json,application/json" onChange={async (e) => {
                const file = e.target.files?.[0]; e.target.value = ""; if (!file) return;
                try {
                  if (file.size > 1500000) throw Error("Choose a backup smaller than 1.5 MB.");
                  const imported = importBackup(await file.text(), state);
                  if (!window.confirm(`Replace your personal records with ${file.name}? This includes ${imported.items.length} foods, ${imported.logs.length} diary entries, and ${imported.groceries.length} grocery items. Export your current data first if you want to keep a copy.`)) return;
                  setState(imported); notify("Backup imported into your account"); close();
                } catch (e) { setError(e.message); }
              }} /></label>
            </div>
            <div className="settings-export">
              <div>
                <strong>Keep a copy</strong>
                <p>Export your inventory, grocery list, and diary.</p>
              </div>
              <button
                className="btn outline"
                onClick={() =>
                  download(
                    new Blob([JSON.stringify(state, null, 2)], {
                      type: "application/json",
                    }),
                    "refridge-backup.json",
                  )
                }
              >
                <Icon name="download" size={17} />
                Export data
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
