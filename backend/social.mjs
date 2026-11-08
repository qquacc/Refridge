import { createHash, randomBytes, randomUUID } from "node:crypto";
const hash = (v) => createHash("sha256").update(v).digest("hex");
const publicProfile = (s) => ({
  id: s.id,
  name: s.social?.profile?.name || s.fridgeName,
  avatar: s.social?.profile?.avatar || "",
});
export function socialView(state, s) {
  const friends = (s.social?.friendIds || [])
    .map((id) => state.sessions[id])
    .filter(
      (other) =>
        other?.social?.enabled && (other.social.friendIds || []).includes(s.id),
    );
  return {
    messages: s.social?.enabled ? (state.socialMessages || []).filter((m) =>
      (m.fromId === s.id && friends.some((f) => f.id === m.toId)) ||
      (m.toId === s.id && friends.some((f) => f.id === m.fromId))) : [],
    enabled: !!s.social?.enabled,
    friends: friends.map((other) => ({
      ...publicProfile(other),
      fridgeName: other.fridgeName,
      inventory: other.context?.inventory || [],
      pointsLedger: other.social?.pointsLedger || [],
    })),
    trades: (state.socialTrades || [])
      .filter((t) => t.fromId === s.id || t.toId === s.id)
      .map((t) => ({
        ...t,
        fromName: state.sessions[t.fromId]?.social?.profile?.name || "Friend",
        toName: state.sessions[t.toId]?.social?.profile?.name || "Friend",
      })),
  };
}
export function updateSocial(s, input) {
  s.social ||= { friendIds: [] };
  s.social.enabled = !!input.enabled;
  const avatar =
    typeof input.avatar === "string" &&
    input.avatar.length < 150000 &&
    /^data:image\/(jpeg|png|webp);base64,/.test(input.avatar)
      ? input.avatar
      : "";
  s.social.profile = {
    name: String(input.name || "Friend")
      .trim()
      .slice(0, 50),
    avatar,
  };
  const rewards = {
    cook: 30,
    plants: 20,
    plan: 15,
    fruit: 15,
    legumes: 20,
    explore: 20,
  };
  const valid = new Map();
  for (const p of (input.pointsLedger || []).slice(0, 15000)) {
    const id = String(p.id || ""),
      [date, challenge] = id.split(":");
    if (
      /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      p.date === date &&
      rewards[challenge] === p.points
    )
      valid.set(id, {
        id,
        date,
        points: p.points,
        userId: s.id,
        reason: String(p.reason || "Food challenge").slice(0, 100),
      });
  }
  s.social.pointsLedger = [...valid.values()];
  return { enabled: s.social.enabled };
}
export function inviteFriend(s, now) {
  if (!s.social?.enabled)
    throw Error("Enable sharing before creating an invitation.");
  const code = randomBytes(4).toString("hex").toUpperCase();
  s.social.invite = { hash: hash(code), expiresAt: now + 600000 };
  return { code, expiresAt: s.social.invite.expiresAt };
}
export function joinFriend(state, s, code, now) {
  const other = Object.values(state.sessions).find(
    (o) =>
      o.id !== s.id &&
      o.social?.enabled &&
      o.social.invite?.hash === hash(String(code).trim().toUpperCase()) &&
      o.social.invite.expiresAt > now,
  );
  if (!s.social?.enabled)
    throw Error("Enable sharing before joining a friend.");
  if (!other) throw Error("Invitation is invalid, used, or expired.");
  s.social.friendIds = [...new Set([...(s.social.friendIds || []), other.id])];
  other.social.friendIds = [
    ...new Set([...(other.social.friendIds || []), s.id]),
  ];
  delete other.social.invite;
  return { friend: publicProfile(other) };
}
export function removeFriend(state, s, id) {
  s.social.friendIds = (s.social.friendIds || []).filter((x) => x !== id);
  const other = state.sessions[id];
  if (other?.social)
    other.social.friendIds = (other.social.friendIds || []).filter(
      (x) => x !== s.id,
    );
  for (const t of state.socialTrades || [])
    if (
      t.status === "pending" &&
      [t.fromId, t.toId].includes(s.id) &&
      [t.fromId, t.toId].includes(id)
    )
      t.status = "cancelled";
  return { removed: true };
}
export function requestSocialTrade(state, s, input, now) {
  const other = state.sessions[input.toId];
  if (
    !s.social?.enabled ||
    !other?.social?.enabled ||
    !(s.social.friendIds || []).includes(other.id) ||
    !(other.social.friendIds || []).includes(s.id)
  )
    throw Error("Choose a connected, sharing friend.");
  const wanted = other.context?.inventory?.find(
    (i) => i.id === input.wantedId && i.grams > 0,
  );
  const offered = input.offeredId
    ? s.context?.inventory?.find(
        (i) =>
          i.id === input.offeredId &&
          i.grams > 0 &&
          ["me", "shared"].includes(i.ownerId),
      )
    : null;
  if (!wanted || (input.offeredId && !offered))
    throw Error("The requested or offered food is no longer available.");
  const trade = {
    id: randomUUID(),
    type: "in-person",
    fromId: s.id,
    toId: other.id,
    wantedId: wanted.id,
    offeredId: offered?.id || null,
    wantName: wanted.name,
    offerName: offered?.name || "Free request",
    status: "pending",
    created: new Date(now).toISOString().slice(0, 10),
  };
  (state.socialTrades ||= []).unshift(trade);
  return trade;
}
export function respondSocialTrade(state, s, id, status) {
  const t = state.socialTrades?.find((t) => t.id === id);
  if (!t || t.status !== "pending")
    throw Error("This request is no longer pending.");
  if (
    status === "cancelled"
      ? t.fromId !== s.id
      : !["accepted", "declined"].includes(status) || t.toId !== s.id
  )
    throw Error(
      "Only the recipient can accept or decline; only the sender can cancel.",
    );
  t.status = status;
  return t;
}

