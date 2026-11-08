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
  const [direction, setDirection] = useState("in");
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
        confirmation: details,
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
          <strong>{event.analysis.state}</strong>
          <p>{event.analysis.summary}</p>
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
          Reference scene saved. Both views will be compared with the next
          settled capture.
        </p>
      ) : !done ? (
        <form className="feature-form" onSubmit={confirm}>
          <p className="form-hint">
            Both photos represent one event. Review food, ownership, movement,
            and quantity when automatic analysis needs review.
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
                <Field label="Confirm food">
                  <select name="foodName">
                    {catalog.map((c) => (
                      <option key={c.name}>{c.name}</option>
                    ))}
                  </select>
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
                  <select name="ownerId" key={fridgeId}>
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
                  label="Expiry date"
                  name="expires"
                  type="date"
                  required
                  defaultValue={daysFromNow(5)}
                />
              </div>
              <Field label="Reference container">
                <select name="containerId" key={fridgeId}>
                  <option value="">Original packaging / none</option>
                  {state.containers
                    .filter((c) => c.fridgeId === fridgeId)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </Field>
            </>
          )}
          {direction === "out" && (
            <>
              <Field label="Food leaving">
                <select name="itemId" required>
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
              defaultValue="100"
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
            disabled={busy || (direction !== "ignore" && !ready)}
            type="submit"
          >
            {busy
              ? "Saving…"
              : direction === "ignore"
                ? "Ignore event"
                : "Confirm and update inventory"}
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
    <div className="feature-page">
      <Banner>
        Real Wi-Fi image pairing. Run the included backend to connect phones;
        static hosting alone cannot receive images. Cameras stay open during
        capture. Automatic recognition requires a server-side vision API key;
        uncertain food or weight stays in this review inbox.
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
          subtitle="Pair two camera phones with this main phone."
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
            title="Automatic food tracking"
            subtitle="Compare before/after views, match Canadian food references, and update stock after conservative checks."
          >
            <p className="body-copy">
              {visionStatus?.keyConfigured
                ? "Vision provider configured · " + visionStatus.model
                : "Add OPENAI_API_KEY to the included Node server’s .env and restart it. No image analysis is available until a key is configured."}
            </p>
            <p className="form-hint">
              Container reference photos and inside dimensions help estimate
              portions. A readable package label or a food-specific density is
              required for automatic grams. Food ownership comes from the
              assigned container or the default owner of this session; faces are
              not identified.
            </p>
            {!session?.automation?.enabled ? (
              <div className="feature-form">
                <label className="inline-toggle">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  Send captured fridge photos and container reference photos to
                  the configured vision provider for analysis.
                </label>
                <label className="inline-toggle">
                  <input
                    type="checkbox"
                    checked={logRemovals}
                    onChange={(e) => setLogRemovals(e.target.checked)}
                  />
                  Also log my outgoing food as estimated intake. I understand
                  removal may mean moving or discarding food.
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
              The first complete capture becomes the reference scene. Start both
              cameras and leave motion capture enabled. Keep all phones
              foregrounded and connected to this server over Wi-Fi. Ambiguous
              scenes go to review; removing food does not automatically mean
              eating it.
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
                On another phone, use this deployment’s /camera/ address. Share
                only the temporary pairing code; it grants camera upload access.
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
