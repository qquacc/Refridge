"""Import official Health Canada CNF CSV. Usage: python3 scripts/import/cnf.py /path/to/extracted/csv"""
import csv,json,sys,hashlib,re
from pathlib import Path
raw=Path(sys.argv[1]);root=Path(__file__).resolve().parents[2]
def rows(name):return list(csv.DictReader((raw/name).open(encoding='cp1252')))
foods=rows('FOOD NAME.csv');amounts=rows('NUTRIENT AMOUNT.csv');definitions=rows('NUTRIENT NAME.csv')
values={}
for r in amounts:
 try:values.setdefault(r['FoodID'],{})[r['NutrientID']]=float(r['NutrientValue'])
 except ValueError:pass
meta=[{'id':r['NutrientID'],'name':r['NutrientName'].strip().title(),'symbol':r['NutrientSymbol'],'unit':r['NutrientUnit'],'decimals':int(r['NutrientDecimals'] or 2)} for r in definitions]
measures={r['MeasureID']:r['MeasureDescription'] for r in rows('MEASURE NAME.csv')}
densities={}
for r in rows('CONVERSION FACTOR.csv'):
 label=measures.get(r['MeasureID'],'');match=re.match(r'^(100|125|175|250)\s*ml\b',label,re.I)
 if match and r['FoodID'] not in densities:
  densities[r['FoodID']]={'gPerMl':round(float(r['ConversionFactorValue'])*100/int(match.group(1)),6),'measure':label,'source':'Health Canada CNF household-measure conversion factor; packing/preparation may vary'}
allfoods=[{'id':r['FoodID'],'name':r['FoodDescription'],'group':r['FoodGroupID'],'values':values.get(r['FoodID'],{}),'densityReference':densities.get(r['FoodID'])} for r in foods]
(root/'backend/data/cnf-foods.json').write_text(json.dumps(allfoods,separators=(',',':')))
(root/'packages/shared/data/cnf-nutrients.mjs').write_text('export const nutrientDefinitions = '+json.dumps(meta,ensure_ascii=False,separators=(',',':'))+';\n')
# Exact CNF IDs retained for the original eight foods; plain/raw/cooked choices below stay explicit.
base=[('Baby spinach','2213','Vegetables','🥬'),('Avocado','1511','Fruit','🥑'),('Greek yogurt','502188','Dairy','🥛'),('Cherry tomatoes','2396','Vegetables','🍅'),('Eggs','117','Protein','🥚'),('Strawberries','1749','Fruit','🍓'),('Chickpeas','502262','Protein','🫘'),('Sourdough','4063','Grains','🍞')]
# Determine the two variable IDs from exact descriptions instead of guessing.
for i,(name,id,group,emoji) in enumerate(base):
 if name=='Cherry tomatoes':
  r=next(x for x in foods if x['FoodDescription'].lower()=='tomato, red, ripe, raw, year round average');base[i]=(name,r['FoodID'],group,emoji)
 if name=='Eggs':
  r=next(x for x in foods if x['FoodDescription'].lower()=='egg, chicken, whole, fresh or frozen, raw');base[i]=(name,r['FoodID'],group,emoji)
