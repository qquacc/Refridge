import { recipeCosts, cad } from "../lib/costs.mjs";
import React, { useState } from "react";
import { Panel, Field } from "../components/FeatureUI.jsx";
import { allowedRecipes, activeInventory } from "../lib/planning.mjs";
import { recipeMissing } from "../lib/domain.mjs";
import { recipeNutrition, today, uid } from "../data/food.mjs";
export default function MealsPage({
  state,
  setState,
  setModal,
  addGroceries,
  notify,
  community = false,
}) {
  const [visible, setVisible] = useState(6);
  const [mode, setMode] = useState(community ? "Cook together" : "For me"),
    [ids, setIds] = useState([state.activeFridgeId]),
    [cuisine, setCuisine] = useState("All"),
    [servings, setServings] = useState(2);
  const personalId = state.fridges.find((f) => f.id === state.activeFridgeId && f.ownerId === "me")?.id || state.fridges.find((f) => f.ownerId === "me")?.id;
  const selected = mode === "For me" ? [personalId] : ids;
  const all = allowedRecipes(state, selected);
  const recipes = all.filter((r) => cuisine === "All" || r.cuisine === cuisine);
  const pool = activeInventory(state, selected).filter(
    (i) => mode !== "For me" || ["me", "shared"].includes(i.ownerId),
  );
  function plan(r) {
    const scaled = {
      ...r,
      ingredients: r.ingredients.map(([n, g]) => [n, g * servings]),
    };
    const missing = recipeMissing(scaled, pool);
    setState((s) => ({
      ...s,
      dinners: [
        {
          id: uid(),
          recipeId: r.id,
          name: r.name,
          fridgeIds: selected,
          servings,
          createdDate: today(),
          missing,
          status: "planned",
        },
        ...s.dinners,
      ],
    }));
    notify("Shared meal plan saved");
  }
  return (
    <div className="feature-page">
      {mode === "Cook together" && (
        <Panel
          title="Cook together"
          subtitle="Pool selected fridges for a shared meal. Plans reserve no food; ask each owner before using it."
        >
          <p className="form-hint">
            Choose the kitchens you’d like to cook with, then agree on what
            each person will bring before you start.
          </p>
          <div className="fridge-choices">
            {state.fridges
              .filter((f) => f.shared)
              .map((f) => (
                <label key={f.id} className="inline-toggle">
                  <input
                    type="checkbox"
                    checked={ids.includes(f.id)}
                    onChange={(e) =>
                      setIds(
                        e.target.checked
                          ? [...ids, f.id]
                          : ids.filter((x) => x !== f.id),
                      )
                    }
                  />
                  {f.name}
                </label>
              ))}
          </div>
          <Field
            label="People / servings"
            type="number"
            min="1"
            max="20"
            value={servings}
            onChange={(e) =>
              setServings(
                Math.max(1, Math.min(20, Number(e.target.value) || 1)),
              )
            }
          />
        </Panel>
      )}
      <div className="meal-toolbar">
        <Field label="Cuisine">
          <select value={cuisine} onChange={(e) => setCuisine(e.target.value)}>
            <option>All</option>
            {[...new Set(all.map((r) => r.cuisine))].sort().map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <p className="body-copy">
          Ranked by available ingredients, food dates, taste preferences, and
          recent meals. Allergy and diet restrictions are applied first.
        </p>
      </div>
      <div className="planned-recipe-grid">
        {recipes.slice(0, visible).map((r) => {
          const portions = mode === "For me" ? 1 : servings;
          const missing = recipeMissing(
            {
              ...r,
              ingredients: r.ingredients.map(([n, g]) => [n, g * portions]),
            },
            pool,
          );
          const addedToGrocery = missing.length > 0 && missing.every(([name]) => state.groceries.some((item) => !item.checked && item.name.toLowerCase() === name.toLowerCase()));
          const cost = recipeCosts(state, r, pool, portions);
          const mealBudget = Number(state.profile.budgetCad) / (7 * Number(state.profile.mealsPerDay || 3));
          const n = recipeNutrition(r);
          return (
            <article className="planned-recipe" key={r.id}>
              <button
                className="recipe-preview"
                onClick={() => setModal({ type: "recipe", recipe: r })}
              >
                <span className="meal-art" style={{ background: r.color }}>
                  {r.emoji}
                </span>
                <span className="eyebrow">
                  {r.cuisine} · {r.time} MIN
                </span>
                <h2>{r.name}</h2>
                <span>
                  {Math.round(n.kcal || 0)} kcal · {Math.round(n.protein || 0)}{" "}
                  g protein / serving
                </span>
              </button>
              <div className="recipe-stock">
                {missing.length
                  ? `${r.ingredients.length - missing.length}/${r.ingredients.length} ingredients ready`
                  : "All ingredients ready"}{" "}
                · {portions} serving{portions > 1 ? "s" : ""}
              </div>
              <div className="recipe-price"><strong>{cost.complete ? `${cad(cost.perServing)} / serving` : "Recipe cost needs more prices"}</strong><small>{cost.purchaseComplete ? `${cad(cost.checkout)} to buy missing packages` : `${cad(cost.checkout)} known shopping cost · ${cost.missingPurchasePrices} missing price(s)`}</small>{cost.complete && mealBudget > 0 && <small>{cost.perServing <= mealBudget ? "Within" : "Above"} your {cad(mealBudget)} per-meal budget</small>}</div>
              <details>
                <summary>Ingredients & method</summary>
                <ul>
                  {r.ingredients.map(([name, g]) => (
                    <li key={name}>
                      {name} · {g * portions} g
                    </li>
                  ))}
                </ul>
                <ol className="recipe-steps">
                  {r.steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
                <p className="form-hint">
                  Use these recipes as a starting point and adjust them to your taste.
                  Nutrition is approximate and doesn’t include extra toppings.
                </p>
                <a href={r.sourceUrl} target="_blank" rel="noreferrer">
                  Read the original recipe ↗
                </a>
              </details>
              <div className="recipe-actions">
                {mode === "Cook together" ? (
                  <button
                    className="btn primary"
                    disabled={!selected.length}
                    onClick={() => plan(r)}
                  >
                    Save shared plan
                  </button>
                ) : (
                  <button
                    className="btn primary"
                    onClick={() => setModal({ type: "recipe", recipe: r })}
                  >
                    Open recipe
                  </button>
                )}
                {missing.length > 0 && (
                  <button
                    className="text-btn"
                    disabled={addedToGrocery}
                    aria-live="polite"
                    onClick={() =>
                      addGroceries(
                        missing.map(([name, grams]) => ({ name, grams })),
                      )
                    }
                  >
                    {addedToGrocery ? "Added to Grocery" : "Shop missing foods"}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {recipes.length > visible && (
        <button className="btn outline" onClick={() => setVisible(visible + 6)}>
          Show more meal ideas ({recipes.length - visible} more)
        </button>
      )}
      {!recipes.length && (
        <div className="empty">
          No recipe fits these restrictions and cuisine. Choose another cuisine
          or review your profile.
        </div>
      )}
      {community && <Panel
        title="Saved shared meal plans"
        subtitle="Agreement happens with the food owners before cooking."
      >
        {state.dinners.length ? (
          state.dinners.map((d) => (
            <div className="trade-line" key={d.id}>
              <div>
                <strong>{d.name || d.recipeName || "Shared dinner"}</strong>
                <small>
                  {d.servings || 1} servings ·{" "}
                  {d.fridgeIds
                    .map((id) => state.fridges.find((f) => f.id === id)?.name)
                    .join(" + ")}{" "}
                  · {d.createdDate || d.date}
                </small>
              </div>
              <button
                className="text-btn"
                onClick={() =>
                  setState((s) => ({
                    ...s,
                    dinners: s.dinners.filter((x) => x.id !== d.id),
                  }))
                }
              >
                Remove
              </button>
            </div>
          ))
        ) : (
          <p className="body-copy">
            Choose Cook together and save a recipe for two or more fridges.
          </p>
        )}
      </Panel>}
    </div>
  );
}
