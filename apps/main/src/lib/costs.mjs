import { regionalFoodPrice } from "./regional-costs.mjs";
export const foodPriceKey = (name) => String(name || '').trim().toLowerCase();
export function foodPrice(state, name) {
  const p = state.foodPrices?.[foodPriceKey(name)];
  return p && Number.isFinite(p.cad) && p.cad >= 0 && Number.isFinite(p.grams) && p.grams > 0 ? { ...p, estimated: false } : regionalFoodPrice(state, name);
}
export function groceryCosts(state, rows = state.groceries) {
  const lines = rows.map((g) => {
    const p = foodPrice(state,g.name), quantityKnown = Number.isFinite(g.grams) && g.grams > 0;
    const packages = p ? quantityKnown ? Math.ceil(g.grams / p.grams) : 1 : null;
    return { id:g.id, name:g.name, known:!!p, packages, assumedPackage:!quantityKnown, estimated:!!p?.estimated, source:p?.source, region:p?.region, period:p?.period, cad:p ? packages*p.cad : null };
  });
  return { lines, total:lines.reduce((sum,l)=>sum+(l.cad??0),0), unknown:lines.filter((l)=>!l.known).length, complete:lines.every((l)=>l.known) };
}
export function recipeCosts(state, recipe, inventory = [], servings = 1) {
  const amounts = new Map();
  for (const [name,g] of recipe.ingredients) { const key=foodPriceKey(name), old=amounts.get(key); amounts.set(key,{name,grams:(old?.grams||0)+g*servings}); }
  let used=0,checkout=0,missingPrices=0,missingPurchasePrices=0;
  for (const {name,grams} of amounts.values()) {
    const p=foodPrice(state,name), stock=inventory.filter((i)=>foodPriceKey(i.name)===foodPriceKey(name)&&i.grams>0).reduce((sum,i)=>sum+i.grams,0), missing=Math.max(0,grams-stock);
    if(p){used+=grams/p.grams*p.cad;checkout+=Math.ceil(missing/p.grams)*p.cad;}
    else {missingPrices++;if(missing>0)missingPurchasePrices++;}
  }
  return {perServing:used/servings,checkout,missingPrices,missingPurchasePrices,complete:missingPrices===0,purchaseComplete:missingPurchasePrices===0};
}
export const cad = (amount) => new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(amount);
