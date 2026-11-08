import { buildPredictedFood } from "../../../../packages/shared/predicted-food.mjs";
import React, { useState, useEffect } from "react";
import QRCode from "qrcode";
import {
  cameraApi,
  imageBlob,
  readSaved,
  saveDevice,
} from "../../../../packages/shared/camera-client.mjs";
import { Panel, Field, Banner } from "../components/FeatureUI.jsx";
import { catalog, daysFromNow } from "../data/food.mjs";
import { allInventory } from "../lib/domain.mjs";
import { applyCameraEvent } from "../lib/camera-events.mjs";
const KEY = "fridgeful:camera-owner:v1";
function ProtectedImage({ record, token }) {
  const [src, setSrc] = useState("");
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true,
      objectUrl;
    const controller = new AbortController();
    imageBlob(record.id, token, controller.signal)
      .then((blob) => {
        if (active) {
          objectUrl = URL.createObjectURL(blob);
          setSrc(objectUrl);
        }
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [record.id, record.receivedAt, token]);
  return (
    <figure className="paired-image">
      {src ? (
        <img src={src} alt={"Fridge view from " + record.cameraName} />
      ) : (
        <div>{error ? "Image unavailable" : "Loading view…"}</div>
      )}
      <figcaption>
        {record.cameraName} · {new Date(record.receivedAt).toLocaleTimeString()}
      </figcaption>
    </figure>
  );
}
function CaptureEvent({
  event,
  session,
  device,
  state,
  setState,
  notify,
  refresh,
}) {
  const changes = event.analysis?.raw?.changes || [];
  const predictionSignature = JSON.stringify(changes);
  const [direction, setDirection] = useState("in");
  const [predictionIndex, setPredictionIndex] = useState(-1);
  const [ingredients, setIngredients] = useState([]);
  const [referenceId, setReferenceId] = useState("");
  const [draftGrams, setDraftGrams] = useState("100");
  const [nutritionMethod, setNutritionMethod] = useState("reference");
  const prediction = predictionIndex >= 0 ? changes[predictionIndex] : null;
  useEffect(() => {
    setPredictionIndex(changes.findIndex((c) => c.foodName && c.direction !== "out"));
    const outgoing = changes.find((c) => c.direction === "out");
    if (outgoing) {
      setDirection("out");
      setDraftGrams(String(outgoing.grams > 0 ? outgoing.grams : 100));
    }
  }, [predictionSignature]);
  useEffect(() => {
    if (!prediction) return;
    setIngredients((prediction.ingredients || []).map((i) => ({ ...i })));
    setReferenceId(prediction.nutritionReferences?.[0]?.cnfId || "");
    setNutritionMethod("reference");
    setDraftGrams(String(prediction.grams > 0 ? prediction.grams : 100));
    setDirection(prediction.direction === "out" ? "out" : "in");
  }, [predictionIndex, predictionSignature]);
  let draftFood = null, draftError = "";
  if (prediction) {
    try { draftFood = buildPredictedFood({ name: prediction.foodName, ingredients, reference: prediction.nutritionReferences?.find((f) => f.cnfId === referenceId), method: nutritionMethod }); }
    catch (error) { draftError = error.message; }
  }
  const [fridgeId, setFridgeId] = useState(session.fridgeId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [partial, setPartial] = useState(false);
  const latestState = React.useRef(state);
  latestState.current = state;
  const applied = (state.appliedCameraEventIds || []).includes(event.id);
  const done = event.status !== "pending";
  const fridge =
    state.fridges.find((f) => f.id === fridgeId) || state.fridges[0];
  const ownFood = allInventory(state).filter(
    (i) => i.grams > 0 && ["me", "shared"].includes(i.ownerId),
  );
  const ready =
    event.images.length > 0 &&
    (event.images.length >= event.expectedCameraIds.length || partial);
  async function confirm(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const details =
      direction === "in"
        ? {
            direction,
            foodName: String(f.get("foodName")),
            grams: Number(f.get("grams")),
            fridgeId,
            ownerId: String(f.get("ownerId")),
            expires: String(f.get("expires")),
            containerId: String(f.get("containerId") || ""),
            ...(prediction ? { prediction: {
              index: predictionIndex, method: nutritionMethod, referenceId,
              ingredients: ingredients.map((i) => ({ name: i.name, estimatedPercent: i.estimatedPercent, cnfId: i.reference?.cnfId || "" })),
            } } : {}),
          }
        : direction === "out"
          ? {
              direction,
              grams: Number(f.get("grams")),
              itemId: String(f.get("itemId")),
              action: String(f.get("action")),
            }
          : { direction: "ignore" };
    setBusy(true);
    setError("");
    try {
      applyCameraEvent(state, {
        ...event,
        status: direction === "ignore" ? "ignored" : "confirmed",
        confirmation: prediction && direction === "in" ? { ...details, food: draftFood } : details,
      });
      const confirmed = await cameraApi(
        "/api/events/" + event.id + "/confirm",
        { token: device.ownerToken, method: "POST", body: details },
      );
      setState(applyCameraEvent(latestState.current, confirmed));
      notify(
        direction === "ignore"
          ? "Camera event ignored"
          : "Camera event applied to inventory once",
      );
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  function reapply() {
    try {
      setState(applyCameraEvent(state, event));
      notify("Confirmed event applied on this device");
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <article className="capture-event">
      <div className="section-heading">
        <div>
          <h3>
            {event.trigger === "main-phone"
              ? "Requested from main phone"
              : event.trigger === "motion"
                ? "Movement detected"
                : "Camera capture"}
          </h3>
          <p>
            {new Date(event.createdAt).toLocaleString()} · {event.images.length}
            /{event.expectedCameraIds.length} views received
          </p>
        </div>
        <span className="status-pill">
          {applied ? "Applied here" : event.status}
        </span>
      </div>
      <div className="paired-images">
        {event.images.map((i) => (
          <ProtectedImage key={i.id} record={i} token={device.ownerToken} />
        ))}
        {!event.images.length && (
          <div className="empty">
            Waiting for the camera phones. Keep both camera pages open with
            their cameras running.
          </div>
        )}
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {event.analysis && (
        <div className="camera-analysis" role="status">
          <strong>{event.analysis.state === "needs-review" && changes.some((c) => c.foodName && c.direction !== "out") ? "Ready to review and add" : event.analysis.state}</strong>
          <p>{event.analysis.summary}</p>
          {event.analysis.raw?.changes?.filter((c) => c.foodName && c.direction !== "out").map((c, i) => (
            <div key={i} className="notice">
              <strong>Food prediction: {c.foodName}</strong>
              {Number.isFinite(c.grams) && c.grams > 0 && <p>Estimated amount: {Math.round(c.grams)} g · verify before saving</p>}
              {c.ingredients?.length > 0 && <>
                <p>Estimated ingredients — confirm the recipe:</p>
                <ul>{c.ingredients.map((ingredient, j) => (
                  <li key={j}>{ingredient.name}{ingredient.estimatedPercent != null ? ` · about ${ingredient.estimatedPercent}% by weight` : " · amount unknown"}</li>
                ))}</ul>
                <p>Photo estimates may miss hidden ingredients. Do not use this list to check allergens.</p>
              </>}
              {c.nutritionSuggestions?.length > 0 && <p>Possible Canadian nutrition references: {c.nutritionSuggestions.map((f) => f.name).join("; ")}. Suggested matches only.</p>}
            </div>
          ))}
          {changes.filter((c) => c.direction === "out").map((c, i) => (
            <div key={`out-${i}`} className="notice">
              <strong>Food came out: {ownFood.find((item) => item.id === c.inventoryItemId)?.name || c.foodName || "Select the tracked food below"}</strong>
              {Number.isFinite(c.grams) && c.grams > 0 && <p>Amount removed: {Math.round(c.grams)} g · verify before confirming</p>}
              <p>Uses the tracked food’s saved nutrition. No new dish or ingredients are predicted.</p>
            </div>
          ))}
          {event.analysis.operations?.map((o, i) => (
            <p key={i}>
              {o.direction === "in" ? "+" : "−"} {o.grams} g {o.foodName} ·
              estimated
            </p>
          ))}
          {event.analysis.state === "needs-review" &&
            session.automation?.enabled && (
              <button
                className="text-btn"
                onClick={async () => {
                  try {
                    await cameraApi("/api/events/" + event.id + "/analyze", {
                      token: device.ownerToken,
                      method: "POST",
                    });
                    await refresh();
                  } catch (e) {
                    setError(e.message);
                  }
                }}
              >
                Retry automatic analysis
              </button>
            )}
        </div>
      )}
      {event.status === "baseline" ? (
        <p className="form-hint">
          Starting photos saved. Your next photos will help spot what changed.
        </p>
      ) : !done ? (
        <form className="feature-form" onSubmit={confirm}>
          <p className="form-hint">
            {direction === "out" ? "Confirm the tracked food, amount removed, and reason below." : "Review the prefilled details below, then confirm to update your fridge. Estimated expiry dates and nutrition can be adjusted."}
          </p>
          <Field label="What happened?">
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
            >
              <option value="in">Food went in</option>
              <option value="out">Food came out</option>
              <option value="ignore">Ignore this event</option>
            </select>
          </Field>
          {direction === "in" && (
            <>
              <div className="form-grid">
                <Field label="Food to add">
                  <select value={predictionIndex} onChange={(e) => setPredictionIndex(Number(e.target.value))}>
                    <option value={-1}>Choose from the food catalog</option>
                    {changes.map((c, i) => c.foodName && c.direction !== "out" ? <option key={i} value={i}>{c.foodName} · camera prediction</option> : null)}
                  </select>
                </Field>
                <Field label="Confirm food name">
                  {prediction ? <input name="foodName" key={`name-${predictionIndex}-${predictionSignature}`} defaultValue={prediction.foodName} maxLength={80} required /> :
                    <select name="foodName">{catalog.map((c) => <option key={c.name}>{c.name}</option>)}</select>}
                </Field>
                <Field label="Storage space">
                  <select
                    value={fridgeId}
                    onChange={(e) => setFridgeId(e.target.value)}
                  >
                    {state.fridges
                      .filter((f) => !f.remote)
                      .map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Food owner">
                  <select name="ownerId" key={fridgeId} defaultValue={session.context?.defaultOwnerId || "me"}>
                    {fridge.members.map((id) => (
                      <option key={id} value={id}>
                        {id === "me"
                          ? state.profile.name
                          : state.members.find((m) => m.id === id)?.name}
                      </option>
                    ))}
                    <option value="shared">Household shared</option>
                  </select>
                </Field>
                <Field
                  label="Suggested expiry date · adjust for this food"
                  name="expires"
                  type="date"
                  required
                  defaultValue={daysFromNow(5)}
                />
              </div>

            </>
          )}
          {direction === "in" && prediction && <div className="notice">
            <strong>Review estimated nutrition</strong>
            <Field label="Nutrition calculation">
              <select value={nutritionMethod} onChange={(e) => setNutritionMethod(e.target.value)}>
                <option value="reference">Similar dish from Canadian nutrition data</option>
                <option value="ingredients">Calculate from the estimated ingredients</option>
              </select>
            </Field>
            {nutritionMethod === "reference" && <Field label="Approximate dish reference">
              <select value={referenceId} onChange={(e) => setReferenceId(e.target.value)}>
                <option value="">No match · keep nutrition unknown</option>
                {(prediction.nutritionReferences || []).map((f) => <option key={f.cnfId} value={f.cnfId}>{f.name}</option>)}
              </select>
            </Field>}
            {ingredients.map((ingredient, index) => <div className="form-grid" key={index}>
              <Field label="Estimated ingredient"><input value={ingredient.name} maxLength={100} required onChange={(e) => setIngredients((all) => all.map((i, n) => n === index ? { ...i, name: e.target.value, reference: null } : i))} /></Field>
              <Field label="Weight share (%)"><input type="number" min="0.1" max="100" step="0.1" value={ingredient.estimatedPercent ?? ""} onChange={(e) => setIngredients((all) => all.map((i, n) => n === index ? { ...i, estimatedPercent: e.target.value === "" ? null : Number(e.target.value) } : i))} /></Field>
              <button type="button" className="text-btn" disabled={busy} onClick={async () => {
                try {
                  const matches = await cameraApi("/api/nutrition/search?q=" + encodeURIComponent(ingredient.name));
                  setIngredients((all) => all.map((i, n) => n === index ? { ...i, references: matches, reference: matches[0] || null } : i));
                  if (!matches.length) setError("No nutrition reference matched that ingredient. Try a simpler ingredient name, or leave its nutrition unknown.");
                  else setError("");
                } catch (error) { setError(error.message); }
              }}>Find ingredient reference</button>
              <Field label="Ingredient nutrition reference"><select value={ingredient.reference?.cnfId || ""} onChange={(e) => setIngredients((all) => all.map((i, n) => n === index ? { ...i, reference: i.references?.find((f) => f.cnfId === e.target.value) || null } : i))}>
                <option value="">Unknown</option>
                {(ingredient.references || (ingredient.reference ? [ingredient.reference] : [])).map((f) => <option key={f.cnfId} value={f.cnfId}>{f.name}</option>)}
              </select></Field>
            </div>)}
            <p>Ingredient shares: {Math.round(ingredients.reduce((n, i) => n + (i.estimatedPercent || 0), 0) * 10) / 10}%. Ingredient calculation requires all matches and a total of 100%.</p>
            {draftError && <p role="alert">{draftError}</p>}
            {draftFood && <p>Per 100 g: {[["kcal", "kcal"], ["protein", "g protein"], ["carbs", "g carbs"], ["fat", "g fat"], ["fiber", "g fibre"]].map(([key, unit]) => `${Number.isFinite(draftFood[key]) ? Math.round(draftFood[key] * 10) / 10 : "unknown"} ${unit}`).join(" · ")}</p>}
            {draftFood && Number(draftGrams) > 0 && <p>For {draftGrams} g: {[["kcal", "kcal"], ["protein", "g protein"], ["carbs", "g carbs"], ["fat", "g fat"]].map(([key, unit]) => `${Number.isFinite(draftFood[key]) ? Math.round(draftFood[key] * Number(draftGrams) / 100 * 10) / 10 : "unknown"} ${unit}`).join(" · ")}</p>}
            <p>These are estimates. Unknown nutrients stay unknown. Confirming adds one dish to your fridge; its ingredient list does not create extra stock.</p>
          </div>}
          {direction === "out" && (
            <>
              <Field label="Food leaving">
                <select name="itemId" key={predictionSignature} defaultValue={changes.find((c) => c.direction === "out")?.inventoryItemId || ""} required>
                  <option value="">Select your or shared food</option>
                  {ownFood.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} · {i.grams} g
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Reason">
                <select name="action">
                  <option value="eaten">Eaten — log my intake</option>
                  <option value="moved">Moved — stock only</option>
                  <option value="discarded">Discarded — stock only</option>
                </select>
              </Field>
            </>
          )}
          {direction !== "ignore" && (
            <Field
              label="Confirmed quantity (g)"
              name="grams"
              type="number"
              min="0.1"
              max="100000"
              step="0.1"
              required
              value={draftGrams}
              onChange={(e) => setDraftGrams(e.target.value)}
            />
          )}
          {event.images.length < event.expectedCameraIds.length &&
            event.images.length > 0 && (
              <label className="inline-toggle">
                <input
                  type="checkbox"
                  checked={partial}
                  onChange={(e) => setPartial(e.target.checked)}
                />
                Review using the available view; the other camera hasn’t
                uploaded.
              </label>
            )}
          <button
            className="btn primary"
            disabled={busy || (direction !== "ignore" && !ready) || (direction === "in" && !!prediction && !!draftError)}
            type="submit"
          >
            {busy
              ? "Saving…"
              : direction === "ignore"
                ? "Ignore event"
                : prediction && direction === "in" ? "Confirm and add dish to my fridge" : "Confirm and update inventory"}
          </button>
        </form>
      ) : (
        <div className="camera-event-result">
          <p>
            {event.confirmation?.direction === "ignore"
              ? "Ignored; no food changed."
              : event.confirmation?.direction === "automation"
                ? "Automatic inventory update · estimated quantities. Review food details to correct them."
                : `${event.confirmation?.direction === "in" ? "Incoming" : "Outgoing"} · ${event.confirmation?.grams} g${event.confirmation?.foodName ? " " + event.confirmation.foodName : ""}`}
          </p>
          {!applied && (
            <button className="btn outline" onClick={reapply}>
              Apply confirmed event on this device
            </button>
          )}
        </div>
      )}
      <button
        className="text-btn"
        disabled={busy}
        onClick={async () => {
          try {
            await cameraApi("/api/events/" + event.id, {
              token: device.ownerToken,
              method: "DELETE",
            });
            await refresh();
          } catch (e) {
            setError(e.message);
          }
        }}
      >
        Delete event and its photos
      </button>
    </article>
  );
}
export default function CamerasPage({ state, setState, notify }) {
  const [device, setDevice] = useState(() => readSaved(KEY));
  const [session, setSession] = useState(null);
  const [visionStatus, setVisionStatus] = useState(null);
  const [consent, setConsent] = useState(false);
  const [logRemovals, setLogRemovals] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pair, setPair] = useState(null);
  const [qr, setQr] = useState("");
  const [time, setTime] = useState(Date.now());
  const [fridgeId, setFridgeId] = useState(
    state.fridges.find((f) => f.id === state.activeFridgeId && !f.remote)?.id ||
      state.fridges.find((f) => !f.remote && f.ownerId === "me")?.id,
  );
  const companionBase = location.origin + "/camera/";
  const pairUrl = pair
    ? companionBase + "?pair=" + encodeURIComponent(pair.code)
    : "";
  async function refresh() {
    if (!device) return;
    const value = await cameraApi("/api/session", { token: device.ownerToken });
    setSession(value);
  }
  useEffect(() => {
    if (!device) return;
    let active = true,
      timer;
    async function poll() {
      try {
        const s = await cameraApi("/api/session", { token: device.ownerToken });
        if (active) {
          setSession(s);
          const status = await cameraApi("/api/automation/status", {
            token: device.ownerToken,
          });
          if (active) setVisionStatus(status);
          setError("");
        }
      } catch (e) {
        if (active) setError(e.message);
      } finally {
        if (active) timer = setTimeout(poll, 2500);
      }
    }
    poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [device]);
  useEffect(() => {
    if (!pair) {
      setQr("");
      return;
    }
    let active = true;
    QRCode.toDataURL(pairUrl, {
      margin: 1,
      width: 220,
      color: { dark: "#285c43", light: "#ffffff" },
    }).then((url) => {
      if (active) setQr(url);
    });
    const timer = setInterval(() => setTime(Date.now()), 1000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [pairUrl]);
  useEffect(() => {
    if (
      pair &&
      session &&
      session.cameras.filter((c) => !c.revoked).length > pair.pairedCount
    )
      setPair(null);
  }, [session, pair]);
  async function action(fn) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function connect() {
    const fridge = state.fridges.find((f) => f.id === fridgeId);
    const d = await cameraApi("/api/sessions", {
      method: "POST",
      body: { fridgeId, fridgeName: fridge.name },
    });
    saveDevice(KEY, d);
    setDevice(d);
  }
  async function configureAutomation(enabled) {
    if (enabled) {
      const latest = await cameraApi("/api/session", {
        token: device.ownerToken,
      });
      const unapplied = latest.events.some(
        (e) =>
          e.confirmation?.direction === "automation" &&
          !state.appliedCameraEventIds?.includes(e.id),
      );
      if (unapplied)
        throw Error(
          "Wait for pending inventory updates to sync, then try again.",
        );
      await cameraApi("/api/context", {
        token: device.ownerToken,
        method: "POST",
        body: {
          inventory: allInventory(state).filter(
            (i) => i.fridgeId === latest.fridgeId,
          ),
          containers: state.containers.filter(
            (c) => c.fridgeId === latest.fridgeId,
          ),
          appliedEventIds: state.appliedCameraEventIds || [],
          defaultOwnerId:
            state.fridges.find((f) => f.id === latest.fridgeId)?.ownerId ||
            "me",
        },
      });
    }
    await cameraApi("/api/automation", {
      token: device.ownerToken,
      method: "POST",
      body: { enabled, consent, logRemovalsAsIntake: logRemovals },
    });
    await refresh();
    notify(
      enabled
        ? "Automatic recognition enabled"
        : "Automatic recognition paused",
    );
  }
  return (
    <div className="feature-page scan-page">
      <Banner>
        Give each camera a clear view of your food and keep both phones open.
        Review suggested changes here before adding or removing anything from your fridge.
      </Banner>
      {error && (
        <div className="error" role="alert">
          {error}{" "}
          <small>
            Check that the shared server is running and all apps use its HTTPS
            origin.
          </small>
        </div>
      )}
      {!device ? (
        <Panel
          title="Bring your fridge into focus"
          subtitle="Pair one Top Camera for food identity and one Side Camera for volume and amount."
        >
          <div className="feature-form">
            <Field label="Fridge to connect">
              <select
                value={fridgeId}
                onChange={(e) => setFridgeId(e.target.value)}
              >
                {state.fridges
                  .filter((f) => !f.remote)
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
              </select>
            </Field>
            <button
              className="btn primary"
              disabled={busy}
              onClick={() => action(connect)}
            >
              {busy ? "Connecting…" : "Create camera session"}
            </button>
          </div>
        </Panel>
      ) : (
        <>
          <Panel
            className="automatic-tracking-panel"
            title="Automatic food tracking"
            subtitle="Spot food coming and going, then review changes to your fridge."
          >
            <p className="body-copy">
              {visionStatus?.keyConfigured
                ? "Photo recognition is ready."
                : "Photo recognition isn’t set up yet. You can still add and update food manually."}
            </p>
            <p className="form-hint">
              Check the food, amount, and owner before saving. You can correct any estimate.
            </p>
            <p>Use one Top Camera to identify food and one Side Camera to estimate the amount. Keep both phones open with a clear view.</p>
            {!session?.automation?.enabled ? (
              <div className="feature-form">
                <label className="inline-toggle">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  Allow Gemini to analyze photos from my fridge cameras.
                </label>
                <label className="inline-toggle">
                  <input
                    type="checkbox"
                    checked={logRemovals}
                    onChange={(e) => setLogRemovals(e.target.checked)}
                  />
                  Automatically log removed food as eaten. Leave this off if food may be moved or thrown away.
                </label>
                <button
                  className="btn primary"
                  disabled={busy || !consent || !visionStatus?.keyConfigured}
                  onClick={() => action(() => configureAutomation(true))}
                >
                  Enable automatic tracking
                </button>
              </div>
            ) : (
              <div className="button-row">
                <span className="status-pill">Automatic tracking enabled</span>
                <button
                  className="btn outline"
                  onClick={() => action(() => configureAutomation(false))}
                >
                  Pause analysis
                </button>
                <button
                  className="btn outline"
                  disabled={busy || !session?.cameras.some((c) => c.online)}
                  onClick={() =>
                    action(async () => {
                      await cameraApi("/api/capture", {
                        token: device.ownerToken,
                        method: "POST",
                        body: { baseline: true },
                      });
                      await refresh();
                      notify("New baseline requested from online cameras");
                    })
                  }
                >
                  Capture reference scene
                </button>
              </div>
            )}
            <p className="form-hint">
              Start both cameras and keep their screens open. Take clear starting photos,
              then let the cameras watch for changes. When food leaves the fridge,
              you can choose whether it was eaten, moved, or discarded.
            </p>
          </Panel>
          <div className="feature-columns">
            <Panel
              title={session?.fridgeName || "Your camera session"}
              subtitle="Two independent views. One reviewable event."
            >
              <div className="camera-device-list">
                {session?.cameras
                  .filter((c) => !c.revoked)
                  .map((c) => (
                    <div key={c.id}>
                      <span
                        className={
                          "connection-dot " + (c.online ? "online" : "")
                        }
                      />
                      <div>
                        <strong>{c.name}</strong>
                        <small>
                          {c.online
                            ? "Camera running"
                            : "Offline / camera stopped"}
                        </small>
                      </div>
                      <button
                        className="text-btn"
                        onClick={() =>
                          action(async () => {
                            await cameraApi("/api/cameras/" + c.id, {
                              token: device.ownerToken,
                              method: "DELETE",
                            });
                            await refresh();
                          })
                        }
                      >
                        Unpair
                      </button>
                    </div>
                  ))}
                {!session?.cameras.some((c) => !c.revoked) && (
                  <p className="body-copy">
                    No phones paired yet. Create a code, then open Camera
                    Companion on each camera phone.
                  </p>
                )}
              </div>
              <div className="button-row">
                <button
                  className="btn primary"
                  disabled={
                    busy ||
                    (session?.cameras.filter((c) => !c.revoked).length || 0) >=
                      2
                  }
                  onClick={() =>
                    action(async () => {
                      const p = await cameraApi("/api/pairing", {
                        token: device.ownerToken,
                        method: "POST",
                      });
                      setPair({
                        ...p,
                        pairedCount:
                          session?.cameras.filter((c) => !c.revoked).length ||
                          0,
                      });
                      setTime(Date.now());
                    })
                  }
                >
                  Pair a camera
                </button>
                <button
                  className="btn outline"
                  disabled={busy || !session?.cameras.some((c) => c.online)}
                  onClick={() =>
                    action(async () => {
                      await cameraApi("/api/capture", {
                        token: device.ownerToken,
                        method: "POST",
                        body: {},
                      });
                      await refresh();
                      notify("Capture requested from both online cameras");
                    })
                  }
                >
                  Capture both views
                </button>
              </div>
              <p className="form-hint">
                A code is single-use and expires after 2 minutes. Generate a new
                code for the second phone.
              </p>
              <button
                className="text-btn"
                onClick={() =>
                  action(async () => {
                    await cameraApi("/api/session", {
                      token: device.ownerToken,
                      method: "DELETE",
                    });
                    saveDevice(KEY, null);
                    setDevice(null);
                    setSession(null);
                    setPair(null);
                  })
                }
              >
                Close session, unpair cameras, and delete photos
              </button>
            </Panel>
            <Panel
              title="Camera Companion"
              subtitle="A separate installable app for the two camera phones."
            >
              {pair && pair.expiresAt > time ? (
                <div className="pairing-panel">
                  {qr && (
                    <img src={qr} alt="QR code to pair Camera Companion" />
                  )}
                  <strong className="pair-code">{pair.code}</strong>
                  <p>
                    Expires in{" "}
                    {Math.max(0, Math.ceil((pair.expiresAt - time) / 1000))}{" "}
                    seconds
                  </p>
                  <p className="form-hint">
                    Scan this code with the other phone’s system camera, or
                    enter the code in Camera Companion.
                  </p>
                  <a
                    className="text-btn"
                    href={pairUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open pairing link
                  </a>
                </div>
              ) : (
                <div className="empty">
                  Create a pairing code to connect a camera phone.
                </div>
              )}
              <a
                className="btn outline"
                href={companionBase}
                target="_blank"
                rel="noreferrer"
              >
                Open Camera Companion
              </a>
              <p className="form-hint">
                Open Camera Companion on the phone you want to connect, then enter
                your temporary pairing code. Keep the code private.
              </p>
            </Panel>
          </div>
          <Panel
            title="Fridge capture inbox"
            subtitle="Review one event once; two camera angles never create two food entries."
          >
            {session?.events.length ? (
              session.events.map((event) => (
                <CaptureEvent
                  key={event.id}
                  event={event}
                  session={session}
                  device={device}
                  state={state}
                  setState={setState}
                  notify={notify}
                  refresh={refresh}
                />
              ))
            ) : (
              <div className="empty">
                Pair both phones, start their cameras, then request a capture.
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
