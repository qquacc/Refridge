import React, { useState } from "react";
import { Panel, Field } from "./FeatureUI.jsx";
import { socialAction } from "../hooks/useFriendFridges.jsx";
export default function FriendSharing({ state, setState, navigate, notify }) {
  const [invite, setInvite] = useState(null),
    [code, setCode] = useState(""),
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
      title="Connect friends & family"
      subtitle="Both people use the same running server. Each main app has its own device account and camera session."
    >
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="body-copy">
        Sharing lets accepted friends see food in your camera-connected fridge,
        your display name/photo, and challenge awards. Your weight, birthday,
        dietary notes, diary, and camera images stay outside this friend feed.
        Invitations are single-use and expire in 10 minutes.
      </p>
      <div className="button-row">
        <button className="btn outline" onClick={() => navigate("cameras")}>
          Server & camera session
        </button>
        <button
          className="btn primary"
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
          <div className="feature-columns">
            <div>
              <h3>Invite someone</h3>
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
        The backend persists device identities and accepted connections. There
        is no email/password recovery. Friend data refreshes while the main app
        is open; push notifications are not configured.
      </p>
    </Panel>
  );
}
