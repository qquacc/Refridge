import React, { useState, useEffect, useRef, useCallback } from "react";
import { createRoot } from "react-dom/client";
import {
  cameraApi,
  readSaved,
  saveDevice,
} from "../../../packages/shared/camera-client.mjs";
import "./styles.css";
const KEY = "fridgeful:camera-device:v1";
function CameraApp() {
  const [device, setDevice] = useState(() => readSaved(KEY));
  const [code, setCode] = useState(
    () => new URLSearchParams(location.search).get("pair") || "",
  );
  const [name, setName] = useState(
    () => ["Top Camera", "Side Camera"].includes(readSaved(KEY)?.cameraName)
      ? readSaved(KEY).cameraName : "Top Camera",
  );
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Ready to pair");
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const [motion, setMotion] = useState(true);
  const [sensitivity, setSensitivity] = useState(18);
  const [lastShot, setLastShot] = useState(null);
  const [shots, setShots] = useState(0);
  const [hidden, setHidden] = useState(document.hidden);
  const videoRef = useRef(null),
    streamRef = useRef(null),
    wakeRef = useRef(null),
    busyRef = useRef(false),
    sent = useRef(new Set()),
    motionTime = useRef(0),
    deviceRef = useRef(device),
    previous = useRef(null);
  deviceRef.current = device;
  useEffect(() => {
    if (!code) return;
    history.replaceState({}, "", location.pathname);
  }, []);
  useEffect(() => {
    const onVisibility = () => {
      setHidden(document.hidden);
      if (document.hidden) setStatus("Capture paused while the page is hidden");
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      wakeRef.current?.release().catch(() => {});
    };
  }, []);
  async function pair(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await cameraApi("/api/pair", {
        method: "POST",
        body: { code, name },
      });
      saveDevice(KEY, result);
      setDevice(result);
      setCode("");
      setStatus("Paired with " + result.fridgeName);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function start() {
    setError("");
    setBusy(true);
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
        throw Error(
          "Camera access requires HTTPS. Open the trusted HTTPS deployment, not an http:// LAN address.",
        );
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      previous.current = null;
      setRunning(true);
      setStatus("Camera is live · connecting");
      if (navigator.wakeLock)
        try {
          wakeRef.current = await navigator.wakeLock.request("screen");
        } catch {}
    } catch (e) {
      setError(
        e.name === "NotAllowedError"
          ? "Camera permission was denied. Allow camera access and try again."
          : e.message,
      );
    } finally {
      setBusy(false);
    }
  }
  async function stop() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setRunning(false);
    setMotion(false);
    setStatus("Camera stopped");
    await wakeRef.current?.release().catch(() => {});
    if (deviceRef.current)
      cameraApi("/api/camera/heartbeat", {
        method: "POST",
        token: deviceRef.current.cameraToken,
        body: { ready: false },
      }).catch(() => {});
  }
  async function jpeg() {
    const video = videoRef.current;
    if (!video?.videoWidth || video.readyState < 2)
      throw Error("Camera is still warming up. Try again.");
    const canvas = document.createElement("canvas");
    canvas.width = Math.min(video.videoWidth, 960);
    canvas.height = Math.round(
      (canvas.width * video.videoHeight) / video.videoWidth,
    );
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(Error("Could not capture this image.")),
        "image/jpeg",
        0.7,
      ),
    );
  }
  const upload = useCallback(async (eventId) => {
    if (
      busyRef.current ||
      sent.current.has(eventId) ||
      !streamRef.current ||
      document.hidden
    )
      return;
    busyRef.current = true;
    setError("");
    try {
      const image = await jpeg();
      if (image.size > 1024 * 1024)
        throw Error("Photo is too large; reduce camera resolution.");
      await cameraApi("/api/events/" + eventId + "/image", {
        method: "POST",
        token: deviceRef.current.cameraToken,
        body: image,
        raw: true,
      });
      sent.current.add(eventId);
      setShots((n) => n + 1);
      setLastShot(new Date());
      setStatus("Photo sent · waiting for the next event");
    } catch (e) {
      setError(e.message);
    } finally {
      busyRef.current = false;
    }
  }, []);
  useEffect(() => {
    if (!device || !running || hidden) return;
    let active = true,
      timer;
    async function heartbeat() {
      try {
        const result = await cameraApi("/api/camera/heartbeat", {
          token: device.cameraToken,
          method: "POST",
          body: { ready: true },
        });
        if (active) {
          setStatus((s) =>
            s.startsWith("Photo sent") ? s : "Connected · ready to capture",
          );
          for (const command of result.commands)
            if (active) await upload(command.eventId);
        }
      } catch (e) {
        if (active) {
          setError(e.message);
          setStatus("Connection interrupted · retrying");
        }
      } finally {
        if (active) timer = setTimeout(heartbeat, 2000);
      }
    }
    heartbeat();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [device, running, hidden, upload]);
  async function capture(trigger = "manual") {
    if (
      !deviceRef.current ||
      !streamRef.current ||
      busyRef.current ||
      document.hidden
    )
      return;
    try {
      const e = await cameraApi("/api/camera/event", {
        token: deviceRef.current.cameraToken,
        method: "POST",
        body: { trigger },
      });
      await upload(e.id);
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    if (!motion || !running || hidden) return;
    const canvas = document.createElement("canvas");
    canvas.width = 24;
    canvas.height = 18;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    let dirty = false,
      lastMovement = 0;
    const timer = setInterval(() => {
      const v = videoRef.current;
      if (!v?.videoWidth || v.readyState < 2) return;
      ctx.drawImage(v, 0, 0, 24, 18);
      const pixels = ctx.getImageData(0, 0, 24, 18).data;
      const gray = new Uint8Array(24 * 18);
      for (let i = 0; i < gray.length; i++)
        gray[i] = (pixels[i * 4] + pixels[i * 4 + 1] + pixels[i * 4 + 2]) / 3;
      let diff = 0;
      if (previous.current) {
        for (let i = 0; i < gray.length; i++)
          diff += Math.abs(gray[i] - previous.current[i]);
        diff /= gray.length;
      }
      previous.current = gray;
      const now = Date.now();
      if (diff > Number(sensitivity)) {
        dirty = true;
        lastMovement = now;
      }
      if (
        dirty &&
        now - lastMovement >= 1500 &&
        now - motionTime.current > 8000
      ) {
        dirty = false;
        motionTime.current = now;
        capture("motion");
      }
    }, 500);
    return () => {
      clearInterval(timer);
      previous.current = null;
    };
  }, [motion, running, hidden, sensitivity]);
  async function disconnect() {
    await stop();
    saveDevice(KEY, null);
    setDevice(null);
    sent.current.clear();
    setShots(0);
    setLastShot(null);
    setStatus("Ready to pair");
    setError("");
  }
  return (
    <div className="camera-app">
      <header>
        <a href="/" className="logo">
          <img src="/camera/fridge-mark.svg" alt="" width="40" height="44" />
          Refridge<span className="logo-dot">.</span>
        </a>
        <span className="app-tag">CAMERA COMPANION</span>
      </header>
      <main>
        <div className="intro">
          <span className="eyebrow">A LITTLE MORE PERSPECTIVE</span>
          <h1>
            {device
              ? "Your view of the fridge."
              : "One fridge. Two perspectives."}
          </h1>
          <p>
            {device
              ? "Keep this phone in position. Refridge brings both views together."
              : "Turn this phone into a paired camera for your main Refridge app."}
          </p>
        </div>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {hidden && (
          <div className="note">
            This page is hidden. Return to this app and keep the phone unlocked
            to capture.
          </div>
        )}
        {!device ? (
          <section className="panel">
            <div className="panel-heading">
              <span className="step-number">01</span>
              <div>
                <h2>Pair this camera</h2>
                <p>
                  In the main app: Paired cameras → Create session → Pair a
                  camera.
                </p>
              </div>
            </div>
            <form onSubmit={pair}>
              <label>
                Camera role
                <select value={name} onChange={(e) => setName(e.target.value)} required>
                  <option value="Top Camera">Top Camera</option>
                  <option value="Side Camera">Side Camera</option>
                </select>
                <small>Top Camera identifies food. Side Camera measures volume and amount.</small>
              </label>
              <label>
                Six-character pairing code
                <input
                  className="code-input"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck="false"
                  required
                  pattern="[A-Za-z2-9]{6}"
                  maxLength={6}
                  placeholder="ABC234"
                />
              </label>
              <p className="hint">
                Codes expire after 2 minutes and work once. Create a fresh code
                for each phone.
              </p>
              <button className="button primary" disabled={busy} type="submit">
                {busy ? "Pairing…" : "Pair with my fridge"}
                <span>→</span>
              </button>
            </form>
          </section>
        ) : (
          <>
            <section className="panel camera-panel">
              <div className="live-header">
                <div>
                  <span className="eyebrow">{device.fridgeName}</span>
                  <h2>{device.cameraName || name}</h2>
                </div>
                <span
                  className={
                    "live-badge " + (running && !hidden ? "is-live" : "")
                  }
                >
                  <i />
                  {running && !hidden ? "LIVE CAMERA" : "STOPPED"}
                </span>
              </div>
              <div className={"viewfinder " + (running ? "running" : "")}>
                <video ref={videoRef} autoPlay playsInline muted />
                {!running && (
                  <div className="viewfinder-empty">
                    <span>◉</span>
                    <strong>Your camera starts with you.</strong>
                    <p>Tap Start camera and grant camera permission.</p>
                  </div>
                )}
                {running && (
                  <>
                    <span className="viewfinder-corner tl" />
                    <span className="viewfinder-corner tr" />
                    <span className="viewfinder-corner bl" />
                    <span className="viewfinder-corner br" />
                    <span className="viewfinder-caption">
                      {motion
                        ? "MOTION CAPTURE ENABLED"
                        : "READY FOR CAPTURE REQUESTS"}
                    </span>
                  </>
                )}
              </div>
              <p className="connection-status" role="status">
                <span className={running ? "connected" : ""} />
                {status}
              </p>
              <div className="controls">
                {running ? (
                  <>
                    <button
                      className="button primary"
                      disabled={busy}
                      onClick={() => capture("manual")}
                    >
                      Capture now<span>◉</span>
                    </button>
                    <button className="button secondary" onClick={stop}>
                      Stop camera
                    </button>
                  </>
                ) : (
                  <button
                    className="button primary"
                    disabled={busy}
                    onClick={start}
                  >
                    {busy ? "Starting…" : "Start camera"}
                    <span>→</span>
                  </button>
                )}
              </div>
              <div className="camera-stats">
                <div>
                  <strong>{shots}</strong>
                  <span>Photos sent this visit</span>
                </div>
                <div>
                  <strong>
                    {lastShot
                      ? lastShot.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </strong>
                  <span>Last capture</span>
                </div>
              </div>
            </section>
            <section className="panel">
              <div className="motion-heading">
                <div>
                  <h2>Capture when things move</h2>
                  <p>
                    On-device movement detection. The shared server analyses
                    food changes when enabled.
                  </p>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={motion}
                    disabled={!running}
                    onChange={(e) => setMotion(e.target.checked)}
                    aria-label="Enable motion capture"
                  />
                  <span />
                </label>
              </div>
              {motion && (
                <label>
                  Motion threshold · {sensitivity}
                  <input
                    type="range"
                    min="5"
                    max="45"
                    value={sensitivity}
                    onChange={(e) => setSensitivity(e.target.value)}
                  />
                  <small>
                    Lower detects smaller changes. Lighting changes can also
                    trigger a capture after the scene settles for 1.5 seconds.
                    At most one trigger per 8 seconds.
                  </small>
                </label>
              )}
              <div className="note">
                Keep this app open and the phone unlocked. Images are uploaded
                to your paired server only when captured. No audio is recorded.
                Pair the second phone separately for its other angle.
              </div>
              <button className="text-button" onClick={disconnect}>
                Disconnect this phone
              </button>
            </section>
          </>
        )}
        <section className="setup-note">
          <strong>A phone today. An integrated camera tomorrow.</strong>
          <p>
            Uses Wi-Fi / HTTPS image uploads. No Bluetooth connection is
            required. On iPhone, Share → Add to Home Screen installs this
            companion separately from Refridge.
          </p>
        </section>
      </main>
      <footer>
        Two views. One event. Analysis runs on your paired server.
      </footer>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<CameraApp />);
if ("serviceWorker" in navigator && import.meta.env.PROD)
  window.addEventListener("load", () =>
    navigator.serviceWorker
      .register("/camera/sw.js", { scope: "/camera/" })
      .catch(() => {}),
  );
