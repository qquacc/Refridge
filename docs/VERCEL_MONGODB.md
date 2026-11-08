# Deploy Refridge on Vercel + MongoDB Atlas

Both browser apps and the API run at one Vercel HTTPS address. MongoDB holds server records and private JPEGs. No persistent host disk, Mac tunnel, native app, Blob account or separate backend host is needed.

## 1. Create the Atlas database

1. Create a MongoDB Atlas cluster (a free cluster is sufficient for a small prototype).
2. Create a **database user** with read/write access to the `fridgeful` database. This is separate from your Atlas website login.
3. Configure Atlas **Network Access** to allow your Vercel deployment to connect. Serverless egress IPs can change; use the integration/network option suitable for your deployment. If you temporarily allow all IPs for a demo, keep authentication enabled and use a unique strong database password.
4. In Atlas choose **Connect → Drivers → Node.js** and copy the `mongodb+srv://...` connection string. Substitute the database user's password, URL-encoding special characters. Do not paste the secret into frontend code, GitHub or chat.

Transactions require a replica set; Atlas supplies this. A standalone local `mongod` without replica-set configuration is not supported by the Mongo adapter.

## 2. Upload the project to GitHub

Upload the extracted **contents** of `fridgeful`, with the root `package.json`, `package-lock.json`, `api/`, `backend/`, `apps/`, `packages/`, and `vercel.json` together. Do not upload only `apps/main` or `dist` and do not upload the ZIP as a single file.

Keep `.env`, `.fridgeful-data`, `node_modules` and local camera photos out of Git. The supplied `.gitignore` excludes them.

## 3. Import into Vercel

Create a Vercel project from that GitHub repository. Use:

| Setting | Value |
| --- | --- |
| Root directory | Folder containing the root `package.json` |
| Framework | Vite |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Node.js | Supported Node 22.12+ runtime (current Node 22/24 on Vercel) |

The root `api/index.mjs` becomes the Node function. `vercel.json` routes `/api/*` into it, preserves `/camera/`, bundles the Canadian reference data, and sets a 60-second function duration. Do not configure this as a static-only upload of `dist/`.

## 4. Set Vercel environment variables

Add these to the project before deployment:

| Variable | Value |
| --- | --- |
| `MONGODB_URI` | Your private Atlas connection string |
| `MONGODB_DB` | `fridgeful` (or your chosen database name) |
| `GEMINI_API_KEY` | Optional for pairing/manual review; required for automatic image analysis |
| `VISION_MODEL` | `gemini-2.5-flash` unless you select another compatible vision model |
| `VITE_CAMERA_API_URL` | Leave unset/blank for this same-origin deployment |

Do **not** give database/provider secrets a `VITE_` prefix. Redeploy after editing environment variables.

The function uses the current deployment origin. If an origin error occurs, add `ALLOWED_ORIGINS=https://YOUR-ACTUAL-PROJECT.vercel.app` (or your custom origin) and redeploy. Keep the exact scheme and hostname, with no `/camera/` path. `DATA_DIR`, TLS certificates, and `TRUST_PROXY` settings are not required for Vercel.

## 5. Verify and pair the phones

1. Open `https://YOUR-ACTUAL-PROJECT.vercel.app/api/health`. It should return `{"ok":true,"protocol":1}`. A 503 means database configuration/connectivity needs attention.
2. On the main phone open the deployed root `/` and create the camera session there.
3. On both camera phones open the **same deployment's `/camera/`**. Use a separate six-character pairing code for each phone, then start each camera and grant camera access.
4. Keep both camera pages visible and phones unlocked. Request **Capture both views** and verify two images reach one event.
5. For recognition, configure the provider key, inventory and container references, enable analysis consent and capture a reference scene. Clear/ambiguous results still need review.

Vercel provides HTTPS, so no Cloudflare installation or local Mac server is needed after deployment. Keep using the same main-app browser/origin: browser-local data and owner tokens do not automatically transfer between localhost, preview domains and the production domain.

## What persists

MongoDB stores **server-side** owner/camera sessions, paired devices, captures, private JPEGs, connected-fridge inventory/container context, friend connections, trades, shared awards and analysis leases. JPEGs are separate binary documents, each capped at 1 MiB, and are read only after owner authorization. No GridFS is needed at this size.

The existing personal profile/diary, grocery history, local plans and processed-event IDs remain in the main browser as before. This change does not add email/password accounts or full cross-device account recovery. Creating a new empty Atlas database does not import your old local disk or browser data; re-pair the phones at the deployed origin and add/sync the starting inventory there.

For a deliberately small migration, server metadata uses one transactional document, capped at 14 MiB, plus a separate photo collection. Existing session/event limits remain. This is suitable for the prototype; a larger release should split metadata into per-session/per-event collections and add global rate limiting. Current request-rate counters are instance-local.

## Background processing

Analysis promises are registered with Vercel `waitUntil`, including database writes and lease cleanup. A persisted per-session lease prevents concurrent function instances from analysing the same fridge simultaneously. Camera heartbeats and main-app polling start queued events; stale processing can resume after its 90-second lease expires. There is no process timer/daemon dependency and no separate queue service to configure.

Provider calls time out after 45 seconds to leave time for a database commit within the function budget. A crash or timeout can leave work for a later poll; retrying a provider request can incur another provider charge. Stock commits remain idempotent and use current-quantity checks. The app needs active camera/main requests to resume queued jobs; no scheduler runs when every app is closed.

## Local development

Without `MONGODB_URI`, `npm start` continues using local files. With it set in root `.env`, `npm start` uses the same Mongo adapter as the hosted API. The production Vercel function requires MongoDB and will return a clear error instead of writing temporary files.

Run `npm ci`, `npm test`, `npm run build`. Mongo adapter tests use a transaction-capable in-memory test double; no live Atlas credentials were available. These validate adapter behavior and HTTP/lifecycle contracts, not actual Atlas networking or a completed Vercel deployment.

Official references: https://www.mongodb.com/docs/drivers/node/current/crud/transactions/ ; https://vercel.com/docs/functions/runtimes/node-js ; https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package ; https://vercel.com/docs/project-configuration/vercel-json .
