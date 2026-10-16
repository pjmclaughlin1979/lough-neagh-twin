import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleSeries,comparison,chartSegments,initialRows,seriesCsv,seriesKey} from '../src/ndci-series.js';
import {startArcgisSession,PORTAL_SHARING} from '../src/arcgis-auth.js';
const point={longitude:-6.4,latitude:54.61};
const scenes=[3,1,2,4].map(id=>({id,date:Date.UTC(2023+id,0,1),name:`S2A_scene_${id}`,cloud:5,service:'https://example.org/ImageServer'}));
function storage(){const data=new Map();return {getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)}}

test('automatically requests ArcGIS login once, avoids cancellation redirect loops, and allows explicit retry',async()=>{
 const store=storage();let prompts=0;
 const identity={checkSignInStatus:async()=>{throw Error('Signed out')},getCredential:async url=>{assert.equal(url,PORTAL_SHARING);prompts++;throw Error('Cancelled')}};
 await assert.rejects(startArcgisSession(identity,store),/Cancelled/);
 assert.equal(await startArcgisSession(identity,store),false);
 assert.equal(prompts,1);
 await assert.rejects(startArcgisSession(identity,store,{force:true}),/Cancelled/);
 assert.equal(prompts,2);
});

test('valid ArcGIS session is reused and storage failures do not cause automatic redirect loops',async()=>{
 let prompts=0;const identity={checkSignInStatus:async()=>{},getCredential:async()=>{prompts++}};
 assert.equal(await startArcgisSession(identity,storage()),true);assert.equal(prompts,0);
 identity.checkSignInStatus=async()=>{throw Error('Signed out')};
 assert.equal(await startArcgisSession(identity,{getItem(){throw Error('Blocked')}}),false);
 assert.equal(await startArcgisSession(identity,storage(),{automatic:false}),false);
 assert.equal(prompts,0);
 assert.equal(await startArcgisSession(identity,storage(),{automatic:false,force:true}),true);assert.equal(prompts,1);
});

test('samples the identical point for each scene, limits concurrency, retains masked/error/zero and caches only completed results',async()=>{
 const cache=new Map(),signal=new AbortController().signal,results=[],resolvers=[];let inFlight=0,peak=0,calls=0;
 const request=async(url,options)=>{
  calls++;inFlight++;peak=Math.max(peak,inFlight);
  const geometry=JSON.parse(options.query.geometry);assert.deepEqual([geometry.x,geometry.y],[point.longitude,point.latitude]);
  const id=JSON.parse(options.query.mosaicRule).lockRasterIds[0];
  await new Promise(resolve=>resolvers.push(resolve));inFlight--;
  if(id===4)throw Error('Network failure');
  return {data:{value:id===1?'0':id===2?'NoData':'0.4'}};
 };
 const run=sampleSeries({request,scenes,point,signal,cache,concurrency:2,onResult:r=>results.push(r)});
 await new Promise(setImmediate);assert.equal(calls,2);resolvers.splice(0).forEach(r=>r());
 await new Promise(setImmediate);assert.equal(calls,4);resolvers.splice(0).forEach(r=>r());await run;
 assert.equal(peak,2);assert.equal(cache.size,3);
 const rows=initialRows(scenes,point,cache);
 assert.deepEqual(rows.map(r=>r.scene.id),[1,2,3,4]);
 assert.deepEqual(rows.map(r=>r.status),['valid','masked','valid','pending']);assert.equal(rows[0].value,0);
 assert.equal(results.find(r=>r.scene.id===4).status,'error');
 let retryCalls=0;
 await sampleSeries({request:async()=>{retryCalls++;return {data:{value:'0.5'}}},scenes,point,signal,cache});assert.equal(retryCalls,1);
 assert.notEqual(seriesKey(scenes[0],point),seriesKey(scenes[0],{...point,longitude:-6.41}));
 assert.notEqual(seriesKey(scenes[0],point),seriesKey({...scenes[0],service:'https://other.org'},point));
});

test('aborting a point selection suppresses late results and unscheduled requests',async()=>{
 const control=new AbortController(),results=[];let calls=0,resolve;
 const request=async()=>{calls++;await new Promise(r=>{resolve=r});return {data:{value:'0.2'}}};
 const cache=new Map(),run=sampleSeries({request,scenes,point,signal:control.signal,cache,concurrency:1,onResult:r=>results.push(r)});
 await new Promise(setImmediate);control.abort();resolve();await run;
 assert.equal(calls,1);assert.equal(results.length,0);assert.equal(cache.size,0);
});

test('comparison uses earliest/latest valid values, preserves zero, breaks chart paths at missing scenes and exports gaps',()=>{
 const ordered=[...scenes].sort((a,b)=>a.date-b.date);
 const rows=ordered.map((scene,i)=>({scene,status:i===1?'masked':'valid',value:i===1?null:i===0?0:i===2?0.3:-0.1}));
 const summary=comparison(rows);assert.equal(summary.direction,'lower');assert.equal(summary.delta,-0.1);assert.equal(summary.first.scene.id,1);assert.equal(summary.last.scene.id,4);
 assert.deepEqual(chartSegments(rows).map(s=>s.map(r=>r.scene.id)),[[1],[3,4]]);
 assert.equal(comparison([rows[0]]),null);
 assert.equal(comparison([rows[0],{...rows[2],scene:{...rows[2].scene,date:rows[0].scene.date}}]),null);
 const csv=seriesCsv(rows,point);assert.ok(csv.includes('"0","valid"'));assert.ok(csv.includes('"","masked"'));
 assert.ok(csv.includes('2024-01-01T00:00:00.000Z'));assert.ok(!csv.includes('undefined'));
});
