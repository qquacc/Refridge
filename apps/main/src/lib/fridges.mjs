export function combineOwnFridges(state) {
  const own = state.fridges.filter((f) => f.ownerId === "me" && !f.remote);
  if (own.length < 2) return state;
  const primary = own.find((f) => f.id === "my-fridge") || own[0];
  const ids = new Set(own.map((f) => f.id));
  const remap = (id) => ids.has(id) ? primary.id : id;
  const food = (i) => ({ ...i, fridgeId: remap(i.fridgeId) });
  const moved = state.friendItems.filter((i) => ids.has(i.fridgeId));
  return { ...state,
    fridges: state.fridges.filter((f) => !ids.has(f.id) || f.id === primary.id).map((f) => f.id === primary.id ? { ...f, members: [...new Set(own.flatMap((x) => x.members))] } : f),
    activeFridgeId: remap(state.activeFridgeId),
    items: [...state.items.map(food), ...moved.map(food)],
    friendItems: state.friendItems.filter((i) => !ids.has(i.fridgeId)),
    containers: (state.containers || []).map(food),
    dinners: (state.dinners || []).map((d) => ({ ...d, fridgeIds: [...new Set((d.fridgeIds || []).map(remap))] })),
  };
}
