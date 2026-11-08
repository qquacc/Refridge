import data from './data/regional-prices.json' with { type: 'json' };
export const regionalPriceSource=data;
// Only compatible, weight-based product matches. Unit/liquid prices are not silently converted to grams.
const products={
 'apple':'Apples, per kilogram','banana':'Bananas, per kilogram','strawberries':'Strawberries, 454 grams','grapes':'Grapes, per kilogram','carrot':'Carrots, 1.36 kilograms','onion':'Onions, per kilogram','red pepper':'Peppers, per kilogram','potato':'Potatoes, per kilogram','sweet potato':'Sweet potatoes, per kilogram','cabbage':'Cabbage, per kilogram','mushrooms':'Mushrooms, 227 grams','dry brown rice':'Brown rice, 900 grams','dry white rice':'White rice, 2 kilograms','dried lentils':'Dried lentils, 900 grams','dry pasta':'Dry or fresh pasta, 500 grams','tofu':'Tofu, 350 grams','raw chicken breast':'Chicken breasts, per kilogram','raw salmon':'Salmon, per kilogram','raw shrimp':'Shrimp, 300 grams','peanut butter':'Peanut butter, 1 kilogram','peanuts':'Peanuts, 450 grams','almonds':'Almonds, 200 grams','butter':'Butter, 454 grams','tomatoes':'Tomatoes, per kilogram',
};
export function regionalFoodPrice(state,name) {
 const location=state.profile?.cityLocation;
 if(location?.countryCode!=='CA')return null;
 const product=products[String(name).trim().toLowerCase()];if(!product)return null;
 let region=location.province;
 if(region==='Yukon'&&location.name==='Whitehorse')region='Whitehorse, Yukon';
 if(region==='Northwest Territories'&&location.name==='Yellowknife')region='Yellowknife, Northwest Territories';
 const price=data.regions[region]?.[product];
 // Avoid presenting national averages as locally measured prices.
 if(!price)return null;
 return {...price,name,estimated:true,product,region,period:data.period,source:data.source,sourceUrl:data.sourceUrl,unitBasis:'reference weight'};
}
