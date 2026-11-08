import React, { useState } from "react";
export function Panel({ title, subtitle, children, action, className = "" }) {
  return (
    <section className={"feature-panel " + className}>
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function Field({ label, children, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children || <input {...props} />}
    </label>
  );
}
export function Banner({ children }) {
  return (
    <div className="info-banner">
      <span aria-hidden="true">✳</span>
      <p>{children}</p>
    </div>
  );
}
export function Metric({ label, value, note }) {
  return (
    <div className="feature-metric">
      <span className="eyebrow">{label}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </div>
  );
}
export function useAction(state, setState, notify) {
  const [error, setError] = useState("");
  function run(fn, message) {
    try {
      setError("");
      const result = fn(state);
      if (result) setState(result);
      if (message) notify(message);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    }
  }
  return { error, run };
}
export function ErrorMessage({ error }) {
  return error ? (
    <p className="error" role="alert">
      {error}
    </p>
  ) : null;
}
export function formatDate(value) {
  return new Date(value + "T12:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
