# Hosted MongoDB mode

The existing browser pairing/capture protocol also runs through the new Vercel function. MongoDB transactions persist metadata/photos, and shared analysis leases plus request-lifecycle scheduling replace reliance on a single long-running server. See [VERCEL_MONGODB.md](VERCEL_MONGODB.md). The file-storage discussion below applies to local/Node-host mode only.

# Camera and automatic inventory behavior

The main app, two independent camera PWAs, and Node server share one HTTPS deployment. Wi-Fi/HTTPS carries JPEG snapshots. No Web Bluetooth implementation or continuous video stream is used. Physical Wi-Fi cameras can implement the same pairing/heartbeat/event/image protocol later.

## Pairing and capture

An owner session issues single-use six-character camera codes valid for two minutes. Each code grants a separate upload-only camera token; only hashes of persistent tokens are stored on disk. A session accepts two active cameras. Owner-authorised reads retrieve private photos; camera tokens cannot read owner sessions, photos, friend feeds, or other sessions.

Camera heartbeat is every two seconds. Ready status expires after twelve seconds. Main capture requests expect every currently online camera. The companion also captures on manual request or after detected movement settles for 1.5 seconds. Frame checks run every half-second; the local cooldown is eight seconds. Triggers within a five-second window reuse one pending event. This heuristic can miss fast separate movements or respond to lighting changes; actual positioning and motion sensitivity need testing.

Each camera/event accepts one immutable JPEG at most 1 MiB. Retries reuse the same event/image record. Incomplete multi-camera events are not automatically analysed. They can be manually reviewed with an explicit partial-view choice.

## Analysis and stock transactions

1. The main app syncs the connected fridge, reference containers, ownership defaults, and applied-event acknowledgements to the server.
2. Enabling analysis requires a configured server key, explicit consent to send photos/context to the vision provider, and a synced context.
3. The first complete capture establishes the reference scene. A baseline request deliberately replaces it.
4. Later events compare previous/current angles. The provider returns structured IDs, direction, fill/label information and uncertainty. Container reference photos are included; instructions printed in photos are treated as image data.
5. The server resolves nutrition from CNF records. Supported mass references are an already tracked whole outgoing item, a readable whole-package net-weight label, or matched container dimensions plus food-specific density. An outgoing container fill level means the amount remaining, so only the difference is removed.
6. Conservative confidence checks, valid Canadian IDs, container capacity and unchanged stock are required. An ambiguous event holds the whole transaction for review. No partial automatic batch is applied.
7. Automatic transactions update server context once and are replayed idempotently into the main app while it is open. Context updates must acknowledge prior automatic events, preventing stale clients from erasing those changes. Quantity preconditions catch intervening manual edits.
8. Successful/no-change events advance the scene. Review decisions on complete captures can establish the next scene. Errors stay visible without automatic provider retries; an explicit retry can incur another provider call.

Only one analysis runs per session at once; ready events are processed oldest first. Provider failure and missing mass never create fabricated food/nutrition. Disabling analysis during a request prevents its inventory commit. Resetting a reference scene does not identify previously untracked contents; add/correct initial stock before relying on tracking.

Removal logs intake only if separately enabled. Such diary records retain the event's local capture date and are labelled estimates. Food may have been moved, shared or discarded. Correct inaccurate diary or stock entries using the app and exported records.

## Data and limits

`DATA_DIR` contains JSON session/context/social records and private JPEG files. A single process serialises atomic file writes. Use one instance and persistent disk; scale requires a transactional database/queue. Images are excluded from service-worker caches. Event/session deletion removes known photos but does not undo previously applied food updates. No automatic photo-retention schedule is configured.

Phone browsers can suspend camera/network work while backgrounded or locked. Wake-lock requests are best effort. No two-physical-phone accuracy test or paid-provider call was available in the build environment. Test glare, condensation, occlusion, overlapping events, package labels, density calibration, battery/power and network interruptions on the intended hardware.
