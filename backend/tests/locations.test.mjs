import test from 'node:test';import assert from 'node:assert/strict';import {searchCities} from '../locations.mjs';
test('city index resolves Calgary, supports accents, and leaves ambiguous names for selection',async()=>{
 const results=await searchCities('Calgary');assert.equal(results[0].name,'Calgary');assert.equal(results[0].province,'Alberta');assert.equal(results[0].countryCode,'CA');assert.equal(results[0].timezone,'America/Edmonton');
 assert((await searchCities('Montreal')).some((c)=>c.name==='Montréal'));assert.equal((await searchCities('c')).length,0);assert.equal((await searchCities('no-such-city-refridge')).length,0);assert((await searchCities('Saint')).length<=8);
});
