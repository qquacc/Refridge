export function visibleInventory(state, { includeFriends = false, fridgeId = null, query = "" } = {}) {
  const ids = new Set(state.fridges.filter((f) => fridgeId ? f.id === fridgeId : includeFriends || (f.ownerId === "me" && !f.remote)).map((f) => f.id));
  return [...state.items, ...state.friendItems].filter((i) => ids.has(i.fridgeId) && i.grams > 0 && i.name.toLowerCase().includes(query.trim().toLowerCase()));
}
