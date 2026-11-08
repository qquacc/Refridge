import { readFile } from 'node:fs/promises';
let index;
const normalize=(s)=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
export async function searchCities(query) {
 const q=normalize(query);if(q.length<2||q.length>80)return [];
 index ||= JSON.parse(await readFile(new URL('./data/cities-ca.json',import.meta.url),'utf8'));
 return index.filter((c)=>normalize(c.name).startsWith(q)||normalize(c.ascii).startsWith(q)).sort((a,b)=>(normalize(b.name)===q)-(normalize(a.name)===q)||b.population-a.population).slice(0,8);
}
