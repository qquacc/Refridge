import React from "react";
import Icon from "../components/Icon.jsx";
export const featureNav = [
  ["activity", "Nutrition"],
  ["cameras", "Paired cameras"],
  ["containers", "Containers"],
  ["goals", "Food goals"],
  ["challenges", "Challenges"],
  ["wrapped", "Food Wrapped"],
  ["profile", "My profile"],
];
export default function MorePage({ navigate }) {
  return (
    <div className="more-grid">
      {featureNav.map(([id, label]) => (
        <button className="more-card" key={id} onClick={() => navigate(id)}>
          <Icon name={id} size={26} />
          <strong>{label}</strong>
          <Icon name="arrow" size={18} />
        </button>
      ))}
    </div>
  );
}
