import data from './data/regional-prices.json' with { type: 'json' };
export const regionalPriceSource=data;
// Only compatible, weight-based product matches. Unit/liquid prices are not silently converted to grams.
const products={
 'apple':'Apples, per kilogram','banana':'Bananas, per kilogram','strawberries':'Strawberries, 454 grams','grapes':'Grapes, per kilogram','carrot':'Carrots, 1.36 kilograms','onion':'Onions, per kilogram','red pepper':'Peppers, per kilogram','potato':'Potatoes, per kilogram','sweet potato':'Sweet potatoes, per kilogram','cabbage':'Cabbage, per kilogram','mushrooms':'Mushrooms, 227 grams','dry brown rice':'Brown rice, 900 grams','dry white rice':'White rice, 2 kilograms','dried lentils':'Dried lentils, 900 grams','dry pasta':'Dry or fresh pasta, 500 grams','tofu':'Tofu, 350 grams','raw chicken breast':'Chicken breasts, per kilogram','raw salmon':'Salmon, per kilogram','raw shrimp':'Shrimp, 300 grams','peanut butter':'Peanut butter, 1 kilogram','peanuts':'Peanuts, 450 grams','almonds':'Almonds, 200 grams','butter':'Butter, 454 grams','tomatoes':'Tomatoes, per kilogram',
};
const aliases = {
 apples:'apple', bananas:'banana', carrots:'carrot', onions:'onion', potatoes:'potato', 'sweet potatoes':'sweet potato', 'red peppers':'red pepper', peppers:'red pepper', strawberry:'strawberries', grape:'grapes', mushroom:'mushrooms', almond:'almonds', peanut:'peanuts',
};
const comparable = {
 'cherry tomatoes': ['Tomatoes, per kilogram', 'Regular tomatoes used as a comparable product; cherry tomato prices may differ.'],
 'greek yogurt': ['Yogurt, 500 grams', 'Regular yogurt used as a comparable product; Greek yogurt may cost more.'],
 yogurt: ['Yogurt, 500 grams', ''], yogourt: ['Yogurt, 500 grams', ''],
 cheddar: ['Block cheese, 500 grams', 'Average block cheese used as a comparable product.'],
 'baby spinach': ['Salad greens, 142 grams', 'Salad greens used as a comparable product for fresh spinach.'],
 spinach: ['Salad greens, 142 grams', 'Salad greens used as a comparable product for fresh spinach.'],
 zucchini: ['Squash, per kilogram', 'Average squash used as a comparable product.'],
 tortilla: ['Flatbread and pita, 500 grams', 'Flatbread used as a comparable product for tortillas.'],
 sourdough: ['White bread, 675 grams', 'White bread used as a comparable product; sourdough may cost more.'],
};
export function regionalFoodPrice(state,name) {
 const location=state.profile?.cityLocation;
 if(location?.countryCode!=='CA')return null;
 const entered=String(name).trim().toLowerCase().replace(/\s+/g,' '), key=aliases[entered]||entered;
 const proxy=comparable[key];
 const product=products[key]||proxy?.[0];if(!product)return null;
 let region=location.province;
 if(region==='Yukon'&&location.name==='Whitehorse')region='Whitehorse, Yukon';
 if(region==='Northwest Territories'&&location.name==='Yellowknife')region='Yellowknife, Northwest Territories';
 const price=data.regions[region]?.[product];
 // Avoid presenting national averages as locally measured prices.
 if(!price)return null;
 return {...price,name,estimated:true,product,region,period:data.period,source:data.source,sourceUrl:data.sourceUrl,unitBasis:'reference weight', comparable:!!proxy?.[1], matchNote:proxy?.[1]||null};
}