lookups=[('Brown rice','grains, rice, brown, long-grain, cooked','Grains','🍚'),('Lentils','lentils, boiled','Protein','🫘'),('Carrot','carrot, raw','Vegetables','🥕'),('Broccoli','broccoli, raw','Vegetables','🥦'),('Cucumber','cucumber, with peel, raw','Vegetables','🥒'),('Red pepper','pepper, sweet, red, raw','Vegetables','🫑'),('Onion','onion, raw','Vegetables','🧅'),('Garlic','garlic, raw','Vegetables','🧄'),('Lemon','lemon, raw, without peel','Fruit','🍋'),('Banana','banana, raw','Fruit','🍌'),('Apple','apple, raw, with skin','Fruit','🍎'),('Blueberries','blueberry, raw','Fruit','🫐'),('Orange','orange, raw, all commercial varieties','Fruit','🍊'),('Mushrooms','mushroom, white, raw','Vegetables','🍄'),('Kale','kale, raw','Vegetables','🥬'),('Peanuts','peanuts, dry roasted','Protein','🥜'),('Milk','milk, fluid, partly skimmed, 2%','Dairy','🥛'),('Feta','cheese, feta','Dairy','🧀'),('Cheddar','cheese, cheddar','Dairy','🧀'),('Tofu','tofu, regular, firm or extra firm','Protein','🍱'),('Oats','oats, rolled, dry','Grains','🥣'),('Quinoa','quinoa, cooked','Grains','🍚'),('Pasta','pasta, spaghetti, cooked','Grains','🍝'),('Black beans','beans, black, boiled','Protein','🫘'),('Sweet potato','sweet potato, raw','Vegetables','🍠'),('Potato','potato, flesh and skin, raw','Vegetables','🥔'),('Zucchini','squash, summer, zucchini, includes skin, raw','Vegetables','🥒'),('Cabbage','cabbage, raw','Vegetables','🥬'),('Cauliflower','cauliflower, raw','Vegetables','🥦'),('Tomato sauce','tomato products, canned, sauce','Vegetables','🍅'),('Chicken breast','chicken, broiler, breast, meat only, roasted','Protein','🍗'),('Salmon','fish, salmon, atlantic, wild, baked or broiled','Protein','🐟'),('Tuna','fish, tuna, light, canned in water, drained solids','Protein','🐟'),('Shrimp','crustaceans, shrimp','Protein','🍤'),('Peanut butter','peanut butter, smooth','Protein','🥜'),('Almonds','nuts, almonds','Protein','🌰'),('Walnuts','nuts, walnuts','Protein','🌰'),('Tahini','sesame butter','Protein','🥜'),('Soy sauce','soy sauce (made with soy and wheat), shoyu, regular','Other','🥢'),('Sesame seeds','sesame seeds','Protein','🌰'),('Green peas','peas, green, raw','Vegetables','🫛'),('Corn','corn, sweet, yellow, raw','Vegetables','🌽'),('Berries','raspberry, raw','Fruit','🍓'),('Grapes','grapes, red or green','Fruit','🍇'),('Pineapple','pineapple, raw','Fruit','🍍'),('Coconut milk','coconut milk, raw','Other','🥥'),('Ginger','ginger root, raw','Vegetables','🫚'),('Edamame','edamame, frozen','Protein','🫛'),('Tortilla','tortilla, ready-to-bake / fry, flour','Grains','🫓')]
overrides={'Cucumber':'2363','Orange':'1616','Peanuts':'3362','Oats':'1413','Pasta':'4517','Black beans':'3253','Zucchini':'2225','Chicken breast':'842','Tuna':'3131','Grapes':'1718','Coconut milk':'2565','Edamame':'6218'}
for name,query,group,emoji in lookups:
 if name in overrides:
  base.append((name,overrides[name],group,emoji));continue
 hits=[r for r in foods if query in r['FoodDescription'].lower()]
 if hits:base.append((name,hits[0]['FoodID'],group,emoji))
 else:print('MISSING',name,query)
# Add distinct simple Canadian foods until at least 100; names preserve preparation to avoid false equivalence.
seen={x[1] for x in base}
for r in foods:
 d=r['FoodDescription'];g=r['FoodGroupID']
 if len(base)>=110:break
 if r['FoodID'] in seen or g not in ('9','11','12','16') or len(d)>85 or not any(k in d.lower() for k in ['raw','boiled']):continue
 if any(k in d.lower() for k in ['salt','mixed','added','dehydrated','dried','frozen']):continue
 base.append((d,r['FoodID'],'Fruit' if g=='9' else 'Protein' if g in ('12','16') else 'Vegetables','🍽️'));seen.add(r['FoodID'])
byid={x['id']:x for x in allfoods};macro={'kcal':'208','protein':'203','carbs':'205','fat':'204','fiber':'291'}
curated=[]
for name,id,group,emoji in base:
 r=byid[id];curated.append({'name':name,'cnfId':id,'description':r['name'],'category':group,'emoji':emoji,'color':'#e8ece2','nutrientsPer100g':r['values'],'densityReference':r.get('densityReference'),'nutritionSource':{'publisher':'Health Canada','dataset':'Canadian Nutrient File 2015','foodId':id,'url':'https://aliments-nutrition.canada.ca/cnf-fce/?lang=eng'},**{key:r['values'].get(nid) for key,nid in macro.items()}})
(root/'packages/shared/data/cnf-catalog.mjs').write_text('export const canadianCatalog = '+json.dumps(curated,ensure_ascii=False,separators=(',',':'))+';\n')
(root/'backend/data/cnf-provenance.json').write_text(json.dumps({'publisher':'Health Canada','dataset':'Canadian Nutrient File 2015','download':'https://www.canada.ca/content/dam/hc-sc/migration/hc-sc/fn-an/alt_formats/zip/nutrition/fiche-nutri-data/cnf-fcen-csv.zip','foods':len(allfoods),'nutrients':len(meta),'curatedFoods':len(curated),'amountBasis':'per 100 g edible portion','missingValues':'Unknown; not zero','imported':'2026-11-08'},indent=2))
print('Imported',len(allfoods),'foods',len(meta),'nutrients',len(curated),'curated foods')
