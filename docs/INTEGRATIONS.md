# Integrations and boundaries

| Integration | Included | Configuration |
| --- | --- | --- |
| Canadian Nutrient File | Bundled official 2015 food/nutrient data, importer, provenance and server search | No API key; see SOURCES.md |
| Canada's Food Guide | Recipe inspiration links with independent fridge-sized adaptations | No external request at cooking time |
| OpenAI Responses vision | Server image inputs, strict JSON schema, `store:false`, configurable model | `OPENAI_API_KEY`, optionally `VISION_MODEL`; restart server; consent in app |
| Two phone cameras | Real pairing, permission-gated snapshots, command polling, settled-motion trigger | Same trusted HTTPS server; keep companions open |
| Friends/family | Device identities, explicit invitations, opted-in stock/profile/awards sharing | Same backend; enable sharing in My fridge |
| In-person trades | Real server delivery and recipient-only accept/decline | Accepted friendship; no quantities or automatic stock movement |
| Leaderboards | Dated recorded-action awards; daily/Monday-week/month views | Connect friends to share awards |
| Local store sales | No live feed | Affordability uses existing stock; no fabricated sale prices |
| Email accounts/recovery | Not included | Device-token identity; keep browser credentials/data |
| Medical diagnosis | Not provided | Intake references are educational estimates |
| Background native camera | Not included | Web apps can be suspended when hidden/locked |

The provider key stays server-side. `store:false` requests that API responses not be stored as retrievable response objects; this is not a promise of zero provider retention. Consult your provider account's current data controls before sending real images. The vision prompt excludes personal profile/diary details; container reference photos and the connected stock context are included for food matching.
