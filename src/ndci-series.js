import {identifyNdci} from './atlas-raster.js';
export function chronological(scenes){return [...scenes].sort((a,b)=>a.date-b.date||a.id-b.id)}
export function seriesKey(scene,point){return `${scene.service}|${scene.id}|${point.longitude}|${point.latitude}|20m-water-v1`}
export function initialRows(scenes,point,cache){return chronological(scenes).map(scene=>({scene,...(cache.get(seriesKey(scene,point))||{status:'pending',value:null})}))}
export async function sampleSeries({request,scenes,point,signal,cache=new Map(),onResult=()=>{},concurrency=4}){
 const ordered=chronological(scenes);let cursor=0;
 async function worker(){
  while(cursor<ordered.length&&!signal.aborted){
   const scene=ordered[cursor++],key=seriesKey(scene,point);let result=cache.get(key);
   if(!result){
    try{const value=await identifyNdci(request,scene,point,signal);result={status:value===null?'masked':'valid',value}}
    catch(e){if(signal.aborted)return;result={status:'error',value:null,error:e.message||'Request failed'}}
    if(signal.aborted)return;
    if(result.status!=='error'){
     if(cache.size>=512)cache.delete(cache.keys().next().value);
     cache.set(key,result);
    }
   }
   if(!signal.aborted)onResult({scene,...result});
  }
 }
 await Promise.all(Array.from({length:Math.min(Math.max(1,concurrency),ordered.length)},worker));
}
export function comparison(rows){
 const valid=rows.filter(r=>r.status==='valid'&&Number.isFinite(r.value));
 if(valid.length<2)return null;
 const first=valid[0],last=valid.at(-1),delta=last.value-first.value;
 return {first,last,delta,direction:Math.abs(delta)<0.00005?'unchanged at displayed precision':delta>0?'higher':'lower',count:valid.length};
}
export function chartSegments(rows){
 const paths=[];let current=[];
 for(const row of rows){if(row.status==='valid'){current.push(row)}else if(current.length){paths.push(current);current=[]}}
 if(current.length)paths.push(current);
 return paths;
}
export function seriesCsv(rows,point){
 const fields=['acquired_utc','scene_id','scene_name','scene_cloud_percent','longitude','latitude','ndci','status','error','source'];
 const quote=v=>`"${String(v??'').replaceAll('"','""')}"`;
 return [fields,...rows.map(r=>[new Date(r.scene.date).toISOString(),r.scene.id,r.scene.name,r.scene.cloud,point.longitude,point.latitude,r.status==='valid'?r.value:'',r.status,r.error||'',r.scene.service])].map(row=>row.map(quote).join(',')).join('\r\n');
}
