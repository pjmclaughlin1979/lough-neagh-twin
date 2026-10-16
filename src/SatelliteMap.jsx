import React,{useEffect,useRef,useState} from 'react';
import {Info,LocateFixed,Plus,Minus,X} from 'lucide-react';
import {ndciDisplayRule,sceneMosaic} from './atlas-raster';
import {LOUGH_BOUNDS} from './live-data';
import {dateLabel} from './data';
export default function SatelliteMap({scene,display,opacity,reports,showReports,point,reading,onPoint,onReport,selected,onCloseReport,onClearPoint,onMethodology}){
 const container=useRef(null),view=useRef(null),sdk=useRef(null),overlay=useRef(null),reportLayer=useRef(null),pointLayer=useRef(null),callbacks=useRef(null);
 const [ready,setReady]=useState(false),[status,setStatus]=useState('Loading ArcGIS 5.1…'),[error,setError]=useState('');
 callbacks.current={onPoint,onReport,canSample:!!scene};
 useEffect(()=>{
  let cancelled=false,v;
  (async()=>{
   for(let i=0;i<200&&!window.$arcgis;i++)await new Promise(r=>setTimeout(r,100));
   if(!window.$arcgis)throw Error('ArcGIS SDK unavailable');
   const [Map,MapView,TileLayer,GraphicsLayer,Graphic,ImageryLayer,RasterFunction,request]=await window.$arcgis.import(['@arcgis/core/Map.js','@arcgis/core/views/MapView.js','@arcgis/core/layers/TileLayer.js','@arcgis/core/layers/GraphicsLayer.js','@arcgis/core/Graphic.js','@arcgis/core/layers/ImageryLayer.js','@arcgis/core/layers/support/RasterFunction.js','@arcgis/core/request.js']);
   if(cancelled)return;sdk.current={Graphic,ImageryLayer,RasterFunction,request};
   const map=new Map({layers:[new TileLayer({url:'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer'})]});
   reportLayer.current=new GraphicsLayer();pointLayer.current=new GraphicsLayer();map.addMany([reportLayer.current,pointLayer.current]);
   v=new MapView({container:container.current,map,center:[-6.4,54.61],zoom:10,spatialReference:{wkid:3857},ui:{components:[]},constraints:{minZoom:8,maxZoom:17}});view.current=v;
   await v.when();if(cancelled)return;setReady(true);
   v.on('click',async e=>{
    const hit=await v.hitTest(e);if(cancelled)return;
    const report=hit.results.find(r=>r.graphic?.attributes?.SiteName);
    callbacks.current.onReport(report?.graphic.attributes||null);
    if(callbacks.current.canSample&&e.mapPoint)callbacks.current.onPoint({longitude:e.mapPoint.longitude,latitude:e.mapPoint.latitude});
   });
  })().catch(e=>{if(!cancelled)setError('Map unavailable: '+e.message)});
  return()=>{cancelled=true;v?.destroy();view.current=null;overlay.current=null};
 },[]);
 useEffect(()=>{
  if(!ready)return;const {Graphic}=sdk.current;reportLayer.current.removeAll();reportLayer.current.visible=showReports;
  reportLayer.current.addMany(reports.filter(f=>f.geometry).map(f=>new Graphic({geometry:{type:'point',longitude:f.geometry.coordinates[0],latitude:f.geometry.coordinates[1]},attributes:f.properties,symbol:{type:'simple-marker',size:9,color:'#f4c568',outline:{color:'#42331d',width:1.5}}})));
 },[ready,reports,showReports]);
 useEffect(()=>{
  if(!ready)return;pointLayer.current.removeAll();if(!point)return;
  pointLayer.current.add(new sdk.current.Graphic({geometry:{type:'point',...point},symbol:{type:'simple-marker',style:'cross',size:17,color:'#f9fcff',outline:{color:'#115b9a',width:3}}}));
 },[ready,point]);
 useEffect(()=>{
  if(!ready)return;const map=view.current.map,control=new AbortController();
  if(overlay.current){map.remove(overlay.current);overlay.current.destroy();overlay.current=null}setError('');
  if(!scene||display==='base'){setStatus('ArcGIS 5.1 · reference basemap');return}
  const {ImageryLayer,RasterFunction,request}=sdk.current,rule=display==='ndci'?ndciDisplayRule(scene.id):{rasterFunction:'Natural Color for Visualization'};
  const layer=new ImageryLayer({url:scene.service,opacity,format:'png32',interpolation:'nearest',mosaicRule:{method:'lock-raster',lockRasterIds:[scene.id],mosaicOperation:'first'},rasterFunction:RasterFunction.fromJSON(rule)});
  overlay.current=layer;map.add(layer,1);setStatus('Processing selected acquisition…');
  (async()=>{
   await layer.load();if(control.signal.aborted)return;
   const {xmin,ymin,xmax,ymax}=LOUGH_BOUNDS;
   const {data}=await request(`${scene.service}/exportImage`,{method:'post',responseType:'json',signal:control.signal,timeout:30000,query:{f:'json',bbox:`${xmin},${ymin},${xmax},${ymax}`,bboxSR:4326,imageSR:3857,size:'192,192',format:'png32',transparent:true,interpolation:'RSP_NearestNeighbor',mosaicRule:JSON.stringify(sceneMosaic(scene.id)),renderingRule:JSON.stringify(rule)}});
   if(data.error||!data.href)throw Error(data.error?.message||'The imagery service did not return an image');
   if(!control.signal.aborted)setStatus(`Living Atlas · ${display==='ndci'?'water-masked NDCI':'true colour'} · scene ${scene.id}`);
  })().catch(e=>{if(!control.signal.aborted){layer.visible=false;setError('Selected scene unavailable: '+e.message);setStatus('Imagery unavailable · choose another scene or sign in again')}});
  return()=>control.abort();
 },[ready,scene,display]);
 useEffect(()=>{if(overlay.current)overlay.current.opacity=opacity},[opacity]);
 const pointValue=!reading||reading.status==='pending'?'Calculating…':reading.status==='error'?'Reading failed':reading.status==='masked'?'No valid water pixel':reading.value.toFixed(4);
 return <section className="map-panel" id="comparison-map">
  <div className="map-top"><div><span className="live-dot"/> Spatial observatory <span className="subtle">/ Lough Neagh</span></div><button onClick={onMethodology}>How to read this map <Info size={14}/></button></div>
  {error&&<p className="data-error" role="alert">{error}</p>}
  <div className="map-wrap"><div ref={container} className="map"/>
   <div className="map-title"><span className="eyebrow">{scene&&display!=='base'?`LIVING ATLAS · ${display==='ndci'?'RELATIVE CHLOROPHYLL':'TRUE COLOUR'}`:'ESRI WORLD IMAGERY'}</span><strong>{scene&&display!=='base'?dateLabel(scene.date):'Reference basemap'}</strong><small>{scene&&display!=='base'?`${new Date(scene.date).toISOString().slice(11,16)} UTC · ${Number(scene.cloud).toFixed(1)}% scene cloud`:'Choose archive scenes to begin'}</small></div>
   <div className="map-controls"><button aria-label="Zoom in" onClick={()=>view.current?.goTo({zoom:view.current.zoom+1})}><Plus size={17}/></button><button aria-label="Zoom out" onClick={()=>view.current?.goTo({zoom:view.current.zoom-1})}><Minus size={17}/></button><button aria-label="Reset map extent" onClick={()=>view.current?.goTo({center:[-6.4,54.61],zoom:10})}><LocateFixed size={17}/></button></div>
   <div className="legend"><strong>{scene&&display==='ndci'?'NDCI · relative chlorophyll signal':scene&&display==='rgb'?'True colour · selected acquisition':'Reference basemap'}</strong>{scene&&display==='ndci'&&<><div className="gradient"/><div className="legend-scale"><span>−0.2 lower</span><span>0.4 higher</span></div></>}<span className="legend-dot">● <span>DAERA reports · chosen report year</span></span><small>＋ Sampled location · all loaded scenes</small></div>
   {point&&scene&&!selected&&<div className="ndci-map-readout"><button aria-label="Clear sampled location" onClick={onClearPoint}><X size={14}/></button><span className="eyebrow">SELECTED ACQUISITION · NDCI</span><strong>{pointValue}</strong><small>{point.latitude.toFixed(5)}° N, {Math.abs(point.longitude).toFixed(5)}° W</small><small>{reading?.status==='masked'?'Masked or missing data':'Time chart compares all loaded scenes'}</small></div>}
   {selected&&<div className="map-popup"><button aria-label="Close report" onClick={onCloseReport}><X size={16}/></button><span className="eyebrow">NIEA CONFIRMED REPORT</span><h3>{selected.SiteName}</h3><p>{dateLabel(selected.DateLatestConfirmedReport)}</p><small>{selected.CouncilArea}</small></div>}
   <div className="map-status">{status}</div>
  </div>
 </section>
}
