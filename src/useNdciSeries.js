import {useEffect,useRef,useState} from 'react';
import {arcgisSdk} from './arcgis-auth';
import {initialRows,sampleSeries,seriesKey} from './ndci-series';
export default function useNdciSeries(scenes,point,connected){
 const cache=useRef(new Map()),[snapshot,setSnapshot]=useState({key:'',rows:[]}),[revision,setRevision]=useState(0);
 const key=connected&&point?scenes.map(scene=>seriesKey(scene,point)).join(';'):'';
 useEffect(()=>{
  const control=new AbortController();
  if(!point||!scenes.length||!connected){setSnapshot({key:'',rows:[]});return()=>control.abort()}
  setSnapshot({key,rows:initialRows(scenes,point,cache.current)});
  arcgisSdk().then(({request})=>{
   if(control.signal.aborted)return;
   return sampleSeries({request,scenes,point,signal:control.signal,cache:cache.current,onResult:row=>setSnapshot(old=>old.key===key?{key,rows:old.rows.map(r=>r.scene.id===row.scene.id?row:r)}:old)});
  }).catch(e=>{if(!control.signal.aborted)setSnapshot(old=>old.key===key?{key,rows:old.rows.map(r=>r.status==='pending'?{...r,status:'error',error:e.message}:r)}:old)});
  return()=>control.abort();
 },[scenes,point,connected,revision,key]);
 const rows=!key?[]:snapshot.key===key?snapshot.rows:initialRows(scenes,point,cache.current);
 return {rows,retry:()=>setRevision(n=>n+1)};
}
