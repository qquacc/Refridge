import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleState, enrichSampleState } from '../demo-state.mjs';
test('complete demo includes only Allen and Ava with populated shopping, trends, shared plans and conversations',()=>{
 const s=sampleState();assert.deepEqual(s.members.filter((m)=>m.id!=='me').map((m)=>m.name),['Allen','Ava']);
 assert.equal(s.fridges.length,3);assert(s.items.length>20);assert(s.groceries.length);assert(s.completedGroceries.length);assert(s.dinners.length);assert(s.trades.length>1);assert(s.weightTracking.entries.length>=20);assert.equal(s.wellbeing.checkIns.length,90);assert(s.logs.length>600);assert(Object.keys(s.foodPrices).length>40);
 for(const friend of ['allen','ava'])assert(s.demoMessages.some((m)=>m.fromId===friend));
 assert(s.demoMessages.some((m)=>m.prompt==='meal'));assert(s.demoMessages.some((m)=>m.prompt==='competition'));
 assert(Buffer.byteLength(JSON.stringify(s))<1500000);
});
test('older sample accounts enrich once, keep personal edits and remove extra demo connections',()=>{
 const old=sampleState();delete old.sampleDataVersion;old.household='My edited demo';old.members.push({id:'extra',name:'Extra'});old.fridges.push({id:'extra',ownerId:'extra'});old.demoMessages.push({id:'custom-chat',fromId:'me',toId:'allen',text:'Keep this',kind:'text'});
 const next=enrichSampleState(old);assert.equal(next.household,'My edited demo');assert.equal(next.members.length,3);assert.equal(next.fridges.length,3);assert(next.demoMessages.some((m)=>m.id==='custom-chat'));assert.equal(enrichSampleState(next),next);
});
