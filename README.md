# Vercel + MongoDB deployment

This version includes a Vercel Node API and MongoDB persistence for the existing main app and browser Camera Companion. Photos are stored in MongoDB as separate binary records. **Start with [the Vercel setup guide](docs/VERCEL_MONGODB.md).** No persistent host disk or Cloudflare tunnel is needed for that deployment.

Add `MONGODB_URI`, `MONGODB_DB=fridgeful`, and optionally `GEMINI_API_KEY` in Vercel, then deploy the whole repository using its root `vercel.json`. Keep `VITE_CAMERA_API_URL` blank. The native-companion experiment is not included.

Local `npm start` still works with file storage when `MONGODB_URI` is unset. Details below about needing a separate backend apply to **static-only** hosting; the new root `api/` function supplies the backend on Vercel. Personal browser-local records remain browser-local.

---

# Refridge — main app, Camera Companion, and shared server

A deployable React PWA project implementing the supplied Plans.pdf revision. Keep the project directory together: both apps use the shared nutrition and inventory rules.

## Run the complete system

Use Node.js 22.12+:

```sh
npm ci
cp .env.example .env
npm run build
npm start
```

On a computer, open `http://localhost:8787/`. The companion is at `http://localhost:8787/camera/`. For actual iPhone/Android cameras, publish the **same server** behind trusted HTTPS. Ordinary HTTP over a LAN IP does not enable camera access on phones. See [deployment](docs/DEPLOYMENT.md).

To enable automatic image analysis, put your provider key in the root `.env`:

```dotenv
GEMINI_API_KEY=your-server-side-key
VISION_MODEL=gemini-3.8-flash
```

Restart the server after changing environment variables. Never use a `VITE_` prefix for a secret. Provider usage requires your own account, access, and billing. Without a key, inventory/planning/social tools and manual camera review work; the app does not fabricate automatic recognition.

## Set up the three phones

1. Open `/` on the main phone and fill in **My profile**, including allergies. Set up your reference containers with inside dimensions, count, photo, and optional owner/density calibration.
2. Go to **Paired cameras → Create camera session → Pair a camera**. Scan that temporary QR code on camera phone 1, or enter its six-character pairing code at `/camera/`.
3. Start its camera and grant camera access. Generate a **new** code for camera phone 2 and repeat. A camera code is single-use and expires after two minutes.
4. Keep both companions open, unlocked, and pointed at the fridge. Motion capture starts enabled; it waits for 1.5 seconds of settled frames before capturing, with an eight-second cooldown.
5. In **Paired cameras**, accept the image-processing consent and enable automatic tracking. Both current fridge views and container reference photos can be sent to the configured vision provider.
6. Request **Capture both views**. The first complete event establishes a reference scene. Later settled captures are compared against it. You can explicitly capture a replacement reference scene.
7. Matched, sufficiently confident changes with a supported weight reference update inventory. Ambiguous foods, missing views, unknown mass, ownership problems, changed stock, and occupied containers stay for review. Correct estimates in **My fridge**.

Removing food is not proof of eating. By default it changes stock only. Estimated intake logging is a separate, explicit option; moving and discarding food should not count as eaten. Camera phones send JPEG snapshots over HTTPS/Wi-Fi, not Bluetooth or a continuous video stream. Browser capture cannot run reliably in the background or while a phone is locked.

## Implemented tools

- Fridge inventory, ownership, dates, multiple fridges, calibrated container references and counts.
- Optional before/after vision analysis with official Canadian food-composition references and idempotent stock updates.
- Dietary filtering across personal/shared meal suggestions and recipe cooking validation, including peanut allergies from profile checkboxes or recognised words in notes.
- 24 ingredient-aware recipe adaptations linked to Canada's Food Guide; personal and combined-fridge planning in **Meal plans → Cook together**.
- 100 cuisine preferences, ranked using available recipe ingredients and recent meals. The recipe collection does not cover all 100 cuisines yet.
- Learned usual-stock quantities, automatic gram-based grocery shortages, completed history, restore, and clear history.
- Health Canada energy-reference equations from profile inputs; automatic macros and core micronutrient reference intakes. BMI is informational. Custom targets are available.
- All **152 fields in CNF 2015**, including vitamins, minerals, individual fatty acids, amino acids and caffeine. Unknown values remain unknown; not every food has measurements for every field. No database contains literally every food compound that exists.
- Daily assigned challenges, one award per date/challenge, Monday-based weekly totals, and daily/monthly leaderboard views.
- Profile photos and Food Wrapped with food, cuisine, calories, protein, carbohydrates, nutrient totals, and day comparisons. Wrapped has no streaks or points.
- Original angular SVG brand and distinct navigation icons, responsive layouts, keyboard focus, hover actions, and persistent touch controls.

