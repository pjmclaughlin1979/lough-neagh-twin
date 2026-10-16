import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Satellite,RefreshCw,LogIn,Download} from 'lucide-react';
import {loadArchive,archiveWindow,SENTINEL_URL} from './live-data';
import {arcgisSdk} from './arcgis-auth';
import {chronological} from './ndci-series';
export default function Archive({session,loadedScenes,onLoad}){
 const [archive,setArchive]=useState(null),[state,setState]=useState('waiting'),[error,setError]=useState('');
 const [filter,setFilter]=useState('all'),[page,setPage]=useState(0),[search,setSearch]=useState('');
 const [chosen,setChosen]=useState(()=>new Set(loadedScenes.map(s=>s.id))),[open,setOpen]=useState(!loadedScenes.length);
 const active=useRef(null);
 async function retrieve(){
  active.current?.abort();const control=new AbortController();active.current=control;setState('loading');setError('');
  try{
   const {request}=await arcgisSdk();
   const result=await loadArchive(async(url,query,signal)=>(await request(url,{query,responseType:'json',signal,timeout:30000})).data,SENTINEL_URL,new Date(),control.signal);
   if(!control.signal.aborted){setArchive(result);setChosen(ids=>new Set([...ids].filter(id=>result.scenes.some(s=>s.id===id))));setState('ready');setPage(0)}
  }catch(e){if(!control.signal.aborted){setError(e.message||'Could not load the archive.');setState('error')}}
 }
 useEffect(()=>{if(session.state==='ready')retrieve();return()=>active.current?.abort()},[session.state]);
 const range=archive?.window||archiveWindow();
 const filtered=useMemo(()=>archive?.scenes.filter(s=>(filter==='all'||new Date(s.date).getUTCFullYear()===Number(filter))&&s.name.toLowerCase().includes(search.toLowerCase()))||[],[archive,filter,search]);
 const years=[...new Set(archive?.scenes.map(s=>new Date(s.date).getUTCFullYear())||[])];
 const loadedIds=new Set(loadedScenes.map(s=>s.id));
 function toggle(id){setChosen(old=>{const next=new Set(old);next.has(id)?next.delete(id):next.add(id);return next})}
 function load(){const scenes=chronological(archive.scenes.filter(s=>chosen.has(s.id)).map(s=>({...s,service:archive.service})));onLoad(scenes);setOpen(false)}
 function exportCatalogue(){const url=URL.createObjectURL(new Blob([JSON.stringify(archive,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='lough-neagh-living-atlas-scenes.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 return <section className="archive-panel" id="scene-archive">
  <div className="card-heading"><div><div className="eyebrow">ARCGIS LIVING ATLAS · SENTINEL-2 LEVEL-2A</div><h2><Satellite size={20}/> Choose scenes to compare</h2></div><button className="button" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>{open?'Hide catalogue':'Choose / change scenes'}</button></div>
  <p className="live-note">{range.start} – {range.end} · cloud cover below 25% · {archive?`${archive.scenes.length} matching scenes`:'Lough Neagh study area'} · {loadedScenes.length} loaded for comparison</p>
  {session.state==='checking'&&<p role="status">Connecting to ArcGIS Online…</p>}
  {session.state==='signedOut'&&<div className="access-note"><strong>ArcGIS Online sign-in required</strong><p>{session.error||'Sign in with access to Living Atlas subscriber imagery to select your scenes.'}</p><button className="button" onClick={session.signIn}><LogIn size={15}/> Sign in to ArcGIS</button></div>}
  {state==='loading'&&<p role="status">Retrieving every matching catalogue record…</p>}
  {error&&<p role="alert" className="data-error">{error} <button onClick={retrieve}>Retry archive</button> <button onClick={session.signIn}>Sign in again</button></p>}
  {open&&archive&&<>
   <p className="live-note">Select multiple acquisitions, then load them into the map and time chart. Scene cloud coverage describes the whole tile; clouds can still cover the lake. Overlapping acquisitions remain separate observations.</p>
   <div className="archive-tools"><label>Year <select aria-label="Archive year" value={filter} onChange={e=>{setFilter(e.target.value);setPage(0)}}><option value="all">All years</option>{years.map(y=><option key={y}>{y}</option>)}</select></label><input aria-label="Search scene name" placeholder="Search scene name" value={search} onChange={e=>{setSearch(e.target.value);setPage(0)}}/><button className="button" disabled={state==='loading'} onClick={retrieve}><RefreshCw size={14}/> Refresh archive</button><button className="button" onClick={exportCatalogue}><Download size={14}/> Export catalogue</button></div>
   <div className="selection-bar"><strong>{chosen.size} chosen</strong><button onClick={()=>setChosen(ids=>new Set([...ids,...filtered.map(s=>s.id)]))}>Select all {filtered.length} filtered scenes</button><button onClick={()=>setChosen(new Set())}>Clear choices</button><button className="button primary" disabled={!chosen.size||state==='loading'} onClick={load}>Load {chosen.size||'chosen'} scenes</button></div>
   <div className="scene-table"><table><thead><tr><th>Choose</th><th>Acquired (UTC)</th><th>Scene</th><th>Scene cloud</th><th>Comparison</th></tr></thead><tbody>{filtered.slice(page*12,page*12+12).map(s=><tr key={s.id} className={chosen.has(s.id)?'active-scene':''}><td><input type="checkbox" aria-label={`Choose ${s.name}`} checked={chosen.has(s.id)} onChange={()=>toggle(s.id)}/></td><td>{new Date(s.date).toISOString().slice(0,16).replace('T',' ')}</td><td>{s.name}</td><td>{Number(s.cloud).toFixed(1)}%</td><td>{loadedIds.has(s.id)?'Loaded':'—'}</td></tr>)}</tbody></table></div>
   {!filtered.length&&<p>No scenes match these filters.</p>}
   <div className="pagination"><button disabled={page===0} onClick={()=>setPage(p=>p-1)}>Previous</button><span>{filtered.length?`${page*12+1}–${Math.min(page*12+12,filtered.length)} of ${filtered.length}`:'0 scenes'}</span><button disabled={(page+1)*12>=filtered.length} onClick={()=>setPage(p=>p+1)}>Next</button></div>
   <p className="live-note">Complete ID count verified · loaded {new Date(archive.loadedAt).toLocaleString('en-GB',{timeZone:'Europe/Dublin'})} (Ireland time). Loading a new set replaces the current comparison; choices persist while filtering and paging.</p>
  </>}
  <a className="attribution-link" href="https://www.arcgis.com/home/item.html?id=255af1ceee844d6da8ef8440c8f90d00" target="_blank" rel="noreferrer">Living Atlas Sentinel-2 imagery · Esri / Copernicus ↗</a>
 </section>
}
