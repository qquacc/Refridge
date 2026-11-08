import React, { useState } from "react";
import { Panel, Field } from "./FeatureUI.jsx";
import { socialAction } from "../hooks/useFriendFridges.jsx";
export default function FriendSharing({ state, setState, navigate, notify }) {
  const [invite, setInvite] = useState(null),
    [code, setCode] = useState(""),
    [tag, setTag] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
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
  const enabled = !!state.socialSettings?.enabled;
  return (
    <Panel
      className="friend-sharing-panel"
      title="Connect friends & family"
      subtitle="Connect with a friend code or @username. No camera setup needed."
    >
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="body-copy">
        Sharing lets accepted friends see food in your shared fridge,
        your display name/photo, and challenge awards. Your weight, birthday,
        dietary notes, diary, and camera images stay outside this friend feed.
        Invitations are single-use and expire in 10 minutes.
      </p>
      <div className="button-row">

        <button
          className={"btn " + (enabled ? "outline" : "primary")}
          disabled={busy}
          onClick={() =>
            action(async () => {
              await socialAction("/profile", {
                enabled: !enabled,
                name: state.profile.name,
                avatar: state.profile.avatar,
                pointsLedger: state.pointsLedger,
              });
              setState((s) => ({
                ...s,
                socialSettings: { ...s.socialSettings, enabled: !enabled },
              }));
              notify(
                enabled ? "Fridge sharing paused" : "Fridge sharing enabled",
              );
            })
          }
        >
          {enabled ? "Pause friend sharing" : "Enable friend sharing"}
        </button>
      </div>
      {enabled && (
        <>
          {state.ownTag && <p className="body-copy">Your tag: <strong>@{state.ownTag}</strong></p>}
          <form className="feature-form inline-form friend-tag-form" onSubmit={(e) => { e.preventDefault(); action(async () => { await socialAction("/request-friend", { tag }); setTag(""); notify("Friend request sent — they can accept it in Kitchens"); }); }}>
            <Field label="Add by @username" placeholder="@username" value={tag} onChange={(e) => setTag(e.target.value)} required maxLength={25} />
            <button className="btn primary" disabled={busy}>Send friend request</button>
          </form>
          <div aria-label="Friend requests">{(state.friendRequests || []).filter((r) => r.status === "pending").map((r) => {
            const incoming = r.toId === state.ownSessionId;
            return <div className="fridge-row" key={r.id}><strong>{incoming ? r.fromName : r.toName}</strong><span>{incoming ? "Wants to connect" : "Request sent"}</span>{(incoming ? [["accepted", "Accept"], ["declined", "Decline"]] : [["cancelled", "Cancel request"]]).map(([status, label]) => <button key={status} className="text-btn" disabled={busy} onClick={() => action(async () => { await socialAction("/respond-friend", { requestId: r.id, status }); notify(status === "accepted" ? "Friend connected" : "Request updated"); })}>{label}</button>)}</div>;
          })}</div>
          <div className="feature-columns friend-code-options">
            <form
              className="feature-form"
              onSubmit={(e) => {
                e.preventDefault();
                action(async () => {
                  await socialAction("/join", { code });
                  setCode("");
                  notify("Friend connected. Their fridge will sync shortly.");
                });
              }}
            >
              <Field
                label="Friend invitation code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                minLength={8}
                maxLength={8}
                required
              />
              <button className="btn outline" disabled={busy}>
                Join friend
              </button>
            </form>
            <div>
              <h3 className="friend-invite-label">Invite someone</h3>
              <button
                className="btn outline"
                disabled={busy}
                onClick={() =>
                  action(async () => setInvite(await socialAction("/invite")))
                }
              >
                Create friend invitation
              </button>
              {invite && (
                <p className="pair-code">
                  {invite.code}
                  <small className="row-note">
                    Expires {new Date(invite.expiresAt).toLocaleTimeString()}
                  </small>
                </p>
              )}
            </div>
          </div>
          {state.fridges
            .filter((f) => f.remote)
            .map((f) => (
              <div className="fridge-row" key={f.id}>
                <strong>{f.name}</strong>
                <span>Connected friend</span>
                <button
                  className="text-btn"
                  onClick={() =>
                    action(async () => {
                      await socialAction("/remove", {
                        friendId: f.remoteSessionId,
                      });
                      notify("Friend disconnected");
                    })
                  }
                >
                  Disconnect
                </button>
              </div>
            ))}
        </>
      )}
      <p className="form-hint">
        Connect with people you know to plan meals, share ideas, and arrange
        food exchanges. Keep the app open to see their latest updates.
      </p>
    </Panel>
  );
}
