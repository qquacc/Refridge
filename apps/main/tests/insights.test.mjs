import test from 'node:test';
import assert from 'node:assert/strict';
import { saveWeight, weightReminder, shiftDate, wrappedInsights, correlation } from '../src/lib/insights.mjs';
const base = () => ({ profile: { name: 'Alex', weightKg: 70 }, logs: [], weightTracking: { entries: [] }, wellbeing: { checkIns: [] } });
test('weigh-ins validate dates and values, replace a date, and only the latest measurement updates the profile', () => {
  let s = saveWeight(base(), { date: '2026-11-08', kg: '71.24' }, '2026-11-08');
  assert.equal(s.profile.weightKg, 71.2);
  s = saveWeight(s, { date: '2026-11-05', kg: 72 }, '2026-11-08');
  assert.equal(s.profile.weightKg, 71.2);
  s = saveWeight(s, { date: '2026-11-08', kg: 71 }, '2026-11-08');
  assert.equal(s.weightTracking.entries.length, 2);
  assert.equal(s.profile.weightKg, 71);
  for (const entry of [{date:'2026-02-31',kg:70},{date:'2026-11-09',kg:70},{date:'2026-11-08',kg:''},{date:'2026-11-08',kg:701}]) assert.throws(() => saveWeight(s,entry,'2026-11-08'));
});
test('three-day reminders honor snooze and opt-out without changing food streaks', () => {
  let s = base(); s.logs = [{date:'2026-11-08'},{date:'2026-11-07'},{date:'2026-11-06',userId:'friend'}];
  assert.equal(weightReminder(s,'2026-11-08').streak,2);
  s = saveWeight(s,{date:'2026-11-06',kg:70},'2026-11-08');
  assert.equal(weightReminder(s,'2026-11-08').due,false);
  assert.equal(weightReminder(s,'2026-11-09').due,true);
  s.weightTracking.snoozedUntil='2026-11-12';
  assert.equal(weightReminder(s,'2026-11-11').due,false);
  assert.equal(weightReminder(s,'2026-11-12').due,true);
  s.weightTracking.enabled=false;
  assert.equal(weightReminder(s,'2026-11-12').due,false);
});
test('Wrapped excludes others and future records, retains known zero, and leaves missing days empty', () => {
  const s=base();s.logs=[{date:'2026-11-08',name:'Rice',nutrients:{kcal:0,protein:0}},{date:'2026-11-08',name:'Unknown',nutrients:{}},{date:'2026-11-08',userId:'friend',name:'Private',nutrients:{kcal:900}},{date:'2026-11-09',name:'Future',nutrients:{kcal:400}}];
  const d=wrappedInsights(s,'2026-11-08',30);
  assert.equal(d.logs,2); assert.equal(d.series.at(-1).kcal,0); assert.equal(d.series.at(-1).kcalComplete,false); assert.equal(d.series[0].kcal,null);assert.equal(d.averages.kcal,0);assert.equal(d.weightCalories,null);
});
test('relationships need variation and enough pairs; calorie-weight analysis rejects missing intervals', () => {
  assert.equal(correlation([[1,2],[2,3]]),null);
  assert.equal(correlation(Array.from({length:8},(_,i)=>[1,i])),null);
  assert(Math.abs(correlation(Array.from({length:8},(_,i)=>[i,i*2])).r-1)<1e-10);
  const s=base();
  s.logs=Array.from({length:30},(_,i)=>({date:shiftDate('2026-11-08',-i),name:'Meal',nutrients:{kcal:1500+i*12}}));
  s.weightTracking.entries=Array.from({length:10},(_,i)=>({date:shiftDate('2026-11-08',-i*3),kg:70+i*i*.01}));
  let d=wrappedInsights(s,'2026-11-08',30);assert.equal(d.weightPairs,9);assert(d.weightCalories);
  s.logs=s.logs.filter((_,i)=>i%3!==1);d=wrappedInsights(s,'2026-11-08',30);assert.equal(d.weightPairs,0);assert.equal(d.weightCalories,null);
});
