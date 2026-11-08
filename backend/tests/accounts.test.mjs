import test from "node:test";
import assert from "node:assert/strict";
import { setup, jpg } from "./helpers.mjs";
import { initialState } from "../../apps/main/src/data/food.mjs";
import { MongoStore } from "../mongo-store.mjs";
import { fakeMongo } from "./fake-mongo.mjs";
async function client(x, initialCookie = "") {
  let cookie = initialCookie;
  return {
    cookie: () => cookie,
    request: async (path, { body, method = body ? "POST" : "GET", token, headers = {} } = {}) => {
      const r = await fetch(x.base + path, { method, headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(token ? { Authorization: "Bearer " + token } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
      const set = r.headers.get("set-cookie");
      if (set) cookie = set.split(";")[0];
      return { status: r.status, cookie: set, data: r.headers.get("content-type")?.includes("json") ? await r.json() : Buffer.from(await r.arrayBuffer()) };
    },
  };
}
const password = "test-account-password-123";

test("username/password accounts save separate state, reject stale or cross-account writes, and revoke logout sessions", async (t) => {
  const x = await setup(t), a = await client(x), b = await client(x);
  assert.equal((await a.request("/api/auth/me")).status, 401);
  const signup = await a.request("/api/auth/signup", { body: { username: "ALICE", password } });
  assert.equal(signup.status, 201);
  assert.equal(signup.data.account.username, "alice");
  assert.match(signup.cookie, /HttpOnly/); assert.match(signup.cookie, /SameSite=Strict/);
  const alice = signup.data.account.id;
  const bob = (await b.request("/api/auth/signup", { body: { username: "bob", password } })).data.account.id;
  const value = { ...initialState(), profile: { name: "Alice private profile" }, items: [], logs: [], groceries: [] };
  assert.equal((await a.request("/api/account/state", { body: { accountId: alice, revision: 0, appState: value } })).status, 200);
  assert.equal((await b.request("/api/account/state")).data.appState, null);
  assert.equal((await b.request("/api/account/state", { body: { accountId: alice, revision: 0, appState: value } })).status, 403);
  assert.equal((await a.request("/api/account/state", { body: { accountId: alice, revision: 0, appState: value } })).status, 409);
  assert.equal((await b.request("/api/account/state", { body: { accountId: bob, revision: 0, appState: { ...value, profile: { name: "Bob" } } } })).status, 200);
  const oldCookie = a.cookie();
  assert.equal((await a.request("/api/auth/logout", { body: {} })).status, 200);
  const replay = await client(x, oldCookie);
  assert.equal((await replay.request("/api/account/state")).status, 401);
  assert.equal((await a.request("/api/auth/login", { body: { username: "alice", password: "incorrect-password" } })).status, 401);
  const login = await a.request("/api/auth/login", { body: { username: "Alice", password } });
  assert.equal(login.status, 200);
  assert.equal(login.data.appState.profile.name, "Alice private profile");
  const stored = await x.app.store.read();
  assert(!JSON.stringify(stored).includes(password));
  assert(!JSON.stringify(stored).includes(a.cookie().split("=")[1]));
  assert.notEqual(stored.accounts[alice].passwordHash, stored.accounts[bob].passwordHash);
});

test("account camera sessions and private images cannot be read with another account or a copied owner marker", async (t) => {
  const x = await setup(t), a = await client(x), b = await client(x), anon = await client(x);
  await a.request("/api/auth/signup", { body: { username: "camera_a", password } });
  await b.request("/api/auth/signup", { body: { username: "camera_b", password } });
  const cameraOwner = (await a.request("/api/sessions", { body: { fridgeId: "my-fridge" } })).data;
  const token = cameraOwner.ownerToken;
  assert.equal((await a.request("/api/session", { token })).status, 200);
  assert.equal((await b.request("/api/session", { token })).status, 401);
  assert.equal((await anon.request("/api/session", { token })).status, 401);
  assert.deepEqual((await a.request("/api/auth/me")).data.cameraDevice, cameraOwner);
  const pair = (await a.request("/api/pairing", { body: {}, token })).data;
  const cam = (await anon.request("/api/pair", { body: { code: pair.code, name: "Top Camera" } })).data;
  assert.equal((await anon.request("/api/camera/heartbeat", { token: cam.cameraToken, body: { ready: true } })).status, 200);
  const event = (await a.request("/api/capture", { token, body: {} })).data;
  const photo = await anon.request(`/api/events/${event.id}/image`, { token: cam.cameraToken, body: { jpegBase64: jpg.toString("base64") } });
  assert.equal(photo.status, 201);
  assert.equal((await a.request(`/api/images/${photo.data.id}`, { token })).status, 200);
  assert.equal((await b.request(`/api/images/${photo.data.id}`, { token })).status, 401);
  assert.equal((await anon.request(`/api/images/${photo.data.id}`, { token })).status, 401);
  x.setTime(x.getTime() + 8 * 24 * 60 * 60 * 1000);
  assert.equal((await a.request("/api/session", { token })).status, 401);
});

test("legacy cameras require proof of device ownership and cannot be claimed by two accounts", async (t) => {
  const x = await setup(t), anon = await client(x), a = await client(x), b = await client(x);
  const legacy = await x.owner();
  await a.request("/api/auth/signup", { body: { username: "legacy_a", password, importState: initialState() } });
  await b.request("/api/auth/signup", { body: { username: "legacy_b", password } });
  assert.equal((await a.request("/api/auth/claim-camera", { body: { ownerToken: "wrong" } })).status, 403);
  const claimed = await a.request("/api/auth/claim-camera", { body: { ownerToken: legacy.ownerToken } });
  assert.equal(claimed.status, 200);
  assert.equal(claimed.data.cameraDevice.sessionId, legacy.sessionId);
  assert.equal((await b.request("/api/auth/claim-camera", { body: { ownerToken: legacy.ownerToken } })).status, 403);
  assert.equal((await anon.request("/api/session", { token: legacy.ownerToken })).status, 401);
});

test("accounts and login sessions persist across Mongo-backed cold instances", async (t) => {
  const fake = fakeMongo();
  const store = await new MongoStore({ client: fake.client() }).initialize();
  const x = await setup(t, { store, images: store.images }), a = await client(x);
  const registered = await a.request("/api/auth/signup", { body: { username: "persisted", password }, headers: { "x-forwarded-proto": "https" } });
  assert.match(registered.cookie, /Secure/);
  assert.equal(typeof registered.data.account.createdAt, "number");
  const storedAccount = (await store.read()).accounts[registered.data.account.id];
  assert.equal(storedAccount.createdAt, registered.data.account.createdAt);
  const another = await new MongoStore({ client: fake.client() }).initialize();
  const y = await setup(t, { store: another, images: another.images }), restored = await client(y, a.cookie());
  const me = (await restored.request("/api/auth/me")).data.account;
  assert.equal(me.id, registered.data.account.id);
  assert.equal(me.createdAt, registered.data.account.createdAt);
  await restored.request("/api/auth/logout", { body: {} });
  const login = await restored.request("/api/auth/login", { body: { username: "persisted", password } });
  assert.equal(login.data.account.createdAt, registered.data.account.createdAt);
});

test("case-insensitive usernames, password limits, and persistent login throttling are enforced", async (t) => {
  const x = await setup(t), a = await client(x);
  assert.equal((await a.request("/api/auth/signup", { body: { username: "wrong space", password } })).status, 400);
  assert.equal((await a.request("/api/auth/signup", { body: { username: "valid", password: "short" } })).status, 400);
  assert.equal((await a.request("/api/auth/signup", { body: { username: "valid", password } })).status, 201);
  assert.equal((await a.request("/api/auth/signup", { body: { username: "VALID", password } })).status, 409);
  for (let n = 0; n < 9; n++) assert.equal((await a.request("/api/auth/login", { body: { username: "valid", password: "wrong-password" } })).status, 401);
  assert.equal((await a.request("/api/auth/login", { body: { username: "valid", password } })).status, 429);
});

test("sample login provisions a populated demo once and preserves subsequent edits", async (t) => {
  const x = await setup(t), user = await client(x);
  assert.equal((await user.request('/api/auth/login', { body: { username: 'sample', password: 'wrong-password' } })).status, 401);
  const login = await user.request('/api/auth/login', { body: { username: 'sample', password: '1234567890' } });
  assert.equal(login.status, 200);
  const s = login.data.appState;
  assert.equal(s.household, "Nathaniel's Kitchen");
  assert.equal(s.profile.name, 'Nathaniel');
  assert(s.targetCalculation.available);
  assert(s.items.length >= 20);
  assert(s.logs.length >= 500);
  assert.equal(s.wellbeing.checkIns.length, 90);
  assert(s.fridges.some((f) => f.name === "Allen's Fridge"));
  assert(s.fridges.some((f) => f.name === "Ava's Fridge"));
  assert(s.friendItems.length && s.trades.length);
  assert.equal(s.onboarding.completed, true);
  assert(JSON.stringify(s).length < 1500000);
  const edited = { ...s, household: 'Demo edited kitchen' };
  assert.equal((await user.request('/api/account/state', { body: { accountId: login.data.account.id, revision: login.data.revision, appState: edited } })).status, 200);
  await user.request('/api/auth/logout', { body: {} });
  const again = await user.request('/api/auth/login', { body: { username: 'sample', password: '1234567890' } });
  assert.equal(again.data.appState.household, 'Demo edited kitchen');
  const other = await client(x);
  const signup = await other.request('/api/auth/signup', { body: { username: 'ordinary', password } });
  assert.equal(signup.data.appState, null);
});

test('legacy membership dates are backfilled once on login or existing-session restore and persisted in Mongo', async(t)=>{
  const fake=fakeMongo(),store=await new MongoStore({client:fake.client()}).initialize();
  const x=await setup(t,{store,images:store.images}),a=await client(x);
  const signup=await a.request('/api/auth/signup',{body:{username:'legacy_date',password}}),id=signup.data.account.id;
  await store.mutate((s)=>{delete s.accounts[id].createdAt;});
  x.setTime(x.getTime()+86400000);
  const first=x.getTime();
  assert.equal((await a.request('/api/auth/me')).data.account.createdAt,first);
  const fresh=await new MongoStore({client:fake.client()}).initialize();
  assert.equal((await fresh.read()).accounts[id].createdAt,first);
  x.setTime(first+86400000);
  assert.equal((await a.request('/api/auth/me')).data.account.createdAt,first);
  await a.request('/api/auth/logout',{body:{}});
  await store.mutate((s)=>{s.accounts[id].createdAt=null;});
  const login=await a.request('/api/auth/login',{body:{username:'legacy_date',password}});
  assert.equal(login.data.account.createdAt,x.getTime());
  assert.equal((await fresh.read()).accounts[id].createdAt,x.getTime());
  x.setTime(x.getTime()+86400000);
  await a.request('/api/auth/logout',{body:{}});
  assert.equal((await a.request('/api/auth/login',{body:{username:'legacy_date',password}})).data.account.createdAt,login.data.account.createdAt);
});
