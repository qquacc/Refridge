export function applyInventoryOperations(inventory, operations) {
  let next = inventory.map((i) => ({ ...i }));
  for (const op of operations) {
    const at = next.findIndex((i) => i.id === op.itemId);
    if (op.kind === "add") {
      if (at >= 0) {
        if (next[at].cameraEventId === op.item.cameraEventId) continue;
        throw Error("Food ID conflict; review this event.");
      }
      next.push({ ...op.item });
      continue;
    }
    if (at < 0) throw Error("Tracked food is missing; review this event.");
    if (Math.abs(Number(next[at].grams) - op.expectedGrams) > 0.01)
      throw Error(
        "Food quantity changed since camera analysis; review before applying.",
      );
    next[at] = {
      ...next[at],
      grams: op.newGrams,
      estimated: true,
      estimateConfidence: op.confidence,
    };
  }
  return next;
}
export function buildAutomaticPlan(context, analysis, eventId, lookup) {
  const operations = [],
    review = [];
  if (
    !Array.isArray(analysis?.changes) ||
    typeof analysis.occluded !== "boolean" ||
    typeof analysis.uncertain !== "boolean"
  )
    return {
      operations: [],
      review: ["Invalid analysis needs manual review."],
    };
  if (analysis.occluded || analysis.uncertain)
    return { operations: [], review: ["Scene is blocked or ambiguous."] };
  for (const [cIndex, c] of analysis.changes.entries()) {
    if (
      !c ||
      !Number.isFinite(c.confidence) ||
      !Number.isFinite(c.directionConfidence) ||
      c.confidence < 0 ||
      c.confidence > 1 ||
      c.directionConfidence < 0 ||
      c.directionConfidence > 1
    ) {
      review.push("Invalid confidence values need review.");
      continue;
    }
    if (c.direction === "unchanged") continue;
    if (
      !["in", "out"].includes(c.direction) ||
      c.confidence < 0.92 ||
      c.directionConfidence < 0.95
    ) {
      review.push("Food or movement needs review.");
      continue;
    }
    if (c.foodName && (c.ingredients?.length || !c.foodId)) {
      review.push(`Prediction: ${c.foodName}. Confirm the dish, estimated ingredients, and amount before adding it.`);
      continue;
    }
    const known = context.inventory.find((i) => i.id === c.inventoryItemId);
    const reference = lookup(String(c.foodId));
    if (!reference) {
      review.push("No valid Canadian food reference was matched.");
      continue;
    }
    const container = context.containers.find((k) => k.id === c.containerId);
    let grams = null,
      method = c.massMethod;
    if (c.direction === "out" && c.wholeItem && known) grams = known.grams;
    else if (
      method === "container" &&
      container &&
      Number.isFinite(c.fillPercent) &&
      c.fillPercent >= 0 &&
      c.fillPercent <= 100
    ) {
      const density = Number(
        container.densityByFood?.[String(c.foodId)] ||
          reference.densityReference?.gPerMl,
      );
      const volume =
        container.shape === "Cylinder"
          ? Math.PI * (container.diameterCm / 2) ** 2 * container.heightCm
          : container.lengthCm * container.widthCm * container.heightCm;
      if (density > 0 && volume > 0) {
        const remaining = Math.round(
          ((volume * c.fillPercent) / 100) * density,
        );
        grams =
          c.direction === "out" && known
            ? Math.round(known.grams - remaining)
            : remaining;
      }
    } else if (method === "label" && c.wholeItem && Number.isFinite(c.grams))
      grams = Math.round(c.grams);
    if (!(grams > 0 && grams <= 100000)) {
      review.push(
        "Weight needs a readable whole-package label or a calibrated container and density.",
      );
      continue;
    }
    if (c.direction === "out") {
      if (
        !known ||
        String(known.cnfId) !== String(c.foodId) ||
        known.grams < grams
      ) {
        review.push(
          "Outgoing food does not match a unique tracked lot or quantity.",
        );
        continue;
      }
      operations.push({
        kind: "quantity",
        itemId: known.id,
        expectedGrams: known.grams,
        newGrams: Math.round((known.grams - grams) * 10) / 10,
        confidence: c.confidence,
        foodName: known.name,
        grams,
        direction: "out",
        food: known,
      });
    } else {
      if (c.inventoryItemId && known) {
        review.push("Possible duplicate or returned item needs review.");
        continue;
      }
      const ownerId = container?.ownerId || context.defaultOwnerId;
      if (!ownerId) {
        review.push("Food ownership is unknown.");
        continue;
      }
      if (
        container &&
        context.inventory.filter(
          (i) => i.containerId === container.id && i.grams > 0,
        ).length +
          operations.filter(
            (o) => o.kind === "add" && o.item.containerId === container.id,
          ).length >=
          (container.count || 1)
      ) {
        review.push("All containers of this type are already in use.");
        continue;
      }
      const item = {
        ...reference,
        id: `auto-${eventId}-${cIndex}`,
        fridgeId: context.fridgeId,
        ownerId,
        containerId: container?.id || "",
        grams,
        expires: /^\d{4}-\d{2}-\d{2}$/.test(c.expires || "") ? c.expires : null,
        expiryUnknown: !c.expires,
        estimated: true,
        estimateMethod: method,
        estimateConfidence: c.confidence,
        cameraEventId: eventId,
      };
      operations.push({
        kind: "add",
        itemId: item.id,
        item,
        confidence: c.confidence,
        grams,
        foodName: item.name,
        direction: "in",
      });
    }
  }
  // An ambiguous event is reviewed as one transaction; do not partly apply its other views.
  return review.length
    ? { operations: [], review }
    : { operations, review: [] };
}
