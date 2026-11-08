import WeightCheckIn from "../components/WeightCheckIn.jsx";
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Icon from "../components/Icon.jsx";
import { allInventory, memberName } from "../lib/domain.mjs";
import { foodFits } from "../../../../packages/shared/dietary.mjs";
import { zoneFridgeFoods, foodEmoji } from "../lib/fridge-layout.mjs";
import { foodHighlights, itemMacros, freshness, formatAmount } from "../lib/food-peek.mjs";
import "../styles/fridge-view.css";

const dateLabel = (date) => new Date(date + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
const sizeFor = (grams) => Math.max(0.82, Math.min(1.18, 0.7 + Math.log10(Math.max(10, Number(grams) || 10)) * 0.17));

function FoodItem({ food, selected, onOpen, index = 0 }) {
  const fresh = freshness(food.expires);
  const label = `${food.name}, ${Math.round(food.grams)} g, ${fresh.label}. Open details`;
  return <button type="button" className={`rf-item tone-${fresh.tone}${selected ? " is-selected" : ""}`} style={{ "--s": sizeFor(food.grams), "--i": Math.min(index, 8) }}
    aria-label={label} aria-haspopup="dialog" aria-expanded={selected} onClick={(e) => onOpen(food, e.currentTarget)}>
    <span className="rf-emoji" aria-hidden="true">{foodEmoji(food)}</span>
    <span className="rf-name">{food.name}</span>
    <span className="rf-dot" aria-hidden="true" />
  </button>;
}

// One physical area of the fridge: a glass shelf, a drawer, or a door bin.
function Zone({ zone, selectedId, onOpen, className = "" }) {
  const row = useRef(null), [overflow, setOverflow] = useState({ left: false, right: false });
  const measure = useCallback(() => {
    const el = row.current; if (!el) return;
    setOverflow({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);
  useLayoutEffect(() => { measure(); const el = row.current; if (!el) return; const ro = new ResizeObserver(measure); ro.observe(el); return () => ro.disconnect(); }, [measure, zone.foods.length]);
  const scroll = (dir) => row.current?.scrollBy({ left: dir * row.current.clientWidth * 0.8, behavior: "smooth" });
  const soon = zone.foods.filter((f) => ["urgent", "past"].includes(freshness(f.expires).tone)).length;
  return <section className={`rf-zone place-${zone.place} ${className}`} aria-label={`${zone.title}, ${zone.foods.length} ${zone.foods.length === 1 ? "item" : "items"}`}>
    <header className="rf-zone-tag"><span aria-hidden="true">{zone.emoji}</span>{zone.title}<b>{zone.foods.length}</b>{soon > 0 && <i title={`${soon} to use soon`}>{soon} soon</i>}</header>
    <div className={`rf-row${overflow.left ? " fade-left" : ""}${overflow.right ? " fade-right" : ""}`} ref={row} onScroll={measure}>
      {zone.foods.length ? zone.foods.map((food, i) => <FoodItem key={food.id} index={i} food={food} selected={selectedId === food.id} onOpen={onOpen} />)
        : <span className="rf-empty">Empty</span>}
    </div>
    {zone.place === "tray" && <><span className="rf-tray-front" aria-hidden="true" /><span className="rf-tray-side" aria-hidden="true" /></>}
    {zone.place === "drawer" && <span className="rf-drawer-front" aria-hidden="true"><i /></span>}
    {overflow.left && <button type="button" className="rf-scroll left" aria-label={`Scroll ${zone.title} left`} onClick={() => scroll(-1)}>‹</button>}
    {overflow.right && <button type="button" className="rf-scroll right" aria-label={`Scroll ${zone.title} right`} onClick={() => scroll(1)}>›</button>}
  </section>;
}

// Compact details card anchored to the food that was clicked.
function FoodPeek({ peek, state, onClose, onEdit, navigate }) {
  const card = useRef(null), [pos, setPos] = useState(null);
  const { food, anchor } = peek;
  useLayoutEffect(() => {
    const place = () => {
      if (!card.current || !anchor?.isConnected) return;
      if (window.matchMedia("(max-width: 640px)").matches) { setPos(null); return; }
      const r = anchor.getBoundingClientRect(), w = card.current.offsetWidth, h = card.current.offsetHeight, gap = 10;
      let left = r.left + r.width / 2 - w / 2; left = Math.max(12, Math.min(left, window.innerWidth - w - 12));
      let top = r.top - h - gap, below = false;
      if (top < 12) { top = r.bottom + gap; below = true; }
      if (top + h > window.innerHeight - 12) top = Math.max(12, window.innerHeight - h - 12);
      setPos({ left, top, below, arrow: Math.max(18, Math.min(w - 18, r.left + r.width / 2 - left)) });
    };
    place(); window.addEventListener("resize", place); return () => window.removeEventListener("resize", place);
  }, [anchor, food.id]);
  useEffect(() => {
    card.current?.focus({ preventScroll: true });
    const key = (e) => { if (e.key === "Escape") onClose(true); };
    const outside = (e) => { if (!card.current?.contains(e.target) && !anchor?.contains(e.target)) onClose(false); };
    document.addEventListener("keydown", key); document.addEventListener("pointerdown", outside);
    return () => { document.removeEventListener("keydown", key); document.removeEventListener("pointerdown", outside); };
  }, [food.id, anchor, onClose]);
  const fresh = freshness(food.expires), { top, others, personal } = foodHighlights(food, state.profile, state.goals);
  const macros = itemMacros(food), restricted = !foodFits(food, state.profile).safe;
  const owner = memberName(state, food.ownerId);
  return <>
    <div className="rf-peek-scrim" aria-hidden="true" />
    <div ref={card} className={`rf-peek${pos?.below ? " below" : ""}`} role="dialog" aria-modal="false" aria-labelledby="rf-peek-title" tabIndex={-1}
      style={pos ? { left: pos.left, top: pos.top, "--arrow": `${pos.arrow}px` } : undefined}>
      <div className="rf-peek-head">
        <span className="rf-peek-emoji" aria-hidden="true">{foodEmoji(food)}</span>
        <div><h3 id="rf-peek-title">{food.name}</h3><p>{Math.round(food.grams)} g{food.estimated ? " (estimated)" : ""}{owner ? ` · ${owner}` : ""}</p></div>
        <button type="button" className="rf-peek-close" aria-label="Close details" onClick={() => onClose(true)}><Icon name="close" size={14} /></button>
      </div>
      <div className={`rf-peek-expiry tone-${fresh.tone}`}>
        <div><span className="rf-peek-label">Expires</span><strong>{food.expires ? dateLabel(food.expires) : "Not saved"}</strong></div>
        <span className="rf-chip">{fresh.label}</span>
        {fresh.ratio !== null && <span className="rf-meter" aria-hidden="true"><i style={{ width: `${Math.max(4, fresh.ratio * 100)}%` }} /></span>}
      </div>
      <div className="rf-peek-nutrient">
        <span className="rf-peek-label">Main nutrient</span>
        {top ? <>
          <div className="rf-peek-main"><strong>{top.name}</strong><span>{Math.round(top.percent100g)}%<small> daily need / 100 g</small></span></div>
          <span className="rf-meter green" aria-hidden="true"><i style={{ width: `${Math.min(100, Math.max(4, top.percent100g))}%` }} /></span>
          <p>{formatAmount(top.per100g, top.unit)} per 100 g · about {formatAmount(top.inItem, top.unit)} in this {Math.round(food.grams)} g</p>
          {others.length > 0 && <div className="rf-peek-also"><span>Also good for</span>{others.map((n) => <span key={n.id} className="rf-tag" title={`${formatAmount(n.per100g, n.unit)} per 100 g, ${Math.round(n.percent100g)}% of daily need`}>{n.name}</span>)}</div>}
        </> : <p>Nutrition isn’t recorded for this food yet. Match it to a database food in its details.</p>}
      </div>
      <dl className="rf-peek-macros" aria-label={`Nutrition for ${Math.round(food.grams)} grams`}>
        {[["kcal", "Energy", ""], ["protein", "Protein", " g"], ["carbs", "Carbs", " g"], ["fat", "Fat", " g"]].map(([k, l, u]) => <div key={k}><dt>{l}</dt><dd>{Number.isFinite(macros[k]) ? `${Math.round(macros[k])}${u}` : "—"}</dd></div>)}
      </dl>
      {restricted && <p className="rf-peek-warn">Check this against your dietary restrictions.</p>}
      <div className="rf-peek-actions">
        <button type="button" className="btn primary" onClick={onEdit}>Edit or use</button>
        <button type="button" className="btn outline" onClick={() => navigate("meals")}>Meal ideas</button>
      </div>
      {!personal && top && <p className="rf-peek-note">Compared with Canadian label Daily Values. Add your age and gender in your profile for personal targets.</p>}
    </div>
  </>;
}

export default function OverviewPage({ state, setState, remaining, navigate, setModal }) {
  const fridges = state.fridges.filter((f) => !f.remote && f.ownerId === "me"), fridge = fridges.find((f) => f.id === state.activeFridgeId) || fridges[0];
  const foods = allInventory(state).filter((i) => i.fridgeId === fridge?.id && i.grams > 0), zones = zoneFridgeFoods(foods);
  const [peek, setPeek] = useState(null);
  const current = peek && foods.find((f) => f.id === peek.food.id);
  const close = useCallback((returnFocus) => setPeek((p) => { if (returnFocus) p?.anchor?.focus({ preventScroll: true }); return null; }), []);
  const open = (food, anchor) => setPeek((p) => p?.food.id === food.id ? null : { food, anchor });
  useEffect(() => { setPeek(null); }, [fridge?.id]);
  const useSoon = foods.filter((f) => ["urgent", "past"].includes(freshness(f.expires).tone)).length;
  function add() { if (fridge) setState((s) => ({ ...s, activeFridgeId: fridge.id })); setModal({ type: "add" }); }
  return <div className="feature-page fridge-home">
    <div className="fridge-home-heading"><div><h1>Your fridge.</h1><p>{foods.length} foods{useSoon ? ` · ${useSoon} to use soon` : ""}. Tap anything to see its date and nutrients.</p></div><button className="btn primary" onClick={add}><Icon name="plus" size={16} /> Add food</button></div>
    <WeightCheckIn state={state} setState={setState} />
    <section className="rf-fridge" aria-label={`${fridge?.name || "My fridge"} contents`}>
      <div className="rf-topbar">
        <div className="rf-brand"><span className="rf-led" aria-hidden="true" /><strong>{fridge?.name || "My fridge"}</strong></div>
        <div className="rf-legend" aria-hidden="true"><span className="tone-fresh">Fresh</span><span className="tone-soon">Soon</span><span className="tone-urgent">Use now</span></div>
        {fridges.length > 1 && <label><span className="sr-only">Choose fridge</span><select value={fridge?.id || ""} onChange={(e) => setState((s) => ({ ...s, activeFridgeId: e.target.value }))}>{fridges.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>}
      </div>
      {/* Keyed by fridge so the doors swing open on every visit and fridge switch. */}
      <div className="rf-stage" key={fridge?.id || "none"}>
        <div className="rf-unit">
          <div className="rf-cabinet">
            <div className="rf-compartment upper">
              <span className="rf-lamp" aria-hidden="true" />
              {["shelf-dairy", "shelf-meals", "shelf-staples"].map((id) => <Zone key={id} zone={zones[id]} selectedId={current?.id} onOpen={open} />)}
              <div className="rf-split"><Zone zone={zones["crisper-fruit"]} selectedId={current?.id} onOpen={open} /><Zone zone={zones["crisper-veg"]} selectedId={current?.id} onOpen={open} /></div>
            </div>
            <div className="rf-compartment lower">
              <Zone zone={zones["drawer-seafood"]} selectedId={current?.id} onOpen={open} />
              <Zone zone={zones["drawer-meat"]} selectedId={current?.id} onOpen={open} />
            </div>
            <div className="rf-front" aria-hidden="true"><div className="rf-leaf upper"><i /></div><div className="rf-leaf lower"><i /></div></div>
          </div>
          <div className="rf-door" aria-label="Fridge door">
            <div className="rf-door-leaf upper">
              {["door-spreads", "door-drinks", "door-sauces"].map((id) => <Zone key={id} zone={zones[id]} selectedId={current?.id} onOpen={open} />)}
            </div>
            <div className="rf-door-leaf lower" aria-hidden="true" />
          </div>
        </div>
      </div>
      <div className="rf-foot"><span>{foods.length ? "Hover for a name, click for details" : "Add your first food to stock the shelves"}</span><button type="button" onClick={() => navigate("fridge")}>All inventory ↗</button></div>
    </section>
    <nav className="fridge-quick-links" aria-label="Kitchen shortcuts"><button onClick={() => navigate("wellbeing")}><Icon name="wellbeing" size={16} /><span>Wellbeing</span></button><button onClick={() => navigate("meals")}><Icon name="meals" size={16} /><span>Meal ideas</span></button><button onClick={() => navigate("list")}><Icon name="list" size={16} /><span>Groceries · {remaining}</span></button>{!state.profile.complete && <button onClick={() => setState((s) => ({ ...s, onboarding: { completed: false, step: 0 } }))}><Icon name="profile" size={16} /><span>Finish setup</span></button>}</nav>
    {current && <FoodPeek peek={{ ...peek, food: current }} state={state} navigate={navigate} onClose={close} onEdit={() => { setPeek(null); setModal({ type: "edit", food: current }); }} />}
  </div>;
}
