import {test} from 'node:test';
import assert from 'node:assert/strict';
import {archiveWindow,loadArchive,forecastDays,weatherLabel,LOUGH_BOUNDS} from '../src/live-data.js';
const meta={maxRecordCount:2,fields:[{name:'objectid',type:'esriFieldTypeOID'},{name:'acquisitiondate'},{name:'cloudcover'},{name:'name'},{name:'category'}]};
test('three-year window uses Irish calendar day and clamps leap dates',()=>{
 assert.deepEqual(archiveWindow(new Date('2026-10-15T12:00:00Z')),{start:'2023-10-15',end:'2026-10-15',exclusiveEnd:'2026-10-16'});
 assert.equal(archiveWindow(new Date('2024-02-29T12:00:00Z')).start,'2021-02-28');
 assert.equal(archiveWindow(new Date('2026-06-01T23:30:00Z')).end,'2026-06-02');
});
test('retrieves every scene in ID batches with strict cloud and spatial filters',async()=>{
 const calls=[];const request=async(url,q)=>{calls.push(q);if(!url.endsWith('/query'))return meta;if(q.returnIdsOnly)return {objectIds:[1,2,3,4,5]};return {features:q.objectIds.split(',').map(id=>({attributes:{objectid:Number(id),acquisitiondate:Date.UTC(2025,1,Number(id)),cloudcover:24.9,name:`scene ${id}`}}))}};
 const r=await loadArchive(request,'https://example.test/ImageServer',new Date('2026-10-15T12:00:00Z'));
 assert.equal(r.scenes.length,5);assert.equal(calls.length,5);assert.match(calls[1].where,/cloudcover < 25/);assert.match(calls[1].where,/2023-10-15/);assert.deepEqual(JSON.parse(calls[1].geometry),LOUGH_BOUNDS);assert.equal(calls[1].spatialRel,'esriSpatialRelIntersects');assert.deepEqual(r.scenes.map(s=>s.id),[5,4,3,2,1]);
});
test('refuses to label a partial catalogue complete',async()=>{
 let count=0;await assert.rejects(loadArchive(async()=>++count===1?meta:count===2?{objectIds:[1,2]}:{features:[]},'https://example.test'),/incomplete/);
 await assert.rejects(loadArchive(async(url,q)=>q.returnIdsOnly?{objectIds:[1],exceededTransferLimit:true}:meta,'https://example.test'),/truncated/);
});
test('forecast excludes today, returns five days and preserves missing observations',()=>{
 const daily={time:['2026-10-15','2026-10-16','2026-10-17','2026-10-18','2026-10-19','2026-10-20'],temperature_2m_max:[1,2,3,4,5,6]};
 const days=forecastDays({daily});assert.equal(days.length,5);assert.equal(days[0].date,'2026-10-16');assert.equal(days[4].temperature_2m_max,6);assert.equal(days[0].precipitation_sum,null);assert.equal(weatherLabel(95),'Thunderstorms');assert.throws(()=>forecastDays({daily:{time:[]}}),/incomplete/);
});
