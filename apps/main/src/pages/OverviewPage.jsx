import React from "react";
import Icon from "../components/Icon.jsx";
import { Panel } from "../components/FeatureUI.jsx";
import { rankedRecipes } from "../lib/domain.mjs";
export default function OverviewPage({
  state,
  food,
  soon,
  nutrients,
  remaining,
  navigate,
  setModal,
}) {
  return (
    <div className="feature-page">
      {!state.profile.complete && (
        <div className="profile-prompt">
          <div>
            <strong>Start with your profile</strong>
            <p>
              Add your dietary restrictions and details for automatic targets.
            </p>
          </div>
          <button className="btn outline" onClick={() => navigate("profile")}>
            Set up profile
          </button>
        </div>
      )}
      <section className="editorial-hero">
        <div>
          <span className="eyebrow">STOCK → PLAN → COOK</span>
          <h2>
            Good food starts
            <br />
            with what’s here.
          </h2>
          <p>Keep track of your fridge. Find a meal that fits your day.</p>
          <button className="btn dark" onClick={() => navigate("meals")}>
            Find a meal <Icon name="arrow" />
          </button>
        </div>
        <svg viewBox="0 0 250 260" aria-hidden="true">
          <path fill="#173f35" d="M35 10h180v240H35z" />
          <path fill="#d2ff5a" d="M48 23h154v72H48z" />
          <path fill="#edf2dc" d="M48 108h154v129H48z" />
          <path
            fill="none"
            stroke="#173f35"
            strokeWidth="9"
            d="M65 39v38m0 45v42"
          />
          <path fill="#ff9766" d="m90 150 36-31 38 31-38 54z" />
          <path fill="#638453" d="m126 119 32-24-2 32z" />
        </svg>
      </section>
      <div className="stats-grid">
        {[
          ["fridge", "In your fridge", food.length, "foods"],
          ["clock", "Use soon", soon.length, "items"],
          ["list", "Next shop", remaining, "foods"],
        ].map(([icon, label, value, unit]) => (
          <button
            key={icon}
            className="stat-card"
            onClick={() => navigate(icon === "list" ? "list" : "fridge")}
          >
            <Icon name={icon} size={28} />
            <div>
              <span>{label}</span>
              <strong>
                {value}
                <small>{unit}</small>
              </strong>
            </div>
            <Icon name="arrow" />
          </button>
        ))}
      </div>
      <div className="feature-columns">
        <Panel
          title="Use these first"
          action={
            <button className="text-btn" onClick={() => navigate("fridge")}>
              Open fridge ↗
            </button>
          }
        >
          {soon.length ? (
            soon.slice(0, 4).map((i) => (
              <button
                key={i.id}
                className="summary-food"
                onClick={() => setModal({ type: "edit", food: i })}
              >
                <span>{i.emoji}</span>
                <strong>{i.name}</strong>
                <small>
                  {Math.round(i.grams)} g · {i.expires}
                </small>
              </button>
            ))
          ) : (
            <p className="body-copy">
              No foods have a date in the next two days. Unknown dates still
              need checking.
            </p>
          )}
        </Panel>
        <Panel
          title="Today’s recorded intake"
          action={
            <button className="text-btn" onClick={() => navigate("activity")}>
              All nutrients ↗
            </button>
          }
        >
          <div className="energy">
            <strong>
              {Math.round(nutrients.kcal)}
              <small> kcal</small>
            </strong>
          </div>
          <div className="mini-nutrients">
            {["protein", "carbs", "fat"].map((k) => (
              <div key={k}>
                <strong>{Math.round(nutrients[k])} g</strong>
                <span>{k}</span>
              </div>
            ))}
          </div>
          <p className="form-hint">
            Only recorded foods count. Missing food and nutrient data can make
            totals incomplete.
          </p>
        </Panel>
      </div>
      <Panel
        title="Your next meal"
        subtitle="Filtered using your saved allergies and dietary restrictions."
      >
        <div className="meal-teasers">
          {rankedRecipes(state)
            .slice(0, 3)
            .map((r) => (
              <button
                key={r.id}
                onClick={() => setModal({ type: "recipe", recipe: r })}
              >
                <span>{r.emoji}</span>
                <strong>{r.name}</strong>
                <small>
                  {r.cuisine} · {r.time} min
                </small>
                <Icon name="arrow" />
              </button>
            ))}
        </div>
      </Panel>
    </div>
  );
}
