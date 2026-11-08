import CityField from "./CityField.jsx";
import { regionalPriceSource } from "../lib/regional-costs.mjs";
import React, { useState } from 'react';
import { Panel, Field } from './FeatureUI.jsx';
import { catalog } from '../data/food.mjs';
import { foodPriceKey, groceryCosts, cad } from '../lib/costs.mjs';
export function ShoppingBudget({ state, profile = state.profile }) {
  const cost=groceryCosts(state),budget=Number(profile.budgetCad);
  return <div className="shopping-budget">
    <strong>{cost.complete ? 'Estimated total' : 'Known costs'}: {cad(cost.total)}</strong>
    {budget > 0 && <p>{cost.total > budget ? `${cad(cost.total - budget)} over your ${cad(budget)} weekly budget` : `${cad(budget - cost.total)} left in your ${cad(budget)} weekly budget`}</p>}
    {cost.unknown > 0 && <p>{cost.unknown} {cost.unknown === 1 ? 'item needs a price' : 'items need prices'}. Total is incomplete.</p>}
    <p className="regional-price-note">{state.profile.cityLocation ? `Regional estimates for ${state.profile.cityLocation.name}, ${state.profile.cityLocation.province}. Reference month: ${regionalPriceSource.period}.` : "Add your city below for available regional estimates."} Your saved prices take priority. <a href={regionalPriceSource.sourceUrl} target="_blank" rel="noreferrer">Statistics Canada price reference</a></p>
    <details><summary>How it’s calculated</summary><p>Uses saved package prices first, then compatible regional averages. Regional reference weights are planning quantities, not actual store package sizes. Quantities are rounded up to whole packages. Items without an amount count as one package. Delivery, deposits, and extra taxes aren’t included.</p></details>
  </div>;
}
export default function FoodPrices({ state, setState, notify }) {
  const [error,setError]=useState('');
  const names=[...new Set([...catalog.map((c)=>c.name),...state.groceries.map((g)=>g.name)])].sort();
  const saved=Object.entries(state.foodPrices||{});
  return <Panel title="Your food prices" subtitle="Use regional estimates as a starting point, or save prices from your shop for a closer match.">
    {state.sampleAccount && <p className="notice">Demo prices are illustrative examples, not store quotes.</p>}
    <CityField value={state.profile.city} location={state.profile.cityLocation} onChange={(city, cityLocation) => setState((s) => ({ ...s, profile: { ...s.profile, city, cityLocation } }))} />
    <p className="form-hint">Available estimates use provincial averages, not live prices at a nearby store. Some foods use clearly labeled similar-product estimates. Products without a suitable match stay unpriced.</p>
    <form className="food-price-form" onSubmit={(e)=>{e.preventDefault();const f=new FormData(e.currentTarget),name=String(f.get('food')).trim(),price=Number(f.get('cad')),grams=Number(f.get('grams'));if(!name||!Number.isFinite(price)||price<0||price>10000||!Number.isFinite(grams)||grams<=0||grams>100000){setError('Enter a food, a valid CAD price, and a positive package weight.');return;}setState((s)=>({...s,foodPrices:{...s.foodPrices,[foodPriceKey(name)]:{name,cad:price,grams,updatedAt:new Date().toISOString()}}}));setError('');notify('Food price saved');}}>
      <Field label="Food name"><input name="food" list="priced-food-names" placeholder="Choose or type a food" required maxLength={100}/><datalist id="priced-food-names">{names.map((n)=><option key={n} value={n}/>)}</datalist></Field>
      <Field label="Package price (CAD)" name="cad" type="number" min="0" max="10000" step="0.01" required placeholder="e.g. 4.50"/>
      <Field label="Package contents (g)" name="grams" type="number" min="0.1" max="100000" step="0.1" required placeholder="e.g. 500"/>
      <button className="btn outline">Save price</button>
    </form>
    {error&&<p className="error" role="alert">{error}</p>}
    <p className="form-hint">Use the same food name as your ingredient or shopping item. For example, a $4.50 package containing 500 g costs $0.90 per 100 g.</p>
    <details className="saved-food-prices"><summary>{saved.length} saved food prices</summary>{saved.map(([key,p])=><div className="fridge-row" key={key}><strong>{p.name}</strong><span>{cad(p.cad)} / {p.grams} g</span><button className="text-btn" onClick={()=>setState((s)=>{const next={...s.foodPrices};delete next[key];return{...s,foodPrices:next};})}>Remove</button></div>)}</details>
  </Panel>;
}
