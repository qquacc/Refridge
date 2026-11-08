import React, { useState } from "react";
import { Panel, Field } from "../components/FeatureUI.jsx";
import { catalog, uid } from "../data/food.mjs";
import { completeGrocery } from "../lib/planning.mjs";
export default function GroceryPage({ state, setState, notify }) {
  const [tab, setTab] = useState("pending");
  const [editing, setEditing] = useState(false);
  const rows = tab === "pending" ? state.groceries : state.completedGroceries;
  return (
    <div className="feature-page">
      <Panel
        title="Your shopping list"
        subtitle="Usual foods replenish automatically when stock falls below its minimum."
        action={
          <label className="compact-select">
            Show
            <select
              aria-label="Grocery list view"
              value={tab}
              onChange={(e) => setTab(e.target.value)}
            >
              <option value="pending">To buy</option>
              <option value="completed">Completed</option>
            </select>
          </label>
        }
      >
        <form
          className="add-grocery"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget,
              f = new FormData(form),
              name = String(f.get("name")).trim();
            if (
              name &&
              !state.groceries.some(
                (g) => g.name.toLowerCase() === name.toLowerCase(),
              )
            )
              setState((s) => ({
                ...s,
                groceries: [
                  ...s.groceries,
                  {
                    id: uid(),
                    name,
                    grams: Number(f.get("grams")) || null,
                    checked: false,
                  },
                ],
              }));
            form.reset();
          }}
        >
          <input
            name="name"
            placeholder="Add an extra item"
            required
            aria-label="Grocery name"
          />
          <input
            name="grams"
            type="number"
            min="1"
            placeholder="g"
            aria-label="Grocery amount in grams"
            className="quantity-input"
          />
          <button className="btn primary" type="submit">
            Add
          </button>
        </form>
        {!rows.length && (
          <div className="empty">
            {tab === "pending"
              ? "Nothing to buy right now."
              : "No completed items."}
          </div>
        )}
        {rows.map((g) => (
          <div className="grocery-row" key={g.id}>
            <label>
              {tab === "pending" && (
                <input
                  type="checkbox"
                  checked={false}
                  onChange={() => {
                    setState((s) => completeGrocery(s, g.id));
                    notify("Moved to completed");
                  }}
                />
              )}
              <span>
                <strong>{g.name}</strong>
                {g.grams && <small> · {g.grams} g</small>}
                {g.auto && (
                  <small className="row-note">Auto · {g.reason}</small>
                )}
                {g.completedAt && (
                  <small className="row-note">
                    Completed {new Date(g.completedAt).toLocaleString()}
                  </small>
                )}
              </span>
            </label>
            {tab === "pending" ? (
              <button
                className="text-btn"
                onClick={() =>
                  setState((s) => ({
                    ...s,
                    groceries: s.groceries.filter((x) => x.id !== g.id),
                    staples: g.auto
                      ? s.staples.map((t) =>
                          t.id === g.stapleId ? { ...t, enabled: false } : t,
                        )
                      : s.staples,
                  }))
                }
              >
                Remove
              </button>
            ) : (
              <button
                className="text-btn"
                onClick={() =>
                  setState((s) => ({
                    ...s,
                    completedGroceries: s.completedGroceries.filter(
                      (x) => x.id !== g.id,
                    ),
                    groceries: [
                      ...s.groceries,
                      { ...g, id: uid(), checked: false },
                    ],
                  }))
                }
              >
                Restore
              </button>
            )}
          </div>
        ))}
        {tab === "completed" && rows.length > 0 && (
          <button
            className="btn outline"
            onClick={() => {
              setState((s) => ({ ...s, completedGroceries: [] }));
              notify("Completed history cleared");
            }}
          >
            Clear all completed history
          </button>
        )}
      </Panel>
      <Panel
        title="Usual stock"
        subtitle="Foods and usual quantities are learned from observed stock levels. Manual adjustments stay in control."
        action={
          <button className="text-btn" onClick={() => setEditing(!editing)}>
            {editing ? "Hide settings" : "Manage usual foods"}
          </button>
        }
      >
        {editing && (
          <>
            <div className="staple-table">
              {state.staples.map((t) => (
                <div key={t.id}>
                  <label className="inline-toggle">
                    <input
                      type="checkbox"
                      checked={t.enabled}
                      onChange={(e) =>
                        setState((s) => ({
                          ...s,
                          staples: s.staples.map((x) =>
                            x.id === t.id
                              ? { ...x, enabled: e.target.checked }
                              : x,
                          ),
                        }))
                      }
                    />
                    {t.name}
                  </label>
                  <label>
                    Usual g
                    <input
                      type="number"
                      min="1"
                      value={t.usualGrams}
                      onChange={(e) =>
                        setState((s) => ({
                          ...s,
                          staples: s.staples.map((x) =>
                            x.id === t.id
                              ? {
                                  ...x,
                                  usualGrams: Number(e.target.value),
                                  manual: true,
                                }
                              : x,
                          ),
                        }))
                      }
                    />
                  </label>
                  <label>
                    Minimum g
                    <input
                      type="number"
                      min="0"
                      value={t.minimumGrams}
                      onChange={(e) =>
                        setState((s) => ({
                          ...s,
                          staples: s.staples.map((x) =>
                            x.id === t.id
                              ? {
                                  ...x,
                                  minimumGrams: Number(e.target.value),
                                  manual: true,
                                }
                              : x,
                          ),
                        }))
                      }
                    />
                  </label>
                </div>
              ))}
            </div>
            <form
              className="feature-form inline-form"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget),
                  name = String(f.get("food"));
                if (!state.staples.some((t) => t.name === name))
                  setState((s) => ({
                    ...s,
                    staples: [
                      ...s.staples,
                      {
                        id: uid(),
                        name,
                        usualGrams: Number(f.get("usual")),
                        minimumGrams: Number(f.get("minimum")),
                        enabled: true,
                      },
                    ],
                  }));
                notify("Usual-stock rule saved");
              }}
            >
              <Field label="Food">
                <select name="food">
                  {catalog.map((c) => (
                    <option key={c.cnfId}>{c.name}</option>
                  ))}
                </select>
              </Field>
              <Field
                label="Usual quantity (g)"
                name="usual"
                type="number"
                required
                min="1"
                defaultValue="250"
              />
              <Field
                label="Reorder below (g)"
                name="minimum"
                type="number"
                required
                min="0"
                defaultValue="50"
              />
              <button className="btn primary">Add rule</button>
            </form>
          </>
        )}
        <p className="form-hint">
          Completing an item keeps a timestamped memory and pauses its automatic
          re-addition for 12 hours, giving you time to restock. Clearing
          completed history removes that memory and lets any still-low staple
          reappear.
        </p>
      </Panel>
    </div>
  );
}