The Fridge circle page, streak page, scanner simulation, and pantry choices have been removed. Older data is migrated, with historical logs preserved rather than retroactively inventing missing nutrient values.

## Connect friends and family

Both main apps must reach the **same backend**. Each person creates their own camera/server session (cameras need not be paired to use the social tools).

1. In **My fridge → Connect friends & family**, each person enables sharing.
2. One person creates an eight-character **friend invitation**, and the other joins with it. This is a separate code from camera pairing; it is single-use and expires in ten minutes.
3. Accepted friends see each other's connected fridge inventory, display name/photo, and challenge awards. Weight, birthday, dietary notes, personal diary, container reference photos, and camera images are excluded from the friend feed.
4. Select a friend's fridge and click an item to request it free or offer your own food. Requests sync to the recipient, who can accept or decline. Amounts and exchange happen in person; accepting never silently transfers stock.
5. Connected fridge ingredients can be pooled in **Cook together**; remote foods cannot be directly edited or logged as your own.

Sharing can be paused and friends disconnected. This revokes future server reads; an offline device can retain a previously received snapshot until it reconnects. The bundled Ava/Allen fridges are clearly labelled local examples, separate from actual connected friends. Shared plans are local records; push notifications are not configured.

Identity uses a random device token stored in your main browser, with only its hash stored on the server. It is not an email/password account or an account-recovery service. Challenge awards validate app records and allowed rewards, not independently observed human eating or a cheat-resistant competition.

## Project layout

| Path | Purpose |
| --- | --- |
| `apps/main/` | Main React app and installable PWA |
| `apps/camera/` | Independent camera React app and PWA |
| `backend/` | Node pairing, photo storage, vision analysis, inventory context, friends/trades |
| `backend/data/` | Imported 5,690-food Canadian reference database and provenance |
| `packages/shared/` | API client, nutrition, diet restrictions, recipes and transaction rules |
| `packages/shared/data/` | Nutrient definitions and curated 110-food frontend/vision catalog |
| `scripts/import/cnf.py` | Reproducible importer for official Canadian CSV files |
| `dist/` | Production frontends: main at `/`, companion at `/camera/` |
| `docs/` | Deployment, API, source attribution, validation and requirement mapping |

Server data lives in `DATA_DIR` (default `.fridgeful-data/`). Use a persistent disk and **one server process/instance**. The backend persists sessions, private photos, connected-fridge context, invitations, shared awards, and trades. The main browser persists its profile, diary, usual-stock rules, grocery history, plans and processed-event IDs. Export a backup in settings.

A static deployment of `dist/` includes both interfaces but does **not** run the backend. Pairing, automatic recognition, connected friends and trades need the Node server. Live store sales/prices, medical diagnoses, hardware testing, email recovery, and native background camera capture are not provided.

## Development and validation

```sh
npm run dev
npm test
npm run build
```

Development runs the API on 8787, main frontend on 5173, and camera frontend on 5174. The main dev frontend proxies `/camera/` and `/api/`. Root `.env` is loaded. Existing same-origin/allowlist fixes are retained; see [origin troubleshooting](docs/DEPLOYMENT.md#fix-this-app-origin-is-not-allowed).

Automated tests cover nutrient references, restrictions, learned stock, period boundaries, transactional inventory, provider request format/failure handling, two-camera analysis, authorisation, sharing, invitations and trades. The vision provider was tested with deterministic stubs; no paid key or two physical camera phones were available for live accuracy tests. See [validation](docs/VALIDATION.md), [implemented requirements](docs/FEATURES.md), and [data sources](docs/SOURCES.md).

## Camera roles

Pair exactly one **Top Camera** and one **Side Camera** using the role selector in Camera Companion. Top Camera is used only for food identification; Side Camera is used only for food volume/amount and changes in amount. Automatic analysis requires both roles in both the reference scene and the new capture. Uncertain matches or amounts require manual review; uncalibrated images do not provide reliable grams.

For cameras paired with older generic names, remove and pair them again with the correct role, then capture a new reference scene.

Existing browser storage keys, the `.fridgeful-data/` directory, and the `fridgeful-data` Docker volume retain their original names for compatibility, so the Refridge rename preserves saved profiles, inventory, and camera pairings.

Camera recognition now predicts common dish names and likely ingredient proportions without asking Gemini to choose nutrition IDs. The server searches CNF locally for suggested dish references. Ingredient breakdowns and visual quantities are estimates shown for review, not verified recipes; mixed dishes do not automatically change stock. Before/after views are retained, and container reference images are omitted from this lightweight prediction request.
