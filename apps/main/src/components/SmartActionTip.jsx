import React from "react";
import Icon from "./Icon.jsx";
export default function SmartActionTip({ children }) {
  return <aside className="smart-action-tip" aria-label="Refridge tip"><Icon name="cameras" size={19} /><div><strong>Let Refridge lend a hand</strong><p>{children}</p></div></aside>;
}
