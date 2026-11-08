import React, { useState } from "react";
import { Panel, Field } from "../components/FeatureUI.jsx";
import { uid, catalog } from "../data/food.mjs";
import { containerVolume, allInventory } from "../lib/domain.mjs";
import { photoDataUrl } from "../lib/photos.mjs";
export default function ContainersPage({ state, setState, notify, navigate }) {
  const [edit, setEdit] = useState(null);
  const [shape, setShape] = useState("Box");
  const [photo, setPhoto] = useState("");
  const [error, setError] = useState("");
  function save(e) {
    e.preventDefault();
    try {
      const f = new FormData(e.currentTarget);
      const c = {
        ...(edit || {}),
        id: edit?.id || uid(),
        name: String(f.get("name")).trim(),
        shape,
        fridgeId: String(f.get("fridgeId")),
        ownerId: String(f.get("ownerId")),
        lengthCm: Number(f.get("lengthCm")) || 0,
        widthCm: Number(f.get("widthCm")) || 0,
        heightCm: Number(f.get("heightCm")),
        diameterCm: Number(f.get("diameterCm")) || 0,
        tareGrams: Number(f.get("tareGrams")) || 0,
        count: Number(f.get("count")),
        photo,
        densityByFood: edit?.densityByFood || {},
      };
      if (!photo)
        throw Error(
          "Add a reference photo so the camera can match this container.",
        );
      if (
        !c.name ||
        !containerVolume(c) ||
        !Number.isInteger(c.count) ||
        c.count < 1
      )
        throw Error("Enter a name, valid inside dimensions, and a count.");
      const fridge = state.fridges.find((f) => f.id === c.fridgeId);
      if (![...(fridge?.members || []), "shared"].includes(c.ownerId))
        throw Error("Choose a food owner who belongs to this fridge.");
      const assigned = allInventory(state).filter(
        (i) => i.containerId === c.id && i.grams > 0,
      );
      if (assigned.length > c.count)
        throw Error("Count cannot be below the number of occupied containers.");
      setState((s) => ({
        ...s,
        containers: edit
          ? s.containers.map((x) => (x.id === c.id ? c : x))
          : [...s.containers, c],
      }));
      setEdit(null);
      setPhoto("");
      e.currentTarget.reset();
      notify("Container reference saved");
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <div className="feature-page">
      <div className="feature-columns">
        <Panel
          title={edit ? "Edit container reference" : "Add a container type"}
          subtitle="Measure the inside once. Add a photo and count identical containers."
        >
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <form
            className="feature-form"
            key={edit?.id || "new"}
            onSubmit={save}
          >
            <Field
              label="Container label"
              name="name"
              required
              defaultValue={edit?.name}
            />
            <label className="file-label">
              {photo ? (
                <img
                  src={photo}
                  alt="Container reference preview"
                  className="container-photo"
                />
              ) : (
                "Choose a reference photo"
              )}
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  try {
                    setPhoto(await photoDataUrl(e.target.files[0], 400));
                  } catch (e) {
                    setError(e.message);
                  }
                }}
              />
            </label>
            <div className="form-grid">
              <Field
                label="Identical containers"
                name="count"
                type="number"
                min="1"
                max="100"
                required
                defaultValue={edit?.count || 1}
              />
              <Field label="Fridge">
                <select
                  name="fridgeId"
                  defaultValue={edit?.fridgeId || state.activeFridgeId}
                >
                  {state.fridges.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Default food owner">
                <select name="ownerId" defaultValue={edit?.ownerId || "me"}>
                  {state.members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.id === "me" ? state.profile.name : m.name}
                    </option>
                  ))}
                  <option value="shared">Household shared</option>
                </select>
              </Field>
              <Field label="Shape">
                <select
                  value={shape}
                  onChange={(e) => setShape(e.target.value)}
                >
                  <option>Box</option>
                  <option>Cylinder</option>
                </select>
              </Field>
              {shape === "Box" ? (
                <>
                  <Field
                    label="Inside length (cm)"
                    name="lengthCm"
                    type="number"
                    min="0.1"
                    step="0.1"
                    required
                    defaultValue={edit?.lengthCm}
                  />
                  <Field
                    label="Inside width (cm)"
                    name="widthCm"
                    type="number"
                    min="0.1"
                    step="0.1"
                    required
                    defaultValue={edit?.widthCm}
                  />
                </>
              ) : (
                <Field
                  label="Inside diameter (cm)"
                  name="diameterCm"
                  type="number"
                  min="0.1"
                  step="0.1"
                  required
                  defaultValue={edit?.diameterCm}
                />
              )}
              <Field
                label="Inside height (cm)"
                name="heightCm"
                type="number"
                min="0.1"
                step="0.1"
                required
                defaultValue={edit?.heightCm}
              />
              <Field
                label="Empty weight (g)"
                name="tareGrams"
                type="number"
                min="0"
                step="0.1"
                defaultValue={edit?.tareGrams || 0}
              />
            </div>
            <button className="btn primary" type="submit">
              Save container
            </button>
            {edit && (
              <button
                type="button"
                className="text-btn"
                onClick={() => {
                  setEdit(null);
                  setPhoto("");
                }}
              >
                Cancel edit
              </button>
            )}
          </form>
        </Panel>
        <Panel
          title="Your container references"
          subtitle="Used count updates from the food assigned to each type."
        >
          {state.containers.map((c) => {
            const used = allInventory(state).filter(
              (i) => i.containerId === c.id && i.grams > 0,
            ).length;
            return (
              <article className="container-card" key={c.id}>
                {c.photo ? (
                  <img src={c.photo} alt={c.name} className="container-thumb" />
                ) : (
                  <span className="container-drawing">▱</span>
                )}
                <div>
                  <h3>{c.name}</h3>
                  <p>
                    {used} occupied / {c.count || 1} containers ·{" "}
                    {containerVolume(c)} mL
                  </p>
                  <small>
                    {c.shape === "Box"
                      ? `${c.lengthCm} × ${c.widthCm} × ${c.heightCm} cm`
                      : `Ø ${c.diameterCm} × ${c.heightCm} cm`}
                  </small>
                  {!c.photo && <small>Add a photo to improve matching.</small>}
                </div>
                <button
                  className="text-btn"
                  onClick={() => {
                    setEdit(c);
                    setPhoto(c.photo || "");
                    setShape(c.shape);
                  }}
                >
                  Edit
                </button>
              </article>
            );
          })}
        </Panel>
      </div>
      <Panel
        title="Automatic portion estimates"
        subtitle="Camera fill estimate × inside volume × a food-specific density reference."
      >
        <p className="body-copy">
          The camera model estimates fill level after a stable movement. The
          server uses a Health Canada household-measure density when available,
          or a calibrated density saved below. Unscaled images and unknown
          densities go to review instead of silently guessing grams. These are
          estimates; packing and preparation affect density.
        </p>
        <button className="btn outline" onClick={() => navigate("cameras")}>
          Open camera automation
        </button>
        <details className="calibration-details">
          <summary>Optional measured-density calibration</summary>
          <form
            className="feature-form inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget),
                id = String(f.get("container")),
                foodId = String(f.get("food")),
                density = Number(f.get("density"));
              setState((s) => ({
                ...s,
                containers: s.containers.map((c) =>
                  c.id === id
                    ? {
                        ...c,
                        densityByFood: {
                          ...c.densityByFood,
                          [foodId]: density,
                        },
                      }
                    : c,
                ),
              }));
              notify("Measured density saved");
            }}
          >
            <Field label="Container">
              <select name="container">
                {state.containers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Food">
              <select name="food">
                {catalog.map((c) => (
                  <option key={c.cnfId} value={c.cnfId}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Measured density (g/mL)"
              name="density"
              type="number"
              min="0.001"
              step="0.001"
              required
            />
            <button className="btn primary">Save calibration</button>
          </form>
        </details>
      </Panel>
    </div>
  );
}
