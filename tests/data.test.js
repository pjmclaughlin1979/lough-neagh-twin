import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {reportsInYear,monthCounts} from '../src/data.js';
test('annual filters respect UTC year boundaries and monthly counts conserve reports',()=>{
 const f=[Date.UTC(2023,11,31,23,59),Date.UTC(2024,0,1),Date.UTC(2024,11,31,23,59)].map(t=>({properties:{DateLatestConfirmedReport:t}}));
 assert.equal(reportsInYear(f,2024).length,2);assert.deepEqual(monthCounts(reportsInYear(f,2024)),[1,0,0,0,0,0,0,0,0,0,0,1]);
});
test('DAERA snapshot contains genuine positioned dated records in the study management area',()=>{
 const data=JSON.parse(fs.readFileSync('public/data/algae.geojson'));assert(data.features.length>0);assert(!data.exceededTransferLimit);
 for(const f of data.features){assert.equal(f.properties.LocalManagementArea.trim(),'Lough Neagh');assert(Number.isFinite(f.properties.DateLatestConfirmedReport));assert(f.geometry.coordinates[0]<-6);}
 assert.equal(monthCounts(data.features).reduce((a,b)=>a+b,0),data.features.length);
});
test('satellite records have provenance, valid coverage and real assets',()=>{
 const scenes=JSON.parse(fs.readFileSync('public/data/scenes.json'));assert.equal(scenes.length,3);
 for(const s of scenes){assert(s.median>=-1&&s.median<=1);assert(s.validPercent>0&&s.validPercent<=100);assert(s.validPixels<=s.referencePixels);assert(s.validPixels>10000, "Too few valid lake pixels: check calibration");assert.equal(new Date(s.date).getUTCFullYear(),s.year);assert(fs.statSync('public/data/'+s.ndci).size>1000);assert(fs.statSync('public/data/'+s.rgb).size>1000);assert(s.source.startsWith('https://earth-search.aws.element84.com/'));}
});
