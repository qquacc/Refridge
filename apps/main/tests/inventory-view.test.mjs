import test from 'node:test';import assert from 'node:assert/strict';
import { visibleInventory } from '../src/lib/inventory-view.mjs';
const state={fridges:[{id:'mine',ownerId:'me'},{id:'allen',ownerId:'allen',shared:true},{id:'ava',ownerId:'ava',remote:true,shared:false}],items:[{id:'m',name:'Apple',grams:100,fridgeId:'mine'}],friendItems:[{id:'a',name:'Rice',grams:200,fridgeId:'allen'},{id:'b',name:'Carrot',grams:300,fridgeId:'ava'},{id:'empty',name:'Milk',grams:0,fridgeId:'ava'}]};
test('Inventory defaults to own food and friends are an explicit independent opt-in',()=>{
 assert.deepEqual(visibleInventory(state).map((i)=>i.id),['m']);
 assert.deepEqual(visibleInventory(state,{includeFriends:true}).map((i)=>i.id),['m','a','b']);
 assert.deepEqual(visibleInventory(state,{includeFriends:true,query:' carrot '}).map((i)=>i.id),['b']);
});
test('selecting a different inspected fridge changes the displayed inventory',()=>{
 assert.deepEqual(visibleInventory(state,{fridgeId:'allen'}).map((i)=>i.id),['a']);
 assert.deepEqual(visibleInventory(state,{fridgeId:'ava'}).map((i)=>i.id),['b']);
 assert.deepEqual(visibleInventory(state,{fridgeId:'disconnected'}),[]);
});
