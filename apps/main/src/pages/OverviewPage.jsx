import React, { useEffect, useState } from "react";
import Icon from "../components/Icon.jsx";
import { allInventory, memberName } from "../lib/domain.mjs";
import { daysLeft } from "../data/food.mjs";
import { foodFits } from "../../../../packages/shared/dietary.mjs";
import { groupFridgeFoods } from "../lib/fridge-layout.mjs";
function Shelf({ group, state, setModal, compact }) {
  const [page, setPage] = useState(0);
  const drawer = ["vegetables", "meat"].includes(group.id);
  const size = drawer ? compact ? 1 : 2 : compact ? 2 : 4;
  const pages = Math.max(1, Math.ceil(group.foods.length / size)), current = Math.min(page, pages - 1);
  const visible = group.foods.slice(current * size, (current + 1) * size);
  return <section className={`fridge-shelf shelf-${group.id}`} aria-labelledby={`shelf-${group.id}`}>
    <div className="shelf-heading"><h3 id={`shelf-${group.id}`}><span aria-hidden="true">{group.emoji}</span><span>{group.title}<small>{group.foods.length} {group.foods.length === 1 ? "item" : "items"}</small></span></h3>
      {pages > 1 && <div className="shelf-pager" aria-label={`${group.title} pages`}><button type="button" disabled={current === 0} aria-label={`Previous ${group.title} items`} onClick={() => setPage(current - 1)}>‹</button><span>{current + 1}/{pages}</span><button type="button" disabled={current === pages - 1} aria-label={`Next ${group.title} items`} onClick={() => setPage(current + 1)}>›</button></div>}
    </div>
    <div className="shelf-foods" style={{ "--shelf-columns": size }}>{visible.length ? visible.map((item) => {
      const left = item.expires ? daysLeft(item.expires) : null, restricted = !foodFits(item, state.profile).safe;
      const date = left === null ? "Date unknown" : left < 0 ? "Past saved date" : left === 0 ? "Use today" : `${left} days left`;
      const label = `${item.name}, ${Math.round(item.grams)} g${item.estimated ? ", estimated" : ""}, ${memberName(state, item.ownerId)}, ${date}${restricted ? ", check dietary restrictions" : ""}`;
      return <button key={item.id} className={`fridge-food ${restricted ? "fridge-food-restricted" : ""}`} title={label} aria-label={label} onClick={() => setModal({ type: "edit", food: item })}>
        <span className="fridge-food-emoji" aria-hidden="true">{item.emoji || "🍽️"}</span><span className="fridge-food-copy"><strong>{item.name}</strong><small>{Math.round(item.grams)} g{left !== null && left <= 2 && <span className="fridge-soon"> · {left < 0 ? "Check date" : "Use soon"}</span>}{restricted && " · !"}</small></span>
      </button>;
    }) : <p className="shelf-empty">Room for something good</p>}</div>
  </section>;
}
export default function OverviewPage({ state, setState, remaining, navigate, setModal }) {
  const [compact, setCompact] = useState(() => window.matchMedia("(max-width: 600px)").matches);
  useEffect(() => { const query = window.matchMedia("(max-width: 600px)"); const update = () => setCompact(query.matches); query.addEventListener("change", update); return () => query.removeEventListener("change", update); }, []);
  const fridges = state.fridges.filter((f) => !f.remote), fridge = fridges.find((f) => f.id === state.activeFridgeId) || fridges[0];
  const foods = allInventory(state).filter((i) => i.fridgeId === fridge?.id && i.grams > 0), groups = groupFridgeFoods(foods);
  function add() { if (fridge) setState((s) => ({ ...s, activeFridgeId: fridge.id })); setModal({ type: "add" }); }
  return <div className="feature-page fridge-home">
    <div className="fridge-home-heading"><div><h1>Your fridge.</h1><p>{foods.length} foods. A little more together.</p></div><button className="btn primary" onClick={add}><Icon name="plus" size={16} /> Add food</button></div>
    <section className="visual-fridge" aria-label="Your fridge grouped by food category">
      <div className="fridge-control"><div><span className="fridge-light" aria-hidden="true" /><strong>{fridge?.name || "My fridge"}</strong><small>BY CATEGORY</small></div><label><span className="sr-only">Choose fridge</span><select value={fridge?.id || ""} onChange={(e) => setState((s) => ({ ...s, activeFridgeId: e.target.value }))}>{fridges.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label></div>
      <div className="fridge-interior">{groups.map((group) => <Shelf key={`${fridge?.id}-${group.id}`} group={group} state={state} setModal={setModal} compact={compact} />)}</div>
      <div className="fridge-base"><span className="fridge-vents" aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <i key={i} />)}</span><span>{foods.length ? "Tap a food to open its details" : "Add your first food to fill a shelf"}</span><button type="button" onClick={() => navigate("fridge")}>All inventory ↗</button></div>
    </section>
    <nav className="fridge-quick-links" aria-label="Kitchen shortcuts"><button onClick={() => navigate("wellbeing")}><Icon name="wellbeing" size={16} /><span>Well-being</span></button><button onClick={() => navigate("meals")}><Icon name="meals" size={16} /><span>Meal ideas</span></button><button onClick={() => navigate("list")}><Icon name="list" size={16} /><span>Groceries · {remaining}</span></button>{!state.profile.complete && <button onClick={() => setState((s) => ({ ...s, onboarding: { completed: false, step: 0 } }))}><Icon name="profile" size={16} /><span>Finish setup</span></button>}</nav>
  </div>;
}
