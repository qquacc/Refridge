import { upgradeState } from './domain.mjs';
const fail = () => { throw Error('This file is not a valid Refridge backup. Choose a JSON file created with Export data.'); };
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
export function importBackup(text, current) {
  if (new TextEncoder().encode(text).length > 1500000) throw Error('This backup is too large. Choose a file smaller than 1.5 MB.');
  let raw; try { raw = JSON.parse(text); } catch { throw Error('This file could not be read. Choose a valid JSON backup.'); }
  function inspect(v, depth = 0) {
    if (depth > 30) fail();
    if (v && typeof v === 'object') for (const [k, child] of Object.entries(v)) { if (['__proto__','prototype','constructor'].includes(k)) fail(); inspect(child, depth + 1); }
  }
  inspect(raw);
  if (!object(raw) || !object(raw.profile) || typeof raw.profile.name !== 'string' || !object(raw.goals)) fail();
  for (const k of ['kcal','protein','fiber']) if (!Number.isFinite(raw.goals[k]) || raw.goals[k] < 0) fail();
  for (const key of ['items','logs','groceries','fridges','members','friendItems','staples','completedGroceries','pointsLedger','trades','dinners','plans','containers','assignedChallenges','scannerEvents','challenges','remoteTrades','remotePointsLedger']) {
    if (['items','logs','groceries','fridges','members'].includes(key) && !Array.isArray(raw[key])) fail();
    if (raw[key] !== undefined && (!Array.isArray(raw[key]) || !raw[key].every(object))) fail();
  }
  for (const key of ['diets','allergenAvoid','cuisines']) if (raw.profile[key] !== undefined && (!Array.isArray(raw.profile[key]) || !raw.profile[key].every((v) => typeof v === 'string'))) fail();
  for (const f of [...raw.items, ...(raw.friendItems || [])]) if (typeof f.id !== 'string' || typeof f.name !== 'string' || !Number.isFinite(f.grams) || f.grams < 0) fail();
  for (const l of raw.logs) if (typeof l.date !== 'string' || typeof l.name !== 'string' || !object(l.nutrients)) fail();
  for (const g of raw.groceries) if (typeof g.id !== 'string' || typeof g.name !== 'string') fail();
  for (const f of raw.fridges) if (typeof f.id !== 'string' || typeof f.name !== 'string' || !Array.isArray(f.members)) fail();
  for (const m of raw.members) if (typeof m.id !== 'string' || typeof m.name !== 'string') fail();
  for (const key of ['wellbeing','weightTracking']) if (raw[key] !== undefined && !object(raw[key])) fail();
  if (raw.wellbeing?.checkIns !== undefined && (!Array.isArray(raw.wellbeing.checkIns) || !raw.wellbeing.checkIns.every((e) => object(e) && typeof e.date === 'string'))) fail();
  if (raw.weightTracking?.entries !== undefined && (!Array.isArray(raw.weightTracking.entries) || !raw.weightTracking.entries.every((e) => object(e) && typeof e.date === 'string' && Number.isFinite(e.kg) && e.kg >= 1 && e.kg <= 700))) fail();
  const imported = upgradeState(raw);
  // Backups restore personal records, never another account's live social identity.
  for (const key of ['socialSettings','ownSessionId','remoteTrades','remotePointsLedger','friendMessages','sampleAccount','demoMessages']) {
    delete imported[key]; if (current[key] !== undefined) imported[key] = current[key];
  }
  imported.fridges = [...imported.fridges.filter((f) => !f.remote), ...current.fridges.filter((f) => f.remote)];
  imported.members = [...imported.members.filter((m) => !m.remote), ...current.members.filter((m) => m.remote)];
  imported.friendItems = [...imported.friendItems.filter((f) => !f.remote), ...current.friendItems.filter((f) => f.remote)];
  if (!imported.fridges.some((f) => f.id === imported.activeFridgeId)) imported.activeFridgeId = imported.fridges[0]?.id || 'my-fridge';
  if (new TextEncoder().encode(JSON.stringify(imported)).length > 1500000) throw Error('This backup is too large to save to your account.');
  return imported;
}
