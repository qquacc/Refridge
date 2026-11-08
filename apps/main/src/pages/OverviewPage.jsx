import React from "react";
import Icon from "../components/Icon.jsx";
import { Panel } from "../components/FeatureUI.jsx";
import { rankedRecipes, allInventory, memberName } from "../lib/domain.mjs";
import { daysLeft, today } from "../data/food.mjs";
import { foodFits } from "../../../../packages/shared/dietary.mjs";
import { groupFridgeFoods } from "../lib/fridge-layout.mjs";
import { wellbeingSeries, metricAverage } from "../lib/wellbeing.mjs";
export default function OverviewPage({ state, setState, remaining, navigate, setModal }) {
  const fridges = state.fridges.filter((f) => !f.remote), fridge = fridges.find((f) => f.id === state.activeFridgeId) || fridges[0];
  const foods = allInventory(state).filter((i) => i.fridgeId === fridge?.id && i.grams > 0), groups = groupFridgeFoods(foods);
  const soon = foods.filter((i) => i.expires && daysLeft(i.expires) <= 2);
  const week = wellbeingSeries(state, today(), 7), energy = metricAverage(week, "energy");
  const hasCheckIn = state.wellbeing?.checkIns?.some((e) => e.date === today());
  function add() { if (fridge) setState((s) => ({ ...s, activeFridgeId: fridge.id })); setModal({ type: "add" }); }
  return <div className="feature-page fridge-home">
    <div className="fridge-home-heading"><div><p className="eyebrow">A LITTLE ORDER. A LOT OF POSSIBILITY.</p><h2>Good things inside.</h2><p>Your food, grouped into shelves and drawers. A simple organizer, not a map of where your cameras see each item.</p></div><button className="btn primary" onClick={add}><Icon name="plus" /> Add food</button></div>
    {!state.profile.complete && <div className="profile-prompt"><div><strong>Make this kitchen yours</strong><p>Pick up your short setup whenever you’re ready.</p></div><button className="btn outline" onClick={() => setState((s) => ({ ...s, onboarding: { completed: false, step: 0 } }))}>Start setup</button></div>}
    <div className="fridge-home-grid">
      <section className="visual-fridge" aria-label="Your fridge grouped by food category">
        <div className="fridge-control"><div><span className="fridge-light" aria-hidden="true" /><strong>{fridge?.name || "My fridge"}</strong><small>{foods.length} food{foods.length === 1 ? "" : "s"} inside</small></div><label><span className="sr-only">Choose fridge</span><select value={fridge?.id || ""} onChange={(e) => setState((s) => ({ ...s, activeFridgeId: e.target.value }))}>{fridges.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label></div>
        <div className="fridge-interior">{groups.map((group) => <section key={group.id} className={`fridge-shelf shelf-${group.id}`} aria-labelledby={`shelf-${group.id}`}><div className="shelf-heading"><h3 id={`shelf-${group.id}`}><span aria-hidden="true">{group.emoji}</span> {group.title}</h3><span>{group.detail} · {group.foods.length}</span></div><div className="shelf-foods">{group.foods.length ? group.foods.map((item) => {
          const left = item.expires ? daysLeft(item.expires) : null, restricted = !foodFits(item, state.profile).safe;
          return <button key={item.id} className={`fridge-food ${restricted ? "fridge-food-restricted" : ""}`} onClick={() => setModal({ type: "edit", food: item })}><span className="fridge-food-emoji" aria-hidden="true">{item.emoji || "🍽️"}</span><strong>{item.name}</strong><span>{Math.round(item.grams)} g{item.estimated ? " · estimated" : ""}</span><small>{memberName(state, item.ownerId)}</small><span className={left !== null && left <= 2 ? "fridge-expiry urgent" : "fridge-expiry"}>{left === null ? "Date unknown" : left < 0 ? "Past saved date" : left === 0 ? "Use today" : `${left} days left`}</span>{restricted && <small className="restriction-label">Check dietary restrictions</small>}</button>;
        }) : <p className="shelf-empty">A little room for {group.title.toLowerCase()}.</p>}</div></section>)}</div>
        <div className="fridge-base"><span aria-hidden="true">•••</span> {foods.length ? "Tap a food to view or update it." : "Your fridge is ready. Add your first food to fill a shelf."}</div>
      </section>
      <aside className="fridge-home-side">
        <Panel title="Use these first" subtitle="Based on the dates you’ve saved.">{soon.length ? soon.slice(0, 5).map((i) => <button key={i.id} className="summary-food" onClick={() => setModal({ type: "edit", food: i })}><span>{i.emoji}</span><strong>{i.name}</strong><small>{Math.round(i.grams)} g · {i.expires}</small></button>) : <p className="body-copy">No saved dates in the next two days. Foods with unknown dates still need checking.</p>}</Panel>
        <Panel title="How are you feeling?" subtitle="A small check-in, a longer view."><div className="wellbeing-home-number"><strong>{energy.value === null ? "—" : (Math.round(energy.value * 10) / 10)}<small> / 5</small></strong><span>{energy.count ? `Average energy · ${energy.count} check-in${energy.count === 1 ? "" : "s"} this week` : "Start tracking mood, energy, stress, and sleep."}</span></div><button className="btn outline" onClick={() => navigate("wellbeing")}>{hasCheckIn ? "Explore my trends" : "Check in today"} <Icon name="arrow" /></button></Panel>
        <Panel title="Make something good"><p className="body-copy">Meal ideas filtered using your saved dietary preferences.</p><div className="fridge-meal-list">{rankedRecipes(state).slice(0, 2).map((r) => <button key={r.id} onClick={() => setModal({ type: "recipe", recipe: r })}><span>{r.emoji}</span><strong>{r.name}</strong><small>{r.time} min</small></button>)}</div><button className="text-btn" onClick={() => navigate("meals")}>All meal ideas ↗</button></Panel>
        <button className="fridge-shop-link" onClick={() => navigate("list")}><Icon name="list" /><span>{remaining} items on your next shop</span><Icon name="arrow" /></button>
      </aside>
    </div>
  </div>;
}
