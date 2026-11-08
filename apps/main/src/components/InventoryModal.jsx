import React, { useState } from "react";
import Icon from "./Icon.jsx";
import { Field } from "./FeatureUI.jsx";
import { catalog, uid, daysFromNow } from "../data/food.mjs";
import { putFood, allInventory } from "../lib/domain.mjs";
export default function InventoryModal({
  model,
  state,
  setState,
  notify,
  close,
}) {
  const editing = model.type === "edit";
  const old = model.food;
  const initial =
    old && catalog.some((c) => c.name === old.name)
      ? old.name
      : old
        ? "custom"
        : catalog[0].name;
  const [choice, setChoice] = useState(initial);
  const [fridgeId, setFridgeId] = useState(
    old?.fridgeId || state.activeFridgeId,
  );
  const [error, setError] = useState("");
  const ref = React.useRef(null);
  React.useEffect(() => {
    const before = document.activeElement;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    function key(e) {
      if (e.key === "Escape") close();
      if (e.key === "Tab") {
        const a = ref.current.querySelectorAll("button,input,select");
        if (e.shiftKey && document.activeElement === a[0]) {
          e.preventDefault();
          a[a.length - 1].focus();
        } else if (!e.shiftKey && document.activeElement === a[a.length - 1]) {
          e.preventDefault();
          a[0].focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", key);
      before?.focus();
    };
  }, []);
  const fridge = state.fridges.find((f) => f.id === fridgeId);
  function submit(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      const base = catalog.find((c) => c.name === choice);
      const item = {
        ...(old || {}),
        ...(base || { emoji: "🍽️", color: "#e7eadf", category: "Other" }),
        id: old?.id || uid(),
        name: choice === "custom" ? String(f.get("name")).trim() : choice,
        grams: Number(f.get("grams")),
        expires: String(f.get("expires")),
        ownerId: String(f.get("ownerId")),
        fridgeId,
        containerId: old?.containerId || "",
        nutritionSource: base?.nutritionSource || {
          publisher: "Manual label",
          dataset: "Custom food",
        },
        customNutrition: choice === "custom",
        ...(choice === "custom"
          ? {
              cnfId: null,
              nutrientsPer100g: {},
              densityReference: null,
              description: "Custom food; verify label and allergens.",
            }
          : {}),
      };
      if (!item.name) throw Error("Enter a food name.");
      if (choice === "custom")
        for (const k of ["kcal", "protein", "carbs", "fat", "fiber"])
          item[k] = f.get(k) === "" ? null : Number(f.get(k));
      if (!Number.isFinite(item.grams) || item.grams <= 0)
        throw Error("Enter a positive quantity.");
      if (editing) {
        const without = {
          ...state,
          items: state.items.filter((i) => i.id !== old.id),
          friendItems: state.friendItems.filter((i) => i.id !== old.id),
        };
        const n = putFood(without, item);
        const key = fridgeId === "my-fridge" ? "items" : "friendItems";
        setState({
          ...n,
          [key]: n[key].map((i, idx) =>
            idx === n[key].length - 1 ? { ...i, id: old.id } : i,
          ),
        });
      } else setState(putFood(state, item));
      notify(editing ? "Food details updated" : "Food added to fridge");
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
        aria-labelledby="inventory-title"
        tabIndex={-1}
        ref={ref}
      >
        <div className="modal-header">
          <span className="eyebrow">YOUR FOOD · YOUR KITCHEN</span>
          <button
            className="icon-btn"
            aria-label="Close dialog"
            onClick={close}
          >
            <Icon name="close" />
          </button>
        </div>
        <h2 id="inventory-title">
          {editing
            ? "Make room for the details"
            : "Something fresh for your fridge"}
        </h2>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <form className="feature-form" onSubmit={submit}>
          <Field label="Food">
            <select value={choice} onChange={(e) => setChoice(e.target.value)}>
              {catalog.map((c) => (
                <option key={c.name}>{c.name}</option>
              ))}
              <option value="custom">Something else…</option>
            </select>
          </Field>
          {choice === "custom" && (
            <>
              <Field
                label="Food name"
                name="name"
                required
                maxLength={80}
                defaultValue={old?.name}
              />
              <p className="form-hint">
                Optional values per 100 g from a food label. Blank values count
                as unknown.
              </p>
              <div className="form-grid">
                {["kcal", "protein", "carbs", "fat", "fiber"].map((k) => (
                  <Field
                    key={k}
                    label={k === "kcal" ? "Energy (kcal)" : k + " (g)"}
                    name={k}
                    type="number"
                    min="0"
                    step="0.1"
                    defaultValue={old?.[k] ?? ""}
                  />
                ))}
              </div>
            </>
          )}
          <div className="form-grid">
            <Field
              label="Food weight (g)"
              name="grams"
              type="number"
              min="0.1"
              max="100000"
              step="0.1"
              required
              defaultValue={old?.grams || 250}
            />
            <Field
              label="Expiry date"
              name="expires"
              type="date"
              required
              defaultValue={old?.expires || daysFromNow(5)}
            />
            <Field label="Storage space">
              <select
                value={fridgeId}
                onChange={(e) => setFridgeId(e.target.value)}
              >
                {state.fridges.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Food owner">
              <select
                key={fridgeId}
                name="ownerId"
                defaultValue={
                  fridge.members.includes(old?.ownerId)
                    ? old.ownerId
                    : fridge.ownerId
                }
              >
                {fridge.members.map((id) => (
                  <option key={id} value={id}>
                    {id === "me"
                      ? state.profile.name
                      : state.members.find((m) => m.id === id)?.name}
                  </option>
                ))}
                <option value="shared">Household shared</option>
              </select>
            </Field>
          </div>
          <p className="form-hint">
            Check who the food belongs to and when you plan to use it.
            You can adjust the amount whenever it changes.
          </p>
          <button className="btn primary wide" type="submit">
            {editing ? "Save food details" : "Add to my fridge"}
          </button>
        </form>
      </section>
    </div>
  );
}
