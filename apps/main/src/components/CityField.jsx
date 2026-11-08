import React, { useEffect, useState, useId } from 'react';
import { cameraApi } from '../../../../packages/shared/camera-client.mjs';
export default function CityField({ value, location, onChange }) {
 const [matches,setMatches]=useState([]),[error,setError]=useState('');const list=useId();
 useEffect(()=>{
  if(!value||value.length<2||location){setMatches([]);return;}
  const controller=new AbortController();const timer=setTimeout(async()=>{
   try{const result=await cameraApi('/api/locations?q='+encodeURIComponent(value),{signal:controller.signal});if(controller.signal.aborted)return;setError('');const exact=result.cities.filter((c)=>c.name.toLocaleLowerCase()===value.trim().toLocaleLowerCase()||c.ascii.toLocaleLowerCase()===value.trim().toLocaleLowerCase());if(exact.length===1){onChange(exact[0].name,exact[0]);setMatches([]);}else{setMatches(result.cities);if(!result.cities.length)setError('No match yet. Try the nearest Canadian city or town.');}}
   catch(e){if(!controller.signal.aborted)setError('City search is unavailable. You can skip this and add your city later.');}
  },200);return()=>{clearTimeout(timer);controller.abort();};
 },[value,location]);
 return <div className="city-picker"><label className="field"><span>City</span><input value={value||''} autoComplete="address-level2" maxLength={80} placeholder="e.g. Calgary" aria-controls={list} onChange={(e)=>{setError('');onChange(e.target.value,null);}} /></label>
 {location&&<small>{location.name}, {location.province}, {location.country}</small>}
 {matches.length>0&&<div id={list} className="city-matches">{matches.map((c)=><button key={c.id} type="button" onClick={()=>{onChange(c.name,c);setMatches([]);}}>{c.name}<small>{c.province}, Canada</small></button>)}</div>}
 {error&&<p className="form-hint">{error}</p>}<small>Canadian cities and towns from <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames</a>. No street address needed.</small></div>;
}
