import React, { useCallback, useState } from "react";
import WelcomeSplash from "./components/WelcomeSplash.jsx";
import { createRoot } from "react-dom/client";
import AccountGate from "./components/AccountGate.jsx";
import "./styles/base.css";
import "./styles/features.css";
import "./angular.css";
function Startup() {
  const [welcoming, setWelcoming] = useState(true);
  const finish = useCallback(() => setWelcoming(false), []);
  return <><AccountGate ready={!welcoming} />{welcoming && <WelcomeSplash onDone={finish} />}</>;
}
createRoot(document.getElementById("root")).render(<Startup />);
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("/sw.js").catch(() => {}),
  );
}
