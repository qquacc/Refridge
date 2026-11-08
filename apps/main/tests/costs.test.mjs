import test from 'node:test';
import assert from 'node:assert/strict';
import { groceryCosts, recipeCosts, foodPrice } from '../src/lib/costs.mjs';
import { allowedRecipes } from '../src/lib/planning.mjs';
import { upgradeState } from '../src/lib/domain.mjs';
import { initialState, catalog } from '../src/data/food.mjs';
const state=()=>({foodPrices:{rice:{name:'Rice',cad:4.5,grams:500}},groceries:[]});
test('grocery estimates round to packages and distinguish missing prices from zero cost',()=>{
  const s=state();s.groceries=[{id:'r',name:'RICE',grams:600},{id:'x',name:'Unknown',grams:100}];
  let c=groceryCosts(s);assert.equal(c.total,9);assert.equal(c.lines[0].packages,2);assert.equal(c.unknown,1);assert.equal(c.complete,false);
  s.groceries=[{id:'r',name:'Rice'}];c=groceryCosts(s);assert.equal(c.total,4.5);assert.equal(c.lines[0].assumedPackage,true);
  s.foodPrices.rice.cad=0;assert.equal(groceryCosts(s).total,0);assert.equal(groceryCosts(s).complete,true);
  assert.equal(foodPrice({foodPrices:{rice:{cad:4,grams:0}}},'Rice'),null);
});
test('recipe estimates separate consumed cost, whole-package purchases and existing stock',()=>{
  const s=state(),recipe={ingredients:[['Rice',100],['Rice',50]]};
  const c=recipeCosts(s,recipe,[{name:'Rice',grams:100}],2);
  assert(Math.abs(c.perServing-1.35)<1e-9);assert.equal(c.checkout,4.5);assert.equal(c.complete,true);
  const stocked=recipeCosts(s,recipe,[{name:'Rice',grams:500}],2);assert.equal(stocked.checkout,0);assert(Math.abs(stocked.perServing-1.35)<1e-9);
});
test('unpriced ingredients do not become free, but fully stocked recipes can require no purchases',()=>{
  const c=recipeCosts(state(),{ingredients:[['Unknown',100]]},[{name:'Unknown',grams:100}]);
  assert.equal(c.complete,false);assert.equal(c.purchaseComplete,true);assert.equal(c.checkout,0);
  const missing=recipeCosts(state(),{ingredients:[['Unknown',100]]},[]);assert.equal(missing.purchaseComplete,false);assert.equal(missing.missingPurchasePrices,1);
});
test('affordability sorts recipes by actual missing-package cost while retaining dietary filters',()=>{
  const s=upgradeState(initialState());s.profile.goal='Affordability';s.items=[];s.friendItems=[];
  s.foodPrices=Object.fromEntries(catalog.map((f,i)=>[f.name.toLowerCase(),{name:f.name,cad:1+i/10,grams:500}]));
  const recipes=allowedRecipes(s);assert(recipes.length>1);
  const costs=recipes.map((r)=>recipeCosts(s,r,[]));
  for(let i=1;i<costs.length;i++)if(costs[i-1].purchaseComplete&&costs[i].purchaseComplete)assert(costs[i-1].checkout<=costs[i].checkout+.01);
});
