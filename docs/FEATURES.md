# Supplied plan → implementation

| Requested change | Implementation |
| --- | --- |
| Two iOS/Android camera phones | Separate PWA, device pairing, two views per event, settled-motion capture over HTTPS |
| Automatic food identification | Configurable server-side vision provider comparing reference and new scenes; explicit consent |
| Estimate mass/fill and nutrition | Matched CNF food ID; known whole-item removal, readable whole-package label, or container volume × food density; uncertain events held for review |
| Official Canadian nutrition data | Full CNF 2015 import: 5,690 foods, 152 fields, 110 curated foods for the frontend/vision prompt |
| Daily food challenges | Daily assignments, fixed reward rules, automatic completion from diary/plan actions; hover/focus reward display |
| Weekly/daily/monthly leaderboard | Date-keyed ledger; Monday weekly periods; shared friend awards; no cumulative-week leakage |
| Dietary restrictions | Ingredient-level checks for selected allergens/diets and recognised allergy words; cooking also rejects restricted recipes |
| Profile photos | Compressed local photos; optional sharing with accepted friends |
| Automated groceries | Learn stock quantities, configurable reorder threshold, gram shortages, refreshed after stock changes |
| Completed/history/clear | Complete removes pending item, keeps timestamped history, 12-hour replenishment pause, restore and clear history |
| Realistic personal/shared meal ideas | 24 independent adaptations linked to actual government recipe pages, scaled ingredient availability, shared-fridge plans |
| Nutrients, functions and risks | All 152 available composition fields, known-data coverage, educational descriptions, core reference intakes; no invented missing values or single-day diagnoses |
| Container copies/photos | Counts, occupied count, required new reference photo, dimensions, default owner, density overrides |
| Automatic portion reference | Vision fill estimate with physical scale/density checks; manual correction retained for uncertain scenes |
| Automatic nutrition targets | Age, height, weight, activity and equation reference from profile; Health Canada EER equations; BMI informational |
| More cuisine options | 100 preferences; ingredient/recent-diary ranking; currently 24 recipes across a subset of cuisines |
| Remove Fridge circle; move trades | My fridge now contains free-or-food in-person requests, real connected friend delivery and recipient approval; no quantity fields |
| Rename/move dinner planning | Meal plans → Cook together, pooled stock and saved shared plans |
| Remove streaks/points from Wrapped | New Wrapped reports calories, protein, carbs, favourites, cuisine, micronutrients and daily reference comparisons; challenge points remain separate as requested earlier in the plan |
| Remove scanner demo/pantries | Removed pages/navigation; persisted spaces migrate to fridges |
| Vector logos and unique tab icons | Original brand SVG, individual public SVG icon files, distinct inline nav vectors and matching install icons |
| Less rounded/button-heavy layout | Angular cards, hover/focus actions, touch-visible controls, six meal ideas initially with progressive reveal |

## Required configuration and physical limits

Automatic recognition needs a server-side provider key and a trusted HTTPS Node deployment. The static preview hosts the two interfaces only. Before deployment configure persistent `DATA_DIR`, exact public origin if needed, and your own provider account. Paired devices must remain foregrounded and unlocked.

No software can reliably infer exact mass, expiry, ownership or every nutrient from arbitrary photos. The implementation makes estimates only with supported references and holds unclear scenes for review. Confidence scores are model estimates, not calibrated accuracy guarantees. Densities vary with packing and cooking. The model prompt uses the curated 110-food catalog; unknown foods require review/search/manual entry. The full server dataset is searchable at `/api/nutrition/search`.

Food leaving the fridge is stock movement. Logging it as intake is a separate opt-in estimate. Follow actual food labels for allergens/cross-contact and product-specific nutrient differences. The 152 CNF fields are the available database scope, not every chemical in nature; no minimum intake is assigned to non-essential fields such as caffeine or trans fat.

Connected accounts use device tokens and explicit friend invitations. Browser data clearing loses that device identity. There is no email recovery or native push delivery. Competition is based on recorded app actions, not independently verified eating. Live sale-price feeds are not connected; affordability ranking prioritises available ingredients.
