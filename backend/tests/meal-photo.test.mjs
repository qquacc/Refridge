import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeMealPhoto } from '../meal-vision.mjs';
import { setup, jpg } from './helpers.mjs';
const result = {name:'Rice and chicken',grams:320,nutrients:{kcal:550,protein:35,carbs:60,fat:18,fiber:3},confidence:.85,note:'Sauce amount is approximate.'};
const reply = (v) => ({ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(v)}]}}]})});
test('meal recognition uses one compact Gemini request with serving totals and low thinking',async()=>{
  let calls=0;
  const meal=await analyzeMealPhoto(jpg,{apiKey:'test',model:'gemini-2.5-flash',fetchImpl:async(url,options)=>{calls++;assert.match(url,/gemini-2.5-flash/);const body=JSON.parse(options.body);assert.equal(body.contents[0].parts.length,2);assert.equal(body.generationConfig.thinkingConfig.thinkingBudget,0);assert.equal(body.generationConfig.maxOutputTokens,700);assert.match(body.contents[0].parts[0].text,/TOTAL serving/);return reply(result);}});
  assert.equal(calls,1);assert.equal(meal.nutrients.kcal,550);assert.equal(meal.estimated,true);assert.equal(meal.grams,320);
});
test('unclear and malformed meals fail without fabricated nutrition; missing fields stay unknown',async()=>{
  await assert.rejects(()=>analyzeMealPhoto(jpg,{apiKey:'test',fetchImpl:async()=>reply({...result,confidence:.1})}),/unclear/);
  const meal=await analyzeMealPhoto(jpg,{apiKey:'test',fetchImpl:async()=>reply({...result,nutrients:{kcal:-20,protein:null,carbs:0,fat:18,fiber:NaN}})});
  assert.equal(meal.nutrients.kcal,null);assert.equal(meal.nutrients.protein,null);assert.equal(meal.nutrients.carbs,0);
  await assert.rejects(()=>analyzeMealPhoto(jpg,{apiKey:'test',fetchImpl:async()=>({ok:false,status:503})}),/503/);
});
test('meal endpoint requires account login, validates uploads, and never changes inventory or logs',async(t)=>{
  let calls=0;const x=await setup(t,{mealAnalyzer:async(bytes)=>{calls++;assert.deepEqual(bytes,jpg);return result;}});
  const body={jpegBase64:jpg.toString('base64')};
  assert.equal((await x.request('/api/meals/recognize',{method:'POST',body})).status,401);
  const signup=await fetch(x.base+'/api/auth/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'meal_test',password:'photo-test-password'})});
  const cookie=signup.headers.get('set-cookie').split(';')[0];assert.equal(signup.status,201);
  const before=JSON.stringify((await x.app.store.read()).accounts);
  assert.equal((await x.request('/api/meals/recognize',{method:'POST',headers:{Cookie:cookie},body:{jpegBase64:'bad'}})).status,400);
  const response=await x.request('/api/meals/recognize',{method:'POST',headers:{Cookie:cookie},body});assert.equal(response.status,200);assert.equal(response.data.name,result.name);assert.equal(calls,1);
  assert.equal(JSON.stringify((await x.app.store.read()).accounts),before);
});

test('a recognized Pepsi can remains identifiable when size, nutrition and expiry are unreadable',async()=>{
  const meal=await analyzeMealPhoto(jpg,{apiKey:'test',fetchImpl:async(_,options)=>{
    const prompt=JSON.parse(options.body).contents[0].parts[0].text;
    assert.match(prompt,/Missing expiry NEVER prevents identification/);
    return reply({name:'Pepsi cola can',grams:null,nutrients:{kcal:null,protein:null,carbs:null,fat:null,fiber:null},confidence:.92,note:'Brand recognized; size and label are unreadable.'});
  }});
  assert.equal(meal.name,'Pepsi cola can');assert.equal(meal.grams,null);assert.equal(meal.nutrients.kcal,null);assert.equal(meal.estimated,true);
});
