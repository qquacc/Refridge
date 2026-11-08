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
