// REST raster function JSON; convert with RasterFunction.fromJSON for the SDK.
export const STUDY_POLYGON={rings:[[[-6.51,54.76],[-6.40,54.77],[-6.32,54.73],[-6.23,54.73],[-6.22,54.67],[-6.27,54.60],[-6.28,54.51],[-6.32,54.46],[-6.40,54.47],[-6.47,54.49],[-6.54,54.49],[-6.59,54.53],[-6.58,54.62],[-6.54,54.68],[-6.51,54.76]]],spatialReference:{wkid:4326}};
export const NDCI_RANGE=[-0.2,0.4];
const STOPS=[[21,76,100],[85,183,161],[184,217,107],[239,190,77],[216,97,62]];
const fn=(rasterFunction,rasterFunctionArguments,outputPixelType='F32')=>({rasterFunction,rasterFunctionArguments,outputPixelType});
export function sceneMosaic(id){
 if(!Number.isSafeInteger(id)||id<0)throw Error('A valid archive scene ID is required.');
 return {mosaicMethod:'esriMosaicLockRaster',lockRasterIds:[id],mosaicOperation:'MT_FIRST'};
}
export function ndciColor(value){
 const t=Math.max(0,Math.min(1,(value-NDCI_RANGE[0])/(NDCI_RANGE[1]-NDCI_RANGE[0])))*4;
 const i=Math.min(3,Math.floor(t)),w=t-i;
 return STOPS[i].map((v,c)=>Math.round(v+(STOPS[i+1][c]-v)*w));
}
export function ndciRule(id){
 sceneMosaic(id);
 // $<id> addresses the original scene, bypassing the default RGB template.
 // Living Atlas applies the source scale/offset to surface reflectance already.
 const raster=`$${id}`;
 const bands=fn('ExtractBand',{Raster:raster,BandIDs:[3,4],MissingBandAction:1});
 const positive=fn('Mask',{Raster:bands,IncludedRanges:[1e-8,1e38,1e-8,1e38],NoDataInterpretation:0});
 const index=fn('BandArithmetic',{Raster:positive,Method:0,BandIndexes:'(B2-B1)/(B2+B1)'});
 // SCL is band 15 (zero-based 14), categorical: nearest-neighbour only.
 const scl=fn('ExtractBand',{Raster:raster,BandIDs:[14],MissingBandAction:1});
 const water=fn('Remap',{Raster:scl,InputRanges:[6,7],OutputValues:[1],AllowUnmatched:false},'U8');
 const masked=fn('Arithmetic',{Raster:index,Raster2:water,Operation:3,ExtentType:1,CellsizeType:2});
 return fn('Clip',{Raster:masked,ClippingGeometry:STUDY_POLYGON,ClippingType:1});
}
export function ndciDisplayRule(id){
 const stretched=fn('Stretch',{Raster:ndciRule(id),StretchType:5,Statistics:[[...NDCI_RANGE,0,1]],Min:0,Max:255,DRA:false,UseGamma:false},'U8');
 return fn('Colormap',{Raster:stretched,Colormap:Array.from({length:256},(_,i)=>[i,...ndciColor(NDCI_RANGE[0]+i/255*(NDCI_RANGE[1]-NDCI_RANGE[0]))])},'U8');
}
export function parseNdciValue(value){
 if(Array.isArray(value))value=value.length===1?value[0]:null;
 if(!['number','string'].includes(typeof value)||String(value).trim()==='')return null;
 const n=Number(value);
 return Number.isFinite(n)&&n>=-1&&n<=1?n:null;
}
export function insideStudyArea(longitude,latitude){
 const ring=STUDY_POLYGON.rings[0];let inside=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const [xi,yi]=ring[i],[xj,yj]=ring[j];
  if((yi>latitude)!==(yj>latitude)&&longitude<(xj-xi)*(latitude-yi)/(yj-yi)+xi)inside=!inside;
 }
 return inside;
}
export async function identifyNdci(request,scene,point,signal){
 if(!insideStudyArea(point.longitude,point.latitude))return null;
 const {data}=await request(`${scene.service}/identify`,{method:'post',responseType:'json',signal,timeout:20000,query:{
  f:'json',geometry:JSON.stringify({x:point.longitude,y:point.latitude,spatialReference:{wkid:4326}}),geometryType:'esriGeometryPoint',
  mosaicRule:JSON.stringify(sceneMosaic(scene.id)),renderingRule:JSON.stringify(ndciRule(scene.id)),
  returnGeometry:false,returnCatalogItems:false,interpolation:'RSP_NearestNeighbor',
  pixelSize:JSON.stringify({x:20,y:20,spatialReference:{wkid:32629}})
 }});
 if(data.error)throw Error(data.error.message||'NDCI pixel request failed.');
 return parseNdciValue(data.value);
}
