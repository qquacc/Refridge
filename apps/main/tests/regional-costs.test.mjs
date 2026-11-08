import test from 'node:test';import assert from 'node:assert/strict';
import {foodPrice,groceryCosts} from '../src/lib/costs.mjs';
import {regionalFoodPrice} from '../src/lib/regional-costs.mjs';
test('regional prices require a confirmed Canadian location, honor manual overrides, and do not invent product matches',()=>{
 const state={profile:{city:'Calgary',cityLocation:{name:'Calgary',province:'Alberta',countryCode:'CA'}},foodPrices:{},groceries:[{id:'a',name:'Apple',grams:500}]};
 const p=foodPrice(state,'Apple');assert(p.cad>0);assert.equal(p.region,'Alberta');assert(p.estimated);assert.equal(p.period,'2026-09');assert.equal(groceryCosts(state).unknown,0);
 state.foodPrices.apple={cad:9,grams:500};assert.equal(foodPrice(state,'Apple').cad,9);assert.equal(foodPrice(state,'Apple').estimated,false);
 assert.equal(regionalFoodPrice(state,'Pepsi can'),null);assert.equal(regionalFoodPrice(state,'Brown rice'),null);assert(regionalFoodPrice(state,'dry brown rice'));assert.equal(regionalFoodPrice({...state,profile:{city:'Calgary'}},'Apple'),null);
 assert.equal(regionalFoodPrice({...state,profile:{cityLocation:{name:'Iqaluit',province:'Nunavut',countryCode:'CA'}}},'Apple'),null);
});
test('regional name variants and comparable products are priced with explicit uncertainty',()=>{
 const s={profile:{cityLocation:{name:'Calgary',province:'Alberta',countryCode:'CA'}},foodPrices:{}};
 assert.equal(foodPrice(s,'Apples').cad,foodPrice(s,'Apple').cad);
 const yogurt=foodPrice(s,'Greek yogurt');assert(yogurt.cad>0);assert.equal(yogurt.comparable,true);assert.match(yogurt.matchNote,/may cost more/);
 const tomato=foodPrice(s,'Cherry tomatoes');assert(tomato.cad>0);assert.equal(tomato.region,'Alberta');
 s.foodPrices['greek yogurt']={cad:6,grams:750};assert.equal(foodPrice(s,'Greek yogurt').cad,6);assert.equal(foodPrice(s,'Greek yogurt').estimated,false);
});
