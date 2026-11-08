# Refresh official source snapshots. GeoNames: CC BY 4.0; Statistics Canada: Open Licence.
import csv,io,json,zipfile,re
from pathlib import Path
import urllib.request,datetime,tempfile
root=Path(__file__).resolve().parents[2]
cache=Path(tempfile.mkdtemp(prefix="refridge-regions-"))
for name,url in [("prices","https://www150.statcan.gc.ca/n1/tbl/csv/18100245-eng.zip"),("cities","https://download.geonames.org/export/dump/CA.zip")]:
 urllib.request.urlretrieve(url,cache/(name+".zip"))
out=root/'apps/main/src/lib/data';out.mkdir(exist_ok=True)
provinces={'01':'Alberta','02':'British Columbia','03':'Manitoba','04':'New Brunswick','05':'Newfoundland and Labrador','07':'Nova Scotia','08':'Ontario','09':'Prince Edward Island','10':'Quebec','11':'Saskatchewan','12':'Yukon','13':'Northwest Territories','14':'Nunavut'}
cities=[]
for l in zipfile.ZipFile(cache/'cities.zip').read('CA.txt').decode().splitlines():
 f=l.split('\t')
 if f[6]!='P' or f[7] not in ['PPL','PPLA','PPLA2','PPLA3','PPLA4','PPLC','PPLL'] or f[10] not in provinces:continue
 cities.append({'id':f[0],'name':f[1],'ascii':f[2],'province':provinces[f[10]],'country':'Canada','countryCode':'CA','latitude':float(f[4]),'longitude':float(f[5]),'timezone':f[17],'population':int(f[14])})
(root/'backend/data/cities-ca.json').write_text(json.dumps(cities,ensure_ascii=False,separators=(',',':')))
rows=list(csv.DictReader(io.StringIO(zipfile.ZipFile(cache/'prices.zip').read('18100245.csv').decode('utf-8-sig'))));latest=max(r['REF_DATE'] for r in rows)
prices={}
for row in rows:
 if row['REF_DATE']!=latest or not row['VALUE'] or row['STATUS'] in ['x','F']:continue
 product=row['Products'].strip();grams=None
 if product.endswith('per kilogram'):grams=1000
 else:
  m=re.search(r', ([\d.]+) (grams|kilograms)$',product)
  if m:grams=float(m[1])*(1000 if m[2]=='kilograms' else 1)
 if not grams:continue
 prices.setdefault(row['GEO'],{})[product]={'cad':float(row['VALUE']),'grams':grams}
(out/'regional-prices.json').write_text(json.dumps({'period':latest,'retrievedAt':datetime.date.today().isoformat(),'source':'Statistics Canada 18-10-0245-01','sourceUrl':'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1810024501','regions':prices},separators=(',',':')))
print(len(cities),'places;',len(prices),'pricing regions;',latest)
