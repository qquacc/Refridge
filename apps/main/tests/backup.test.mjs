import test from 'node:test';
import assert from 'node:assert/strict';
import { importBackup } from '../src/lib/backup.mjs';
import { upgradeState } from '../src/lib/domain.mjs';
import { initialState, today } from '../src/data/food.mjs';
import { reconcileChallenges } from '../src/lib/planning.mjs';
const state = () => upgradeState(initialState());
test('backup roundtrip restores personal data while preserving current live connections and identity', () => {
  const source = state(), current = state(); source.profile.name = 'Restored';
  source.ownSessionId='foreign'; source.socialSettings={enabled:true}; source.friendMessages=[{text:'private foreign chat'}]; source.fridges.push({id:'foreign-remote',name:'Remote fridge',remote:true,members:[]});
  current.ownSessionId='current'; current.socialSettings={enabled:false}; current.friendMessages=[{text:'my chat'}];current.sampleAccount=false;
  const imported=importBackup(JSON.stringify(source),current);
  assert.equal(imported.profile.name,'Restored'); assert.equal(imported.items.length,source.items.length);
  assert.equal(imported.ownSessionId,'current'); assert.equal(imported.socialSettings.enabled,false);assert.deepEqual(imported.friendMessages,current.friendMessages);
  assert(!imported.fridges.some((f)=>f.id==='foreign-remote'));assert.equal(imported.sampleAccount,false);
});
test('import rejects malformed JSON, invalid state, dangerous keys and oversized backups', () => {
  const current=state(); for(const input of ['{', '{}', 'null', JSON.stringify({...current,logs:[null]}), JSON.stringify({...current,profile:{name:'A',diets:'vegan'}}), '{"__proto__":{}}', ' '.repeat(1500001)]) assert.throws(()=>importBackup(input,current));
});
test('earned challenges stay complete if the triggering diary entry is later changed, without another award', () => {
  const s=state(), earned={id:today()+':cook',userId:'me',date:today(),points:30,reason:'Cooked'};
  s.logs=[];s.pointsLedger=[earned];
  const updated=reconcileChallenges(s), challenge=updated.assignedChallenges.find((c)=>c.id==='cook');
  assert(challenge.completed);assert.equal(updated.pointsLedger.filter((p)=>p.id===earned.id).length,1);
});
