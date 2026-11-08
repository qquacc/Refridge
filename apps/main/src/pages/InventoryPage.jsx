import FriendSharing from "../components/FriendSharing.jsx";
import { socialAction } from "../hooks/useFriendFridges.jsx";
import React, { useState } from "react";
import { Panel, Field } from "../components/FeatureUI.jsx";
import { allInventory, memberName } from "../lib/domain.mjs";
import { createTradeRequest } from "../lib/planning.mjs";
import { daysLeft, uid } from "../data/food.mjs";
import { foodFits } from "../../../../packages/shared/dietary.mjs";
export default function InventoryPage({
  state,
  setState,
  setModal,
  notify,
  navigate,
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [offer, setOffer] = useState("");
  const [error, setError] = useState("");
  const all = allInventory(state);
  const foods = all.filter(
    (i) =>
      i.fridgeId === state.activeFridgeId &&
      i.grams > 0 &&
      i.name.toLowerCase().includes(query.toLowerCase()),
  );
  const mine = all.filter((i) => i.ownerId === "me" && i.grams > 0);
  return (
    <div className="feature-page">
      <div className="inventory-toolbar">
        <Field label="Fridge">
          <select
            value={state.activeFridgeId}
            onChange={(e) => {
              setSelected(null);
              setState((s) => ({ ...s, activeFridgeId: e.target.value }));
            }}
          >
            {state.fridges.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Find food"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search this fridge"
        />
        <button
          className="btn outline"
          disabled={
            state.fridges.find((f) => f.id === state.activeFridgeId)?.remote
          }
          onClick={() => setModal({ type: "add" })}
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
      <FriendSharing
        state={state}
        setState={setState}
        notify={notify}
        navigate={navigate}
      />
      <Panel
        title="Your fridges"
        subtitle="Add a fridge or manage sharing for combined meal planning."
      >
        {state.fridges.map((f) => (
          <div className="fridge-row" key={f.id}>
            <strong>{f.name}</strong>
            <small>
              {f.remote
                ? "Connected friend"
                : f.ownerId === "me"
                  ? "Your fridge"
                  : "Local sample friend"}
            </small>
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
        <form
          className="add-grocery"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget),
              name = String(f.get("name")).trim();
            if (name)
              setState((s) => ({
                ...s,
                fridges: [
                  ...s.fridges,
                  {
                    id: uid(),
                    name,
                    kind: "Fridge",
                    ownerId: "me",
                    members: ["me"],
                    shared: true,
                  },
                ],
              }));
            e.currentTarget.reset();
          }}
        >
          <input
            name="name"
            required
            placeholder="New fridge name"
            aria-label="New fridge name"
          />
          <button className="btn outline">Add fridge</button>
        </form>
      </Panel>
    </div>
  );
}
