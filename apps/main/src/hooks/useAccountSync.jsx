import { useCallback, useEffect, useRef, useState } from "react";
import { cameraApi } from "../../../../packages/shared/camera-client.mjs";
export const accountStorageKey = (id) => "refridge:account:" + id;
export function loadAccountSnapshot(account) {
  try {
    const cached = JSON.parse(localStorage.getItem(accountStorageKey(account.id)));
    if (cached?.dirty && cached.revision === account.revision && cached.state?.items) return cached.state;
  } catch {}
  return account.appState;
}
export function useAccountSync(account, state) {
  const version = useRef(account.revision), latest = useRef(state), active = useRef(true);
  const saved = useRef(JSON.stringify(account.appState)), queue = useRef(Promise.resolve());
  const blocked = useRef(false);
  const [status, setStatus] = useState("Saved to your account");
  const [error, setError] = useState("");
  latest.current = state;
  const flush = useCallback(() => {
    const run = async () => {
      if (!active.current) return;
      if (blocked.current) throw Error("Cloud save paused because another device saved changes. Reload to reconnect; your local backup is preserved.");
      const snapshot = latest.current, digest = JSON.stringify(snapshot);
      if (digest === saved.current) return;
      setStatus("Saving…");
      try {
        const result = await cameraApi("/api/account/state", { method: "POST", body: { accountId: account.id, revision: version.current, appState: snapshot } });
        version.current = result.revision; saved.current = digest;
        try { localStorage.setItem(accountStorageKey(account.id), JSON.stringify({ state: latest.current, revision: version.current, dirty: JSON.stringify(latest.current) !== digest })); } catch {}
        if (active.current) { setError(""); setStatus("Saved to your account"); }
      } catch (e) {
        if (e.status === 409 || e.status === 403 || e.status === 401) {
          blocked.current = true;
          try { localStorage.setItem("refridge:unsaved:" + account.id, JSON.stringify({ state: latest.current, revision: version.current, savedAt: Date.now() })); } catch {}
        }
        if (active.current) { setError(e.message); setStatus("Changes are not saved online"); }
        throw e;
      }
    };
    const job = queue.current.catch(() => {}).then(run);
    queue.current = job;
    return job;
  }, [account.id]);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  useEffect(() => {
    try { localStorage.setItem(accountStorageKey(account.id), JSON.stringify({ state, revision: version.current, dirty: JSON.stringify(state) !== saved.current })); }
    catch { setError("Browser storage is full. Keep this page open until your account save finishes."); }
    const timer = setTimeout(() => { flush().catch(() => {}); }, 800);
    return () => clearTimeout(timer);
  }, [account.id, state, flush]);
  useEffect(() => {
    const warn = (event) => { if (JSON.stringify(latest.current) !== saved.current) { event.preventDefault(); event.returnValue = ""; } };
    const save = () => { if (document.visibilityState === "hidden") flush().catch(() => {}); };
    window.addEventListener("beforeunload", warn); document.addEventListener("visibilitychange", save);
    return () => { window.removeEventListener("beforeunload", warn); document.removeEventListener("visibilitychange", save); };
  }, [flush]);
  return { status, error, flush };
}
