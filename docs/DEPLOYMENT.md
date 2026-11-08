# Vercel with MongoDB (new)

Deploy the **whole repository**, including `api/`, using the root `vercel.json`. Add server-side `MONGODB_URI` and `MONGODB_DB` settings. Both browser apps and the API then share Vercel HTTPS; no persistent disk or Mac tunnel is required. Read [VERCEL_MONGODB.md](VERCEL_MONGODB.md) for the exact steps and prototype limits.

The static-host instructions below describe frontend-only deployment; they are not the new Vercel + MongoDB route.

# Deploy both apps and the camera backend

## Recommended: one HTTPS origin

Build and run the complete project on a Node/Docker host. Route **all paths** to the included Node server:

| URL                           | Served component  |
| ----------------------------- | ----------------- |
| `https://your-domain/`        | Main app          |
| `https://your-domain/camera/` | Camera Companion  |
| `https://your-domain/api/...` | Shared camera API |

No build-time API URL is needed for this layout.

```sh
npm ci
npm test
npm run build
npm start
```

Set `PORT` to the port your host expects. By default it is 8787. Set `DATA_DIR` to an attached persistent disk path. The application runs on a single Node process with file-backed storage; use one server instance and one disk, not multiple independent replicas. A production-scale multi-instance release would need transactional shared storage.

Terminate HTTPS with your host/reverse proxy. Forward the original host and protocol, or set exact frontend origins in `ALLOWED_ORIGINS`. The server accepts same-origin requests and does not allow arbitrary CORS origins.

## Docker

```sh
docker compose up --build
```

This serves HTTP on port 8787 and mounts a persistent named volume. Put a trusted HTTPS reverse proxy in front for the phones. `docker compose` alone does not create HTTPS.

The production Docker stage needs no npm runtime dependencies; the backend uses Node built-ins and serves the compiled frontends. The image runs as the non-root `node` user.

## Local trusted HTTPS alternative

Use a certificate/key trusted by each phone, whose certificate names match the exact hostname or IP address you open. Copy `.env.example` to `.env`, then set:

```dotenv
PORT=8787
TLS_CERT=./certs/local.pem
TLS_KEY=./certs/local-key.pem
```

`npm start` reads the root `.env`. Configure your network/DNS so both camera phones and the main phone can open the same certificate-matching HTTPS URL. Do not bypass certificate warnings; use a certificate trusted by those devices. The app cannot use phone camera capture over an ordinary HTTP LAN URL.

## Static hosts such as Vercel/Netlify

The combined `dist/` contains both frontends. Deploying it **does not deploy the Node camera API**. The included Vercel/Netlify configs are frontend-only.

To separate hosting:

1. Deploy `backend/server.mjs` on a persistent Node server behind HTTPS.
2. Set `VITE_CAMERA_API_URL=https://your-api-domain` in the root build environment and rebuild both apps.
3. Set `ALLOWED_ORIGINS=https://your-frontend-domain` on the backend. Add additional exact origins separated by commas if needed.
4. Deploy `dist/` at the frontend domain root.

The default download uses same-origin API paths and works immediately with `npm start` after building. A static-only preview without an API will show the camera-server connection error; inventory and existing local demos remain available.

## iPhone installation

Open `/` in Safari on the main phone and `/camera/` on each camera phone. For each, Share → Add to Home Screen → keep Open as Web App enabled if shown → Add. Their manifest IDs/scopes are different, so they install separately.

Keep each camera app open and its phone unlocked. Wake-lock is requested when supported but is not guaranteed. Backgrounding or locking can suspend capture and network work. Pairing, capture, uploading, and inbox refresh require connectivity. Offline caches support the interfaces, not offline image delivery.

## Data and recovery

Preserve `DATA_DIR` across restarts/deployments; it contains session metadata and private JPEGs. Device tokens are stored in browser local storage; the server stores their hashes. If browser data is cleared, device pairing may need to be recreated. No online account recovery is implemented.

Event/session deletion removes its known photo files; it does not roll back food already logged. The connected fridge context persists on the server for automation and optional friend sharing. The personal profile/diary, other local fridges, grocery history and plans still need a local export backup. A new main browser does not recover the old browser token automatically.

## Fix “This app origin is not allowed”

This response means the API was reached, but its origin check rejected the page's address. Use the exact scheme, hostname, and port from the browser address bar. For a separate frontend or tunnel, put the public frontend origin in the root `.env`:

```dotenv
ALLOWED_ORIGINS=https://your-app.example
```

Multiple exact origins can be comma-separated. `PUBLIC_APP_URL` can name a single public frontend origin as an alternative. Restart the whole `npm run dev` or `npm start` process after changing `.env`. The dev runner now loads root `.env` settings, independently of the frontend port, and its API proxy preserves the frontend Host. Standard localhost and 127.0.0.1 dev origins are included by default.

If a reverse proxy replaces Host with an internal backend hostname, configure the exact public origin above. Alternatively, set `TRUST_PROXY=true` only when your own reverse proxy supplies reliable `X-Forwarded-Host` and `X-Forwarded-Proto` headers. The server does not automatically authorize arbitrary forwarded hosts.

## Automatic recognition and shared friends

Set `GEMINI_API_KEY` and optionally `VISION_MODEL` on the Node host, then restart. Docker Compose forwards those variables from the root `.env`; it also forwards explicit origin/proxy settings. No key is needed for manual review or friend sharing. Never bake the key into `dist/`.

Enable automatic analysis with image-processing consent in Paired cameras. The first complete capture sets the scene reference. Container reference photos and context go to the configured provider. Paid provider access and billing are your responsibility; live provider accuracy was not validated in this build.

Friend sharing uses independent owner sessions on the same backend and separate eight-character friend invitation codes. Do not give someone your persistent owner token. There is no email/password recovery or push notification service. See README for the exact shared data boundary.
