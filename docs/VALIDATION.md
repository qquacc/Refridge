# Validation

Automated Node tests cover:

- Original inventory quantity/ownership rules and backwards data migration.
- Canadian reference values, complete import count, searchable food IDs, and unknown nutrient coverage.
- Peanut allergy, dietary rules, unknown ingredients, cooking restrictions, and recipe ingredient references.
- Grocery shortages, changed amounts, completed history, replenishment pause, and observed stock learning.
- Monday weekly boundaries across month/year changes, daily/monthly buckets, and reward deduplication.
- Automatic transactions: tracked whole removals, density-based remaining fill, occupied containers, low confidence, unknown mass, invalid IDs and concurrent changes.
- Baseline creation, paired-angle analysis once, context acknowledgements, uncertain-event review and no unattended paid retries.
- Vision request image format, Gemini JSON schema, container photos, server-side key authentication and error handling using deterministic stubs.
- Owner/camera authorization, pairing expiry, private photo access, immutable uploads, grouping, revocation, deletion and persistent sessions.
- Exact origin allowlists, localhost/LAN development and explicitly trusted proxy behavior.
- Mutual friend invitations, limited friend feeds, shared awards, recipient-only trade approval, pause/disconnect and no automatic stock transfer.

Run `npm test` and `npm run build` from the root. Backend tests use temporary directories and loopback servers; provider tests never contact a paid service. The project includes the normal application, not the test stub.

Browser QA checks the desktop overview, dietary profile controls, restricted meal suggestions, challenges, the camera key/configuration state, grocery history controls and the independent companion UI. The responsive CSS includes iPhone-sized layouts and touch-visible actions; physical Safari/Android camera/background behavior still needs on-device verification.

No production provider key or two physical phones were available, so live image-recognition accuracy, calibrated mass error and battery/lighting performance have not been measured. Docker packaging is supplied; the test environment does not establish that a real production host or HTTPS certificate has been configured for you. Static preview deployment cannot run this Node server.
