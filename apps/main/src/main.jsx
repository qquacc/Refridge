import React from "react";
import { createRoot } from "react-dom/client";
import AccountGate from "./components/AccountGate.jsx";
import "./styles/base.css";
import "./styles/features.css";
import "./angular.css";
createRoot(document.getElementById("root")).render(<AccountGate />);
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("/sw.js").catch(() => {}),
  );
}
