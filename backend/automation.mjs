import { enrichFoodPredictions } from "./predictions.mjs";
import { randomUUID } from "node:crypto";
import { analyzeWithVision } from "./vision.mjs";
import {
  buildAutomaticPlan,
  applyInventoryOperations,
} from "../packages/shared/auto-inventory.mjs";
import { loadNutrition, canadianFood } from "./nutrition.mjs";
export function createAutomation({
  store,
  images,
  vision = analyzeWithVision,
  keyConfigured = () => !!process.env.GEMINI_API_KEY,
}) {
  const running = new Set();
  async function processEvent(sessionId, eventId, { force = false } = {}) {
    const key = sessionId;
    if (running.has(key)) return;
    running.add(key);
    const leaseToken = randomUUID();
    let leased = false;
    try {
      leased = await store.mutate((state) => {
        const s = state.sessions[sessionId],
          e = s?.events.find((e) => e.id === eventId);
        if (
          !s?.automation?.enabled ||
          !e ||
          e.status !== "pending" ||
          e.images.length < e.expectedCameraIds.length ||
          (!force && e.analysis && e.analysis.state !== "processing") ||
          s.analysisLease?.until > Date.now()
        )
          return false;
        s.analysisLease = {
          token: leaseToken,
          // Outlast the 240-second provider request plus image/database work.
          until: Date.now() + 270000,
          eventId,
        };
        return true;
      });
      if (!leased) return;
      const state = await store.read(),
        s = state.sessions[sessionId],
        event = s?.events.find((e) => e.id === eventId);
      if (
        !s?.automation?.enabled ||
        !event ||
        event.status !== "pending" ||
        (!force && event.analysis && event.analysis.state !== "processing") ||
        event.images.length < event.expectedCameraIds.length
      )
        return;
      if (s.baselineAt && event.createdAt < s.baselineAt) {
        await store.mutate((state) => {
          const e = state.sessions[sessionId]?.events.find(
            (e) => e.id === eventId,
          );
          if (e)
            e.analysis = {
              state: "needs-review",
              summary:
                "This capture is older than the current reference scene. Review it manually.",
            };
        });
        return;
      }
      if (event.expectedCameraIds.length !== 2) {
        await store.mutate((state) => {
          const e = state.sessions[sessionId]?.events.find(
            (e) => e.id === eventId,
          );
          if (e)
            e.analysis = {
              state: "needs-review",
              summary:
                "Bring both cameras online and capture a new complete reference/event for automatic analysis.",
            };
        });
        return;
      }
      if (!keyConfigured()) throw Error("Vision API key is not configured.");
      if (!s.context?.inventory)
        throw Error(
          "Sync the fridge and container context before enabling automation.",
        );
      if (!s.baseline?.length || event.trigger === "baseline") {
        await store.mutate((state) => {
          const current = state.sessions[sessionId],
            e = current?.events.find((e) => e.id === eventId);
          if (!current || !e || current.analysisLease?.token !== leaseToken)
            return;
          current.baseline = e.images;
          current.baselineAt = e.createdAt;
          e.status = "baseline";
          e.analysis = {
            state: "baseline",
            summary:
              "Reference scene saved. Subsequent captures compare against this scene.",
          };
        });
        return;
      }
      // Do not assign roles to existing generic cameras by guessing their placement.
      for (const images of [s.baseline, event.images]) {
        const names = images.map((p) => s.cameras.find((c) => c.id === p.cameraId)?.name);
        if (names.length !== 2 || !names.includes("Top Camera") || !names.includes("Side Camera"))
          throw Error("Pair one Top Camera and one Side Camera, then save a new reference scene. Remove and re-pair cameras with old names.");
      }
      const revision = s.context.revision || 0;
      await store.mutate((state) => {
        const e = state.sessions[sessionId]?.events.find(
          (e) => e.id === eventId,
        );
        if (e)
          e.analysis = {
            state: "processing",
            summary: "Predicting food and likely ingredients…",
          };
      });
      const photos = async (list) =>
        Promise.all(
          list.map(async (p) => ({
            cameraId: p.cameraId,
            cameraName: s.cameras.find((c) => c.id === p.cameraId)?.name,
            bytes: await images.get(p.id),
          })),
        );
      const analysis = await vision({
        before: await photos(s.baseline),
        after: await photos(event.images),
        context: s.context,
      });
      await loadNutrition();
      await enrichFoodPredictions(analysis, s.context.inventory);
      const plan = buildAutomaticPlan(
        s.context,
        analysis,
        eventId,
        canadianFood,
      );
      await store.mutate((state) => {
        const current = state.sessions[sessionId],
          e = current?.events.find((e) => e.id === eventId);
        if (
          !current ||
          !e ||
          e.status !== "pending" ||
          current.analysisLease?.token !== leaseToken
        )
          return;
        if (!current.automation?.enabled) {
          e.analysis = {
            state: "needs-review",
            summary:
              "Automatic tracking was paused during analysis. Review this event manually.",
          };
          return;
        }
        if ((current.context.revision || 0) !== revision) {
          e.analysis = {
            state: "needs-review",
            summary:
              "Inventory changed during analysis. Review or retry this event.",
            raw: analysis,
          };
          return;
        }
        if (plan.review.length) {
          e.analysis = {
            state: "needs-review",
            summary: plan.review.join(" "),
            raw: analysis,
          };
          return;
        }
        current.context.inventory = applyInventoryOperations(
          current.context.inventory,
          plan.operations,
        );
        current.context.revision = revision + 1;
        current.baseline = e.images;
        current.baselineAt = e.createdAt;
        e.analysis = {
          state: "applied",
          summary: analysis.summary,
          operations: plan.operations,
          model: process.env.VISION_MODEL || "gemini-3.8-flash",
          source: "Health Canada CNF 2015",
        };
        e.status = plan.operations.length ? "confirmed" : "ignored";
        e.confirmation = {
          direction: "automation",
          operations: plan.operations,
          estimatedConsumption: !!current.automation.logRemovalsAsIntake,
        };
        e.confirmedAt = Date.now();
      });
    } catch (err) {
      await store
        .mutate((state) => {
          const e = state.sessions[sessionId]?.events.find(
            (e) => e.id === eventId,
          );
          if (
            e &&
            e.status === "pending" &&
            state.sessions[sessionId]?.analysisLease?.token === leaseToken
          )
            e.analysis = { state: "needs-review", summary: err.message };
        })
        .catch(() => {});
    } finally {
      running.delete(key);
      if (leased)
        await store
          .mutate((state) => {
            const s = state.sessions[sessionId];
            if (s?.analysisLease?.token === leaseToken) delete s.analysisLease;
          })
          .catch(() => {});
    }
  }
  return { processEvent, keyConfigured };
}
