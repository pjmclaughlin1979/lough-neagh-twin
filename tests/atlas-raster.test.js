import test from 'node:test';
import assert from 'node:assert/strict';
import {ndciRule,ndciDisplayRule,ndciColor,identifyNdci,parseNdciValue,insideStudyArea,sceneMosaic} from '../src/atlas-raster.js';

test('NDCI template uses original red/red-edge bands and water-only SCL, without display scaling',()=>{
 const rule=ndciRule(42),masked=rule.rasterFunctionArguments.Raster;
 assert.equal(rule.rasterFunction,'Clip');
 assert.equal(masked.rasterFunctionArguments.CellsizeType,2);
 const {Raster:index,Raster2:water}=masked.rasterFunctionArguments;
 assert.equal(index.outputPixelType,'F32');
 assert.equal(index.rasterFunctionArguments.BandIndexes,'(B2-B1)/(B2+B1)');
 const positive=index.rasterFunctionArguments.Raster;
 assert.deepEqual(positive.rasterFunctionArguments.IncludedRanges,[1e-8,1e38,1e-8,1e38]);
 assert.deepEqual(positive.rasterFunctionArguments.Raster.rasterFunctionArguments.BandIDs,[3,4]);
 assert.equal(positive.rasterFunctionArguments.Raster.rasterFunctionArguments.Raster,'$42');
 assert.deepEqual(water.rasterFunctionArguments.InputRanges,[6,7]);
 assert.equal(water.rasterFunctionArguments.AllowUnmatched,false);
 assert.deepEqual(water.rasterFunctionArguments.Raster.rasterFunctionArguments.BandIDs,[14]);
 assert.equal(water.rasterFunctionArguments.Raster.rasterFunctionArguments.Raster,'$42');
 assert.ok(!JSON.stringify(rule).includes('Stretch'));
 assert.throws(()=>ndciRule(NaN));
});

test('display uses the same fixed scale and colours for every acquisition',()=>{
 const a=ndciDisplayRule(42),b=ndciDisplayRule(43);
 assert.deepEqual(a.rasterFunctionArguments.Colormap,b.rasterFunctionArguments.Colormap);
 assert.equal(a.rasterFunctionArguments.Colormap.length,256);
 const stretch=a.rasterFunctionArguments.Raster.rasterFunctionArguments;
 assert.deepEqual(stretch.Statistics[0].slice(0,2),[-0.2,0.4]);
 assert.equal(stretch.DRA,false);
 assert.deepEqual(ndciColor(-0.2),[21,76,100]);
 assert.deepEqual(ndciColor(0.4),[216,97,62]);
 assert.deepEqual(ndciColor(0.9),ndciColor(0.4));
 assert.deepEqual(ndciColor(-0.8),ndciColor(-0.2));
});

test('pixel inspection preserves zero and out-of-display-range values, excludes NoData',async()=>{
 for(const missing of [null,undefined,'','NoData','nan',[],[1,2],-3.402823466e38,true])assert.equal(parseNdciValue(missing),null);
 assert.equal(parseNdciValue('0'),0);
 assert.equal(parseNdciValue('0.7'),0.7);
 const scene={id:42,service:'https://example.org/ImageServer'},point={longitude:-6.4,latitude:54.61},signal=new AbortController().signal;
 let calls=0;
 const request=async(url,options)=>{
  calls++;assert.equal(url,scene.service+'/identify');assert.equal(options.signal,signal);
  assert.deepEqual(JSON.parse(options.query.mosaicRule),sceneMosaic(42));
  assert.deepEqual(JSON.parse(options.query.renderingRule),ndciRule(42));
  assert.equal(options.query.returnCatalogItems,false);
  return {data:{value:'0.7'}};
 };
 assert.equal(await identifyNdci(request,scene,point,signal),0.7);
 assert.equal(await identifyNdci(request,scene,{longitude:-7,latitude:54.61},signal),null);
 assert.equal(calls,1);
 assert.equal(insideStudyArea(-6.4,54.61),true);
 assert.equal(await identifyNdci(async()=>({data:{value:'NoData'}}),scene,point,signal),null);
 await assert.rejects(identifyNdci(async()=>({data:{error:{message:'Access denied'}}}),scene,point,signal),/Access denied/);
});
