# Nutrition and recipe provenance

## Canadian Nutrient File

Publisher: Health Canada. Dataset release: **CNF 2015**. Imported November 8, 2026 from the official CSV archive:

https://www.canada.ca/content/dam/hc-sc/migration/hc-sc/fn-an/alt_formats/zip/nutrition/fiche-nutri-data/cnf-fcen-csv.zip

CNF portal: https://aliments-nutrition.canada.ca/cnf-fce/?lang=eng

The importer processes FOOD NAME, NUTRIENT NAME, NUTRIENT AMOUNT, CONVERSION FACTOR and MEASURE NAME CSVs. Run `python3 scripts/import/cnf.py /absolute/path/to/extracted/csvs` to reproduce the bundled database, curated catalog, definitions and provenance. Python standard library only. Keep original CSV filenames. The raw archive is not bundled.

- `backend/data/cnf-foods.json`: 5,690 official food IDs, descriptions, measured nutrient values and available density references.
- `backend/data/cnf-provenance.json`: source URL, release, counts and value basis.
- `packages/shared/data/cnf-catalog.mjs`: 110 selected references with friendly aliases and full official descriptions/IDs.
- `packages/shared/data/cnf-nutrients.mjs`: all 152 source fields, names and units.

Amounts are per **100 g edible portion**. Household conversion factors represent grams per listed measure divided by 100; a factor × 100 gives grams in that measure. Available mL measures can therefore provide food-specific grams/mL, with the source measure retained. That does not make density exact across packing or preparation.

Friendly aliases such as Baby spinach/Cherry tomatoes may point to general raw spinach/tomato references. Greek yogurt uses a plain fat-free average; individual brands differ. Cooked rice, pasta, legumes and meats use cooked references where specified. Actual CNF description and food ID remain attached to each record. No brand-specific nutrition, label certification or exact photo-derived composition is implied.

Unknown measurements are omitted, not entered as zero. A recipe's nutrient total is marked partial when any ingredient lacks that field. Some fields overlap (energy in kcal/kJ, folate forms, vitamin A forms, fatty-acid subtypes), so do not add every field into a single nutrient total.

## Daily intake references

Health Canada Dietary Reference Intakes:

- Overview/tables: https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables.html
- Energy equations: https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/equations-estimate-energy-requirement.html
- Macronutrients: https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/macronutrients.html
- Vitamins: https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/vitamins.html
- Elements: https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/elements.html

Automatic energy targets use published age/sex/activity/height/weight equations for ages 14+, with the adolescent growth allowance. A neutral 50/20/30 carbohydrate/protein/fat energy split supplies planning defaults, with protein at least the age-appropriate reference grams/kg. Pregnancy/lactation, ages under 14 and incomplete reference inputs need custom targets. These are estimates, not clinical prescriptions or individualized weight-gain/loss plans. No automatic minimum is invented for every composition field.

Function/risk text is educational. A diary with incomplete meals cannot diagnose a deficiency, toxicity or blood nutrient status. Daily reference comparisons are for recorded intake; persistent inadequacy and medical status require different assessment.

## Recipes

Official index: https://www.canada.ca/en/health-canada/services/food-guide/eating-support/kitchen/recipes.html

`docs/recipe-sources.json` preserves links observed on that index. Each of the 24 app recipes links to a verified recipe path. Methods and gram quantities are independent simplified adaptations, not copied government recipe text. Optional seasonings are excluded from nutrient estimates; the original source can use different ingredients, quantities and serving sizes.

## Vision API

Official request format and image inputs: https://ai.google.dev/gemini-api/docs/image-understanding

Structured output guides: https://ai.google.dev/gemini-api/docs/structured-output

Model responses propose food IDs and changes. The server resolves measured nutrition from CNF instead of accepting model-generated nutrient numbers. No paid-provider call was made during validation because no key was configured.

## Priority goal calculations

Sports protein range: International Society of Sports Nutrition position stand, protein and exercise (1.4–2.0 g/kg/day for most exercising individuals): https://pmc.ncbi.nlm.nih.gov/articles/PMC5477153/

Energy surplus evidence: trial comparing maintenance, 5%, and 15% energy surpluses in resistance-trained participants; larger surpluses did not guarantee more muscle gain: https://pmc.ncbi.nlm.nih.gov/articles/PMC10620361/

The app selects an editable 5% starting surplus and 1.8 g/kg starting protein factor for adult bulking; these are approximate product planning defaults within the cited contexts, not individually validated prescriptions. The 25%-energy protein cap and 30%-fat/remainder-carbohydrate allocation are explicit app assumptions. No automated bulking adjustment is added for under-19 users, pregnancy/lactation, or incomplete/unsupported profile inputs.

Canada's Food Guide on budget planning and inexpensive plant proteins: https://www.canada.ca/en/health-canada/services/food-guide/eating-support/meal-planning-grocery-shopping/healthy-eating-budget.html

Budget-per-day and budget-per-meal figures are arithmetic spending limits based on user inputs; the app has no live pricing source. The weekly variety exploration goal is an editable personal planning target, not a nutrient recommendation.
