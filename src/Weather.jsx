import React,{useEffect,useState} from 'react';
import {CloudSun,RefreshCw,Wind,Droplets} from 'lucide-react';
import {WEATHER_URL,forecastDays,weatherLabel} from './live-data';
const value=(v,suffix='')=>v===null||v===undefined?'—':`${Math.round(v*10)/10}${suffix}`;
export default function Weather(){
 const [data,setData]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[revision,setRevision]=useState(0);
 useEffect(()=>{const controller=new AbortController();let live=true;const timeout=setTimeout(()=>controller.abort(),20000);setLoading(true);setError('');
 fetch(WEATHER_URL,{signal:controller.signal}).then(r=>{if(!r.ok)throw Error(`Weather request failed (${r.status})`);return r.json()}).then(j=>{const days=forecastDays(j);if(live)setData({days,updated:new Date(),timezone:j.timezone})}).catch(e=>{if(live){setError(e.name==='AbortError'?'Weather request timed out. Please retry.':e.message);setData(null)}}).finally(()=>{clearTimeout(timeout);if(live)setLoading(false)});return()=>{live=false;clearTimeout(timeout);controller.abort()};},[revision]);
 return <section className="weather-panel"><div className="card-heading"><div><div className="eyebrow">LOUGH NEAGH · 54.61° N, 6.40° W</div><h2><CloudSun size={20}/> Weather · next five days</h2></div><button className="button" disabled={loading} onClick={()=>setRevision(n=>n+1)}><RefreshCw size={14}/>{loading?'Updating…':'Refresh forecast'}</button></div>
 <p className="live-note">Tomorrow onwards · Europe/Dublin · model forecast for the lake centre, not in-water measurements</p>
 {error&&<p role="alert" className="data-error">{error}</p>}{loading&&!data&&<p role="status">Loading Open-Meteo forecast…</p>}
 {data&&<><div className="weather-grid">{data.days.map(d=><article key={d.date}><strong>{new Date(`${d.date}T12:00:00Z`).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',timeZone:'Europe/Dublin'})}</strong><span className="condition">{weatherLabel(d.weather_code)}</span><div className="temperature">{value(d.temperature_2m_max,'°')} <small>{value(d.temperature_2m_min,'°C')}</small></div><p><Droplets size={14}/>{value(d.precipitation_sum,' mm')} · {value(d.precipitation_probability_max,'%')}</p><p><Wind size={14}/>{value(d.wind_speed_10m_max,' km/h')}</p><small>Dominant wind: {value(d.wind_direction_10m_dominant,'°')}</small></article>)}</div><p className="live-note">Retrieved {data.updated.toLocaleString('en-GB',{timeZone:'Europe/Dublin'})} (Ireland time). Wind is daily maximum at 10 m; rain probability is daily maximum.</p></>}
 <a className="attribution-link" href="https://open-meteo.com/" target="_blank" rel="noreferrer">Weather data by Open-Meteo · CC BY 4.0 ↗</a></section>
}
