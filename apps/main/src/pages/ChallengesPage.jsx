import React, { useState } from "react";
import { Panel } from "../components/FeatureUI.jsx";
import { pointsFor } from "../lib/planning.mjs";
export default function ChallengesPage({ state }) {
  const [period, setPeriod] = useState("weekly");
  const leaders = state.members
    .map((m) => ({
      ...m,
      points: pointsFor(
        [...state.pointsLedger, ...(state.remotePointsLedger || [])],
        m.id,
        period,
      ),
    }))
    .sort((a, b) => b.points - a.points);
  return (
    <div className="feature-page">
      <Panel
        title="Today’s food challenges"
        subtitle="Assigned daily. Recorded actions award points once."
      >
        <div className="challenge-grid">
          {state.assignedChallenges.map((c) => (
            <article
              key={c.id}
              className={"challenge-card " + (c.completed ? "complete" : "")}
              title={`${c.points} points · ${c.reason}`}
              tabIndex={0}
            >
              <span className={"eyebrow challenge-status " + (c.completed ? "earned" : "")} >
                {c.completed ? "✓ COMPLETED" : "TODAY"}
              </span>
              <h3>{c.name}</h3>
              <p>{c.reason}</p>
              <span className="reward">
                {c.completed ? "✓ " : ""}
                {c.points} {c.completed ? "points earned" : "points to earn"}
              </span>
              <div className="challenge-tooltip">{c.completed ? "Already earned: " : "Reward: "}{c.points} points</div>
            </article>
          ))}
        </div>
      </Panel>
      <Panel
        title="Friends leaderboard"
        subtitle="Weekly view resets Monday. Historical awards remain in the ledger."
        action={
          <select
            aria-label="Leaderboard period"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="daily">Today</option>
            <option value="weekly">This week</option>
            <option value="monthly">This month</option>
          </select>
        }
      >
        {leaders.map((m, i) => (
          <div
            className={"leader-row " + (m.id === "me" ? "you" : "")}
            key={m.id}
          >
            <span className="rank">{i + 1}</span>
            {m.avatar ? (
              <img src={m.avatar} alt="" className="leader-avatar" />
            ) : (
              <span className="leader-avatar">{m.name[0]}</span>
            )}
            <strong>{m.id === "me" ? state.profile.name : m.name}</strong>
            <span>{m.points} pts</span>
            {m.demo && <small>Local sample member</small>}
          </div>
        ))}
        <p className="form-hint">
          Small food-saving habits add up. Earn points through your daily challenges
          and cheer on your friends. Sample-account scores are for demonstration.
        </p>
      </Panel>
      <Panel
        title="Points history"
        subtitle="Date-stamped awards make daily, weekly, and monthly totals auditable."
      >
        {state.pointsLedger.length ? (
          state.pointsLedger
            .slice()
            .reverse()
            .map((p) => (
              <div className="log-row" key={p.id}>
                <strong>{p.reason}</strong>
                <small>{p.date}</small>
                <span>+{p.points}</span>
              </div>
            ))
        ) : (
          <p className="body-copy">
            Complete a challenge to earn your first points.
          </p>
        )}
      </Panel>
    </div>
  );
}
