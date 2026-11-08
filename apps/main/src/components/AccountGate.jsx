import React, { useEffect, useState } from "react";
import { cameraApi, readSaved, saveDevice } from "../../../../packages/shared/camera-client.mjs";
import App from "../App.jsx";
import "../styles/accounts.css";
const OWNER = "fridgeful:camera-owner:v1";
export default function AccountGate() {
  const [session, setSession] = useState(null), [loading, setLoading] = useState(true);
  const [mode, setMode] = useState("signup"), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [importLocal, setImportLocal] = useState(false);
  const legacy = readSaved("fridgeful:v1");
  function enter(result) {
    const previous = readSaved(OWNER);
    if (previous?.ownerToken && !previous.ownerToken.startsWith("account:") && previous.sessionId !== result.cameraDevice?.sessionId) saveDevice("refridge:legacy-camera", previous);
    saveDevice(OWNER, result.cameraDevice);
    setSession({ ...result.account, appState: result.appState, revision: result.revision });
  }
  async function check() {
    setLoading(true); setError("");
    try { enter(await cameraApi("/api/auth/me")); }
    catch (e) { if (e.status !== 401) setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { check(); }, []);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError("");
    const fields = new FormData(event.currentTarget);
    try {
      const oldCamera = readSaved("refridge:legacy-camera") || readSaved(OWNER);
      let result = await cameraApi("/api/auth/" + mode, { method: "POST", body: {
        username: String(fields.get("username")), password: String(fields.get("password")),
        ...(mode === "signup" && importLocal && legacy ? { importState: legacy } : {}),
      } });
      if (mode === "signup" && importLocal && oldCamera?.ownerToken && !oldCamera.ownerToken.startsWith("account:")) {
        try { result = await cameraApi("/api/auth/claim-camera", { method: "POST", body: { ownerToken: oldCamera.ownerToken } }); saveDevice("refridge:legacy-camera", null); }
        catch (e) { setError("Account created, but the old camera pairing could not be imported. Log in to continue: " + e.message); setMode("login"); return; }
      }
      enter(result);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function logout() {
    await cameraApi("/api/auth/logout", { method: "POST", body: {} });
    saveDevice(OWNER, null);
    setSession(null); setMode("login"); setError("");
  }
  if (session) return <App key={session.id} account={session} onLogout={logout} />;
  return <main className="account-landing">
    <header className="account-header"><a href="/" className="account-brand"><img src="/fridge-mark.svg" alt="" width="42" height="46" />Refridge<span>.</span></a><span>A little less waste. A lot more good food.</span></header>
    <div className="account-layout">
      <section className="account-intro">
        <p className="eyebrow">MAKE ROOM FOR GOOD FOOD</p>
        <h1>Your fridge.<br />A little more together.</h1>
        <p>Know what’s fresh, turn what you have into a meal, and keep your kitchen in sync.</p>
        <div className="account-benefits"><p><strong>Keep track</strong><span>Your food, quantities, and nutrition in one place.</span></p><p><strong>Bring your cameras</strong><span>Connect a top and side view to your own fridge.</span></p><p><strong>Pick up anywhere</strong><span>Log in to restore your saved kitchen.</span></p></div>
      </section>
      <section className="account-card" aria-labelledby="account-title">
        {loading ? <><h2 id="account-title">Opening your kitchen…</h2><p role="status">Checking your sign-in.</p></> : <>
          <div className="account-tabs"><button type="button" aria-pressed={mode === "signup"} onClick={() => { setMode("signup"); setError(""); }}>Sign up</button><button type="button" aria-pressed={mode === "login"} onClick={() => { setMode("login"); setError(""); }}>Log in</button></div>
          <h2 id="account-title">{mode === "signup" ? "Make yourself at home." : "Welcome back."}</h2>
          <p>{mode === "signup" ? "Create an account to save your fridge." : "Your kitchen is right where you left it."}</p>
          <form onSubmit={submit}>
            <label>Username<input name="username" autoComplete="username" autoCapitalize="none" spellCheck="false" minLength={3} maxLength={24} pattern="[A-Za-z0-9_]{3,24}" required placeholder="your_username" /></label>
            <small>3–24 letters, numbers, or underscores.</small>
            <label>Password<input key={mode} name="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={10} maxLength={128} required placeholder={mode === "signup" ? "At least 10 characters" : "Your password"} /></label>
            {mode === "signup" && legacy && <label className="account-import"><input type="checkbox" checked={importLocal} onChange={(e) => setImportLocal(e.target.checked)} />Import this browser’s existing fridge and camera pairing into this account.</label>}
            <button className="account-submit" disabled={busy}>{busy ? "One moment…" : mode === "signup" ? "Create my account" : "Log in to Refridge"}</button>
          </form>
          <p className="account-note">Your profile and fridge are saved to your account. Camera photos stay with their connected fridge.</p>
        </>}
        {error && <><p className="account-error" role="alert">{error}</p><button type="button" className="text-btn" onClick={check}>Check connection again</button></>}
      </section>
    </div>
    <footer className="account-footer">Good food deserves a second look.</footer>
  </main>;
}
