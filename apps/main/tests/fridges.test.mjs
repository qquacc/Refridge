import test from 'node:test';
import assert from 'node:assert/strict';
import { combineOwnFridges } from '../src/lib/fridges.mjs';
test('secondary personal fridges combine without losing food, friends, or shared meal references',()=>{
 const state={fridges:[{id:'my-fridge',ownerId:'me',members:['me'],shared:false},{id:'second',ownerId:'me',members:['me','roommate']},{id:'friend',ownerId:'ava',members:['ava'],remote:true}],activeFridgeId:'second',items:[{id:'a',fridgeId:'my-fridge',grams:50}],friendItems:[{id:'b',fridgeId:'second',grams:100},{id:'c',fridgeId:'friend',grams:200}],containers:[],dinners:[{fridgeIds:['second','my-fridge','friend']}]};
 const result=combineOwnFridges(state);
 assert.equal(result.fridges.length,2);assert.equal(result.activeFridgeId,'my-fridge');assert.deepEqual(result.items.map((i)=>i.id),['a','b']);assert(result.items.every((i)=>i.fridgeId==='my-fridge'));assert.deepEqual(result.friendItems,[state.friendItems[1]]);assert.deepEqual(result.dinners[0].fridgeIds,['my-fridge','friend']);assert.equal(result.fridges[0].shared,false);assert.deepEqual(result.fridges[0].members,['me','roommate']);assert.deepEqual(combineOwnFridges(result),result);
});
