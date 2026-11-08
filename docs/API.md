# Camera API

All authenticated requests use `Authorization: Bearer <device-token>`. Owner and camera tokens have distinct scopes. JSON responses are not cached. Images are served only through an owner-authorized API request; permanent tokens are never in image URLs.

| Method/path                    | Role      | Purpose                                                             |
| ------------------------------ | --------- | ------------------------------------------------------------------- |
| `GET /api/health`              | None      | Server/protocol availability                                        |
| `POST /api/sessions`           | None      | Create a device-scoped owner session; body `{fridgeId, fridgeName}` |
| `GET /api/session`             | Owner     | Session, camera status, events, image metadata                      |
| `DELETE /api/session`          | Owner     | Revoke devices and delete session/photos                            |
| `POST /api/pairing`            | Owner     | Generate a single-use code (2-minute TTL)                           |
| `POST /api/pair`               | Pair code | Exchange `{code, name}` for a camera token                          |
| `DELETE /api/cameras/:id`      | Owner     | Revoke the camera                                                   |
| `POST /api/capture`            | Owner     | Request one event from online cameras                               |
| `POST /api/camera/heartbeat`   | Camera    | Body `{ready:true/false}`; return capture commands                  |
| `POST /api/camera/event`       | Camera    | Body `{trigger:"manual"/"motion"}`; create/reuse grouped event      |
| `POST /api/events/:id/image`   | Camera    | Raw JPEG body, `Content-Type: image/jpeg`, at most 1 MiB            |
| `GET /api/images/:id`          | Owner     | Retrieve private JPEG bytes                                         |
| `POST /api/events/:id/confirm` | Owner     | Persist one food review or ignored decision                         |
| `DELETE /api/events/:id`       | Owner     | Remove event and photos (does not undo inventory)                   |

Incoming confirmation:

```json
{
  "direction": "in",
  "foodName": "Avocado",
  "grams": 100,
  "fridgeId": "my-fridge",
  "ownerId": "me",
  "expires": "2027-01-01",
  "containerId": ""
}
```

Outgoing confirmation:

```json
{ "direction": "out", "itemId": "food-0", "grams": 50, "action": "eaten" }
```

Use `moved` or `discarded` for stock-only removal. Ignore with `{"direction":"ignore"}`.

An event has an ID, creation time, trigger, expected camera IDs, image metadata, status, and optional confirmation. Camera heartbeat commands contain only that camera's unfilled event IDs. The camera cannot retrieve the owner session or image bytes.

The local inventory adapter validates the proposed action before server confirmation. If the inventory has since changed, review the error before applying. Automatic events use the latest synced connected-fridge context with quantity preconditions; older manual confirmations are also checked by the main app. Other browser-local records remain separate.

Limits: 2 active cameras/session, 200 events/session, 100 sessions/server, process-local request/pairing rate limits. Codes and upload commands expire. Delete old events/sessions to free capacity. Tests cover the important scope, expiry, retry, and file-storage behavior.

## Nutrition and automatic analysis

| Method/path | Role | Body / result |
| --- | --- | --- |
| GET `/api/nutrition/search?q=spinach` | Public | Up to 25 matching CNF reference records |
| GET `/api/automation/status` | Owner | Provider-key availability, model and nutrient source; never the secret |
| POST `/api/context` | Owner | `{inventory,containers,appliedEventIds,defaultOwnerId}` for this session's fridge |
| POST `/api/automation` | Owner | `{enabled,consent,logRemovalsAsIntake}`; enable requires key, consent and context |
| POST `/api/events/:id/analyze` | Owner | Explicit retry of pending review analysis |

`POST /api/capture` accepts `{baseline:true}` to capture a new reference scene. Automatic events include `analysis` and a confirmation `{direction:"automation",operations,estimatedConsumption}`. A baseline has status `baseline` and never changes food. Unknown scenes remain pending with `analysis.state="needs-review"`. A client context update must acknowledge all previous automatic event IDs or receive 409. JSON requests are capped at 2 MiB; reference photos are compressed by the frontend.

## Friends and in-person requests

All routes require an owner token. Camera tokens cannot use them.

| Method/path | Purpose |
| --- | --- |
| GET `/api/social` | Accepted enabled friends' opted-in inventory/profile/awards and this user's trade records |
| POST `/api/social/profile` | `{enabled,name,avatar,pointsLedger}`; no personal health-profile fields |
| POST `/api/social/invite` | Create a single-use 8-character code valid 10 minutes |
| POST `/api/social/join` | `{code}` establishes mutual accepted friendship |
| POST `/api/social/remove` | `{friendId}` removes mutual access and cancels pending requests |
| POST `/api/social/trades` | `{toId,wantedId,offeredId?}`; free-or-food request with no quantities |
| POST `/api/social/respond` | `{tradeId,status}`; recipient accepts/declines, sender cancels |

Trade acceptance updates request status only. Stock is not transferred automatically. Awards accept known reward amounts with unique date/challenge IDs; they represent app records rather than independent verification of eating.

Hosted storage: `MONGODB_URI` selects MongoDB transactions and a separate private binary-photo collection; the Vercel entry requires that setting. Web camera uploads now use JSON `{jpegBase64: "..."}` at the existing image endpoint to preserve JPEG bytes through function request parsing. Raw `image/jpeg` remains supported by the Node handler. Both forms enforce a 1 MiB decoded image cap and the same camera/event authorization.