const chatPrompts = {
  meal: "Meal collab · What should we cook together?",
  competition: "Friendly competition · Ready for a food-saving challenge?",
};
export function sendFriendMessage(state, s, input, now) {
  const other = state.sessions[input.toId];
  if (!s.social?.enabled || !other?.social?.enabled ||
      !(s.social.friendIds || []).includes(other.id) || !(other.social.friendIds || []).includes(s.id))
    throw Error("Messages are only available between accepted, sharing connections.");
  const prompt = input.prompt == null ? null : input.prompt;
  if (prompt !== null && !Object.hasOwn(chatPrompts, prompt)) throw Error("Choose a meal collab or friendly competition prompt.");
  const text = prompt ? chatPrompts[prompt] : typeof input.text === "string" ? input.text.trim() : "";
  if (!text || text.length > 2000) throw Error("Write a message of 1–2000 characters.");
  const clientId = typeof input.clientId === "string" && /^[a-zA-Z0-9_-]{8,80}$/.test(input.clientId) ? input.clientId : null;
  const messages = state.socialMessages ||= [];
  const existing = clientId && messages.find((m) => m.fromId === s.id && m.clientId === clientId);
  if (existing) {
    if (existing.toId !== other.id || existing.text !== text || existing.prompt !== prompt) throw Error("Message identifier already used.");
    return existing;
  }
  if (messages.filter((m) => m.fromId === s.id && Date.parse(m.createdAt) > now - 60000).length >= 30) throw Error("Please wait a moment before sending more messages.");
  if (messages.filter((m) => (m.fromId === s.id && m.toId === other.id) || (m.toId === s.id && m.fromId === other.id)).length >= 1000) throw Error("This conversation has reached its message limit.");
  const message = { id: randomUUID(), fromId: s.id, toId: other.id, kind: prompt ? "system" : "text", prompt, text, createdAt: new Date(now).toISOString(), clientId };
  messages.push(message);
  return message;
}
