import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Satellite,RefreshCw,LogIn,Download} from 'lucide-react';
import {loadArchive,archiveWindow,SENTINEL_URL} from './live-data';
export const ARCGIS_APP_ID='CTbgT2f2BGjoPKMO';
let sdk;
async function arcgis(){
 if(!sdk)sdk=(async()=>{for(let i=0;i<200&&!window.$arcgis;i++)await new Promise(r=>setTimeout(r,100));if(!window.$arcgis)throw Error('ArcGIS SDK did not load. Please reload the page.');
 const [IdentityManager,OAuthInfo,request]=await window.$arcgis.import(['@arcgis/core/identity/IdentityManager.js','@arcgis/core/identity/OAuthInfo.js','@arcgis/core/request.js']);
 IdentityManager.registerOAuthInfos([new OAuthInfo({appId:ARCGIS_APP_ID,portalUrl:'https://www.arcgis.com',popup:false})]);return {IdentityManager,request};})();
 return sdk;
}
export default function Archive({onPick,activeId}){
 const [archive,setArchive]=useState(null),[state,setState]=useState('checking'),[error,setError]=useState(''),[filter,setFilter]=useState('all'),[page,setPage]=useState(0),[search,setSearch]=useState('');const active=useRef(null);
 async function retrieve(){active.current?.abort();const control=new AbortController();active.current=control;setState('loading');setError('');setArchive(null);
 try{const {request}=await arcgis();const result=await loadArchive(async(url,query,signal)=>(await request(url,{query,responseType:'json',signal,timeout:30000})).data,SENTINEL_URL,new Date(),control.signal);if(!control.signal.aborted){setArchive(result);setState('ready');setPage(0)}}catch(e){if(!control.signal.aborted){setError(e.message||'Could not load the Sentinel archive.');setState('error')}}
 }
 useEffect(()=>{let live=true;arcgis().then(async({IdentityManager})=>{try{await IdentityManager.checkSignInStatus('https://www.arcgis.com/sharing');if(live)retrieve()}catch{if(live)setState('signedOut')}}).catch(e=>{if(live){setState('error');setError(e.message)}});return()=>{live=false;active.current?.abort()}},[]);
 async function connect(){try{setError('');const {IdentityManager}=await arcgis();await IdentityManager.getCredential('https://www.arcgis.com/sharing');retrieve()}catch(e){setState('signedOut');setError(e.message||'Sign-in was cancelled.')}}
 const windowRange=archive?.window||archiveWindow();
 const filtered=useMemo(()=>archive?.scenes.filter(s=>(filter==='all'||new Date(s.date).getUTCFullYear()===Number(filter))&&s.name.toLowerCase().includes(search.toLowerCase()))||[],[archive,filter,search]);
 const years=[...new Set(archive?.scenes.map(s=>new Date(s.date).getUTCFullYear())||[])];
 function exportCatalogue(){const blob=new Blob([JSON.stringify(archive,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='lough-neagh-living-atlas-scenes.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 return <section className="archive-panel"><div className="card-heading"><div><div className="eyebrow">ARCGIS LIVING ATLAS · SENTINEL-2 LEVEL-2A</div><h2><Satellite size={20}/> Full scene archive</h2></div><button className="button" disabled={state==='loading'||state==='checking'} onClick={state==='signedOut'?connect:retrieve}>{state==='signedOut'?<LogIn size={15}/>:<RefreshCw size={15}/>}{state==='signedOut'?'Sign in to ArcGIS':'Refresh archive'}</button></div>
 <p className="live-note">{windowRange.start} – {windowRange.end} · cloud cover strictly below 25% · scene footprints intersecting the Lough Neagh study area</p>
 <p className="live-note">Cloud percentage describes the whole satellite scene, not cloud directly over the lake. Each catalogue record is retained; overlapping tiles are not merged. Choose True colour or NDCI for any scene. NDCI displays a water-masked relative chlorophyll signal; switch views in Map layers.</p>
 {state==='signedOut'&&<div className="access-note"><strong>Connect your ArcGIS subscription</strong><p>Living Atlas requires an entitled ArcGIS account. Sign in securely with ArcGIS to retrieve every matching record. No archive has been loaded yet.</p><small>Your account must have access to Living Atlas subscriber imagery.</small></div>}
 {(state==='loading'||state==='checking')&&<p role="status">{state==='checking'?'Checking ArcGIS connection…':'Loading all matching scene IDs and catalogue pages…'}</p>}
 {error&&<p role="alert" className="data-error">{error} <button onClick={connect}>Sign in again</button></p>}
 {archive&&<><div className="archive-tools"><strong>{archive.scenes.length} matching scenes</strong><label>Year <select value={filter} onChange={e=>{setFilter(e.target.value);setPage(0)}}><option value="all">All years</option>{years.map(y=><option key={y}>{y}</option>)}</select></label><input aria-label="Search scene name" placeholder="Search scene name" value={search} onChange={e=>{setSearch(e.target.value);setPage(0)}}/><button className="button" onClick={exportCatalogue}><Download size={14}/> Export catalogue</button></div>
 <div className="scene-table"><table><thead><tr><th>Acquired (UTC)</th><th>Scene</th><th>Scene cloud</th><th>Map</th></tr></thead><tbody>{filtered.slice(page*12,page*12+12).map(s=><tr key={s.id} className={activeId===s.id?'active-scene':''}><td>{new Date(s.date).toISOString().slice(0,16).replace('T',' ')}</td><td>{s.name}</td><td>{Number(s.cloud).toFixed(1)}%</td><td><div className="scene-actions"><button className="button" onClick={()=>onPick({...s,service:archive.service},'rgb')}>True colour</button><button className="button" onClick={()=>onPick({...s,service:archive.service},'ndci')}>NDCI</button>{activeId===s.id&&<small>On map</small>}</div></td></tr>)}</tbody></table></div>
 {!filtered.length&&<p>No scenes match these filters.</p>}<div className="pagination"><button disabled={page===0} onClick={()=>setPage(p=>p-1)}>Previous</button><span>{filtered.length?`${page*12+1}–${Math.min(page*12+12,filtered.length)} of ${filtered.length}`:'0 scenes'}</span><button disabled={(page+1)*12>=filtered.length} onClick={()=>setPage(p=>p+1)}>Next</button></div><p className="live-note">Complete ID count verified against retrieved records · loaded {new Date(archive.loadedAt).toLocaleString('en-GB',{timeZone:'Europe/Dublin'})} (Ireland time)</p></>}
 <a className="attribution-link" href="https://www.arcgis.com/home/item.html?id=255af1ceee844d6da8ef8440c8f90d00" target="_blank" rel="noreferrer">Living Atlas Sentinel-2 imagery · Esri / Copernicus ↗</a></section>
}
