import { socialAction } from "../hooks/useFriendFridges.jsx";
import React, { useState } from "react";
import { Panel, Field } from "../components/FeatureUI.jsx";
import { allInventory, memberName } from "../lib/domain.mjs";
import { createTradeRequest } from "../lib/planning.mjs";
import { daysLeft } from "../data/food.mjs";
import { foodFits } from "../../../../packages/shared/dietary.mjs";
export default function InventoryPage({
  state,
  setState,
  setModal,
  notify,
  navigate,
  community = false,
}) {
  const [query, setQuery] = useState("");
  const [inspectId, setInspectId] = useState(null);
  const inspection = React.useRef(null);
  React.useEffect(() => { if (inspectId) { inspection.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); inspection.current?.focus({ preventScroll: true }); } }, [inspectId]);
  const [selected, setSelected] = useState(null);
  const [offer, setOffer] = useState("");
  const [error, setError] = useState("");
  const all = allInventory(state);
  const visibleFridges = state.fridges.filter((f) => community || f.ownerId === "me");
  const activeId = community && inspectId && visibleFridges.some((f) => f.id === inspectId) ? inspectId : visibleFridges.some((f) => f.id === state.activeFridgeId) ? state.activeFridgeId : visibleFridges[0]?.id;
  const foods = all.filter(
    (i) =>
      i.fridgeId === activeId &&
      i.grams > 0 &&
      i.name.toLowerCase().includes(query.toLowerCase()),
  );
  const mine = all.filter((i) => i.ownerId === "me" && i.grams > 0);
  return (
    <div className="feature-page">
      {community && <div className="kitchens-heading"><p>Friends, shared fridges, and exchanges in one place.</p><button className="btn outline" onClick={() => navigate("challenges")}>This Week’s Leaderboard ↗</button></div>}
      {community && state.sampleAccount && <p className="notice">Demo connections: Allen and Ava are sample friends. Trade requests are saved locally to this account; no messages are sent.</p>}
      {community && <>
      <Panel
        title="Your fridges"
        subtitle="Your fridge and connected friends, together in one place."
      >
        {state.fridges.filter((f) => f.ownerId === "me" && !f.remote).map((f) => (
          <div className="fridge-row" key={f.id}>
            <strong>{f.name}</strong>
            <small>
              {f.remote
                ? "Connected friend"
                : f.ownerId === "me"
                  ? "Your fridge"
                  : "Local sample friend"}
            </small>
            <button className="btn outline" onClick={() => { setState((s) => ({ ...s, activeFridgeId: f.id })); navigate("home"); }}>View my fridge <span aria-hidden="true">↗</span></button>
            <label className="inline-toggle">
              <input
                type="checkbox"
                checked={f.shared}
                onChange={(e) =>
                  setState((s) => ({
                    ...s,
                    fridges: s.fridges.map((x) =>
                      x.id === f.id ? { ...x, shared: e.target.checked } : x,
                    ),
                  }))
                }
              />
              Include in shared meals
            </label>
          </div>
        ))}
      <h3 className="connected-fridges-heading">Friends’ fridges</h3>
        {state.fridges.filter((f) => f.remote || f.ownerId !== "me").map((f) => <div className="fridge-row" key={f.id}>
          <div><strong>{f.name}</strong><small className="row-note">{f.remote ? "Connected friend" : "Sample connection"} · {all.filter((i) => i.fridgeId === f.id && i.grams > 0).length} foods</small></div>
          <button className="btn outline" onClick={() => { setInspectId(f.id); setSelected(null); setState((s) => ({ ...s, activeFridgeId: f.id })); }}>Open fridge <span aria-hidden="true">↗</span></button>
          <label className="inline-toggle"><input type="checkbox" checked={!!f.shared} onChange={(e) => setState((s) => ({ ...s, fridges: s.fridges.map((x) => x.id === f.id ? { ...x, shared: e.target.checked } : x) }))} />Include in shared meals</label>
        </div>)}
        {!state.fridges.some((f) => f.remote || f.ownerId !== "me") && <p className="body-copy">No connections yet. Use the Connect tab to add someone by code or @username.</p>}
      </Panel>
      </>}
      {(!community || inspectId) && <>
      {community && <div className="kitchens-heading" ref={inspection} tabIndex={-1}><h2>{state.fridges.find((f) => f.id === activeId)?.name}</h2><button className="text-btn" onClick={() => { setInspectId(null); setSelected(null); }}>Close fridge</button></div>}
      <div className="inventory-toolbar">
        <Field label="Fridge">
          <select
            value={activeId || ""}
            onChange={(e) => {
              setSelected(null);
              setState((s) => ({ ...s, activeFridgeId: e.target.value }));
            }}
          >
            {visibleFridges.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </Field>
        {!community && <Field
          label="Find food"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search this fridge"
        />}
        <button
          className="btn outline"
          disabled={
            state.fridges.find((f) => f.id === activeId)?.ownerId !== "me"
          }
          onClick={() => { setState((s) => ({ ...s, activeFridgeId: activeId })); setModal({ type: "add" }); }}
        >
          Add or correct food
        </button>
      </div>
      <div className="editorial-food-grid">
        {foods.map((i) => {
          const d = daysLeft(i.expires),
            fits = foodFits(i, state.profile);
          return (
            <article
              key={i.id}
              className={"editorial-food " + (!fits.safe ? "restricted" : "")}
            >
              <button
                className="food-tile-main"
                onClick={() => {
                  setSelected(selected?.id === i.id ? null : i);
                  setError("");
                }}
              >
                <span className="food-tile-art">{i.emoji}</span>
                <span className="eyebrow">{memberName(state, i.ownerId)}</span>
                <strong>{i.name}</strong>
                <span>
                  {Math.round(i.grams)} g{i.estimated ? " · estimated" : ""}
                </span>
                <small>
                  {!i.expires
                    ? "Expiry unknown"
                    : d < 0
                      ? "Past date"
                      : d === 0
                        ? "Use today"
                        : `${d} day${d === 1 ? "" : "s"} left`}
                </small>
                {!fits.safe && (
                  <span className="restriction-label">
                    Restricted: {fits.reasons.join(", ")}
                  </span>
                )}
              </button>
              <div className="tile-actions">
                <button
                  onClick={() =>
                    i.remote
                      ? setSelected(i)
                      : setModal({ type: "edit", food: i })
                  }
                >
                  Details
                </button>
                {["me", "shared"].includes(i.ownerId) ? (
                  <button
                    onClick={() => setModal({ type: "consume", food: i })}
                  >
                    Log eaten
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setSelected(i);
                      setError("");
                    }}
                  >
                    Request trade
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {!foods.length && (
        <div className="empty">No matching food in this fridge.</div>
      )}
      {selected && (
        <Panel
          title={selected.name}
          subtitle={`${Math.round(selected.grams)} g · ${memberName(state, selected.ownerId)}`}
          action={
            <button className="text-btn" onClick={() => setSelected(null)}>
              Close
            </button>
          }
        >
          <p className="body-copy">
            Canadian reference: {selected.description || "Custom food"}.{" "}
            {selected.nutritionSource?.publisher || "Manual nutrition values"} ·
            food ID {selected.cnfId || "not available"}.
          </p>
          {selected.nutritionSource?.url && (
            <a
              className="text-btn"
              href={selected.nutritionSource.url}
              target="_blank"
              rel="noreferrer"
            >
              Open nutrition source ↗
            </a>
          )}
          {selected.ownerId !== "me" && (
            <div className="feature-form">
              <h3>Arrange an in-person exchange</h3>
              <p className="form-hint">
                Request it for free, or offer something from your fridge.
                Discuss amounts in person; accepting does not automatically move
                stock.
              </p>
              {error && <div className="error">{error}</div>}
              <Field label="Your offer">
                <select
                  value={offer}
                  onChange={(e) => setOffer(e.target.value)}
                >
                  <option value="">Ask for free</option>
                  {mine.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
              </Field>
              <button
                className="btn primary"
                onClick={async () => {
                  try {
                    if (selected.remote) {
                      await socialAction("/trades", {
                        toId: selected.remoteSessionId,
                        wantedId: selected.remoteItemId,
                        offeredId: offer || null,
                      });
                      notify("Trade request sent to your friend");
                      setSelected(null);
                      return;
                    }
                    setState((s) =>
                      createTradeRequest(s, {
                        wantedId: selected.id,
                        offeredId: offer,
                      }),
                    );
                    notify("Local trade request recorded");
                    setSelected(null);
                  } catch (e) {
                    setError(e.message);
                  }
                }}
              >
                Request exchange
              </button>
            </div>
          )}
        </Panel>
      )}
      </>}
      {community && <>
      <Panel
        title="Trade requests"
        subtitle="Connected requests sync through your server. Local sample requests are labelled below. Quantities are discussed in person."
      >
        {(state.remoteTrades || []).map((t) => (
          <article className="trade-line" key={t.id}>
            <div>
              <strong>{t.wantName}</strong>
              <small>
                {t.fromName} → {t.toName} · {t.offerName} · {t.status}
              </small>
            </div>
            {t.status === "pending" &&
              (t.toId === state.ownSessionId ? (
                <>
                  <button
                    className="text-btn"
                    onClick={async () => {
                      try {
                        await socialAction("/respond", {
                          tradeId: t.id,
                          status: "accepted",
                        });
                        notify(
                          "Trade accepted; arrange your exchange in person",
                        );
                      } catch (e) {
                        notify(e.message);
                      }
                    }}
                  >
                    Accept request
                  </button>
                  <button
                    className="text-btn"
                    onClick={async () => {
                      try {
                        await socialAction("/respond", {
                          tradeId: t.id,
                          status: "declined",
                        });
                        notify("Request declined");
                      } catch (e) {
                        notify(e.message);
                      }
                    }}
                  >
                    Decline
                  </button>
                </>
              ) : (
                <button
                  className="text-btn"
                  onClick={async () => {
                    try {
                      await socialAction("/respond", {
                        tradeId: t.id,
                        status: "cancelled",
                      });
                      notify("Request cancelled");
                    } catch (e) {
                      notify(e.message);
                    }
                  }}
                >
                  Cancel request
                </button>
              ))}
          </article>
        ))}
        {state.trades
          .filter((t) => t.type === "in-person")
          .map((t) => (
            <article className="trade-line" key={t.id}>
              <div>
                <strong>{t.wantName}</strong>
                <small>
                  Local sample · {t.offerName} · {memberName(state, t.toId)} ·{" "}
                  {t.status}
                </small>
              </div>
              {t.status === "pending" && (
                <>
                  <button
                    className="text-btn"
                    onClick={() =>
                      setState((s) => ({
                        ...s,
                        trades: s.trades.map((x) =>
                          x.id === t.id ? { ...x, status: "accepted" } : x,
                        ),
                      }))
                    }
                  >
                    Record agreement
                  </button>
                  <button
                    className="text-btn"
                    onClick={() =>
                      setState((s) => ({
                        ...s,
                        trades: s.trades.map((x) =>
                          x.id === t.id ? { ...x, status: "cancelled" } : x,
                        ),
                      }))
                    }
                  >
                    Cancel
                  </button>
                </>
              )}
            </article>
          ))}
        {!state.trades.some((t) => t.type === "in-person") && (
          <p className="body-copy">
            Open food in another fridge to request a free item or propose a
            trade.
          </p>
        )}
      </Panel>
      </>}
    </div>
  );
}
