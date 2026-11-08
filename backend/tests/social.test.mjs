import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers.mjs";
async function connection(t) {
  const x = await setup(t),
    a = await x.owner(),
    b = await x.owner();
  for (const [o, name] of [
    [a, "Alice"],
    [b, "Bob"],
  ]) {
    await x.request("/api/social/profile", {
      token: o.ownerToken,
      method: "POST",
      body: {
        enabled: true,
        name,
        pointsLedger: [
          {
            id: "2026-11-08:cook",
            date: "2026-11-08",
            points: 30,
            reason: "Cooked from fridge",
          },
        ],
      },
    });
    await x.request("/api/context", {
      token: o.ownerToken,
      method: "POST",
      body: {
        inventory: [
          {
            id: "food",
            name: name === "Alice" ? "Avocado" : "Eggs",
            grams: 200,
            fridgeId: "my-fridge",
            ownerId: "me",
          },
        ],
        containers: [],
        appliedEventIds: [],
      },
    });
  }
  const invitation = (
    await x.request("/api/social/invite", {
      token: a.ownerToken,
      method: "POST",
    })
  ).data;
  const joined = await x.request("/api/social/join", {
    token: b.ownerToken,
    method: "POST",
    body: { code: invitation.code },
  });
  assert.equal(joined.status, 200);
  return { x, a, b, invitation };
}
test("friend invitations are single-use, mutual, and expose only the agreed fridge feed", async (t) => {
  const { x, a, b, invitation } = await connection(t);
  const view = (await x.request("/api/social", { token: a.ownerToken })).data;
  assert.equal(view.friends[0].name, "Bob");
  assert.equal(view.friends[0].inventory[0].name, "Eggs");
  assert.equal(view.friends[0].pointsLedger[0].points, 30);
  assert(!("ownerHash" in view.friends[0]));
  assert(!("events" in view.friends[0]));
  assert(!("weightKg" in view.friends[0]));
  assert.equal(
    (
      await x.request("/api/social/join", {
        token: b.ownerToken,
        method: "POST",
        body: { code: invitation.code },
      })
    ).status,
    400,
  );
  assert.equal((await x.request("/api/social")).status, 401);
  const c = await x.pair(a);
  assert.equal(
    (await x.request("/api/social", { token: c.cameraToken })).status,
    401,
  );
});
test("in-person requests reach the recipient, require recipient approval, and never move food", async (t) => {
  const { x, a, b } = await connection(t);
  const t1 = (
    await x.request("/api/social/trades", {
      token: a.ownerToken,
      method: "POST",
      body: { toId: b.sessionId, wantedId: "food" },
    })
  ).data;
  assert.equal(t1.offerName, "Free request");
  assert(!("wantedGrams" in t1));
  assert.equal(
    (
      await x.request("/api/social/respond", {
        token: a.ownerToken,
        method: "POST",
        body: { tradeId: t1.id, status: "accepted" },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await x.request("/api/social/respond", {
        token: b.ownerToken,
        method: "POST",
        body: { tradeId: t1.id, status: "accepted" },
      })
    ).status,
    200,
  );
  assert.equal(
    (await x.request("/api/session", { token: b.ownerToken })).data.context
      .inventory[0].grams,
    200,
  );
  assert.equal(
    (await x.request("/api/social", { token: a.ownerToken })).data.trades[0]
      .status,
    "accepted",
  );
});
test("pausing or removing a friend stops new inventory reads and trade requests", async (t) => {
  const { x, a, b } = await connection(t);
  await x.request("/api/social/profile", {
    token: b.ownerToken,
    method: "POST",
    body: { enabled: false, name: "Bob" },
  });
  assert.equal(
    (await x.request("/api/social", { token: a.ownerToken })).data.friends
      .length,
    0,
  );
  assert.equal(
    (
      await x.request("/api/social/trades", {
        token: a.ownerToken,
        method: "POST",
        body: { toId: b.sessionId, wantedId: "food" },
      })
    ).status,
    400,
  );
  await x.request("/api/social/remove", {
    token: a.ownerToken,
    method: "POST",
    body: { friendId: b.sessionId },
  });
  assert.equal(
    (await x.request("/api/social", { token: b.ownerToken })).data.friends
      .length,
    0,
  );
});
test("leaderboard input deduplicates date/challenge IDs and rejects arbitrary point amounts", async (t) => {
  const { x, a, b } = await connection(t);
  await x.request("/api/social/profile", {
    token: b.ownerToken,
    method: "POST",
    body: {
      enabled: true,
      name: "Bob",
      pointsLedger: [
        { id: "2026-11-08:cook", date: "2026-11-08", points: 30 },
        { id: "2026-11-08:cook", date: "2026-11-08", points: 30 },
        { id: "2026-11-08:fruit", date: "2026-11-08", points: 9999 },
      ],
    },
  });
  const view = (await x.request("/api/social", { token: a.ownerToken })).data;
  assert.equal(view.friends[0].pointsLedger.length, 1);
  assert.equal(view.friends[0].pointsLedger[0].points, 30);
});

test('friend chat persists both directions, validates prompts, and excludes other connections and cameras', async (t) => {
  const { x, a, b } = await connection(t), stranger = await x.owner();
  const send = (body, token = a.ownerToken) => x.request('/api/social/messages', { method: 'POST', token, body });
  const first = await send({ toId: b.sessionId, text: 'Shall we cook lentils?', clientId: 'message-test-001', kind: 'system' });
  assert.equal(first.status, 200);
  assert.equal(first.data.kind, 'text');
  assert.equal((await send({ toId: b.sessionId, text: 'Shall we cook lentils?', clientId: 'message-test-001' })).data.id, first.data.id);
  assert.equal((await send({ toId: b.sessionId, text: 'Changed', clientId: 'message-test-001' })).status, 400);
  const prompt = await send({ toId: a.sessionId, prompt: 'meal', text: 'Spoofed system text' }, b.ownerToken);
  assert.equal(prompt.status, 200);
  assert.equal(prompt.data.kind, 'system');
  assert.match(prompt.data.text, /Meal collab/);
  const av = (await x.request('/api/social', { token: a.ownerToken })).data;
  const bv = (await x.request('/api/social', { token: b.ownerToken })).data;
  assert.equal(av.messages.length, 2);
  assert.deepEqual(av.messages, bv.messages);
  assert.equal((await x.request('/api/social', { token: stranger.ownerToken })).data.messages.length, 0);
  assert.equal((await send({ toId: stranger.sessionId, text: 'Not a friend' })).status, 400);
  assert.equal((await send({ toId: b.sessionId, text: '   ' })).status, 400);
  assert.equal((await send({ toId: b.sessionId, text: 'a'.repeat(2001) })).status, 400);
  assert.equal((await send({ toId: b.sessionId, prompt: 'arbitrary' })).status, 400);
  const cam = await x.pair(a);
  assert.equal((await send({ toId: b.sessionId, text: 'Camera attack' }, cam.cameraToken)).status, 401);
  assert.equal((await x.request('/api/social/messages', { method: 'POST', body: { toId: b.sessionId, text: 'Anonymous' } })).status, 401);
  const stored = await x.app.store.read();
  assert.equal(stored.socialMessages.length, 2);
  await x.request('/api/social/profile', { token: b.ownerToken, method: 'POST', body: { enabled: false, name: 'Bob' } });
  assert.equal((await send({ toId: b.sessionId, text: 'Paused' })).status, 400);
  assert.equal((await x.request('/api/social', { token: b.ownerToken })).data.messages.length, 0);
  await x.request('/api/social/profile', { token: b.ownerToken, method: 'POST', body: { enabled: true, name: 'Bob' } });
  await x.request('/api/social/remove', { token: a.ownerToken, method: 'POST', body: { friendId: b.sessionId } });
  assert.equal((await send({ toId: b.sessionId, text: 'Removed' })).status, 400);
  assert.equal((await x.request('/api/social', { token: a.ownerToken })).data.messages.length, 0);
  assert.equal((await x.request('/api/social', { token: b.ownerToken })).data.messages.length, 0);
});

test('accounts connect by @tag without paired cameras and require recipient approval', async(t)=>{
  const x=await setup(t);
  async function person(username) {
    const r=await fetch(x.base+'/api/auth/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password:'friend-test-password'})});
    assert.equal(r.status,201);const cookie=r.headers.get('set-cookie').split(';')[0];
    const owner=(await x.request('/api/sessions',{method:'POST',headers:{Cookie:cookie},body:{fridgeName:username+"'s Fridge"}})).data;
    const req=(path,body)=>x.request(path,{token:owner.ownerToken,headers:{Cookie:cookie},method:body?'POST':'GET',body});
    await req('/api/social/profile',{enabled:true,name:username});
    return {owner,req};
  }
  const a=await person('alice_tag'),b=await person('bob_tag'),c=await person('charlie_tag');
  const sent=await a.req('/api/social/request-friend',{tag:'@BOB_TAG'});assert.equal(sent.status,200);
  assert.equal((await a.req('/api/social')).data.friends.length,0);
  assert.equal((await b.req('/api/social')).data.requests[0].id,sent.data.id);
  assert.equal((await c.req('/api/social')).data.requests.length,0);
  assert.equal((await c.req('/api/social/respond-friend',{requestId:sent.data.id,status:'accepted'})).status,400);
  assert.equal((await a.req('/api/social/respond-friend',{requestId:sent.data.id,status:'accepted'})).status,400);
  assert.equal((await a.req('/api/social/request-friend',{tag:'bob_tag'})).status,400);
  assert.equal((await b.req('/api/social/respond-friend',{requestId:sent.data.id,status:'accepted'})).status,200);
  assert.equal((await a.req('/api/social')).data.friends[0].id,b.owner.sessionId);
  assert.equal((await b.req('/api/social')).data.friends[0].id,a.owner.sessionId);
  assert.equal((await a.req('/api/social/messages',{toId:b.owner.sessionId,text:'Hello without cameras'})).status,200);
  assert.equal((await a.req('/api/social/request-friend',{tag:'@alice_tag'})).status,400);
  const declined=await c.req('/api/social/request-friend',{tag:'@alice_tag'});
  assert.equal((await a.req('/api/social/respond-friend',{requestId:declined.data.id,status:'declined'})).status,200);
  assert.equal((await c.req('/api/social')).data.friends.length,0);
  const stored=await x.app.store.read();assert(Object.values(stored.sessions).every((s)=>s.cameras.length===0));
});
