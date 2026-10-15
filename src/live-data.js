export const SENTINEL_URL='https://sentinel.imagery1.arcgis.com/arcgis/rest/services/Sentinel2L2A/ImageServer';
export const LOUGH_BOUNDS={xmin:-6.65,ymin:54.43,xmax:-6.18,ymax:54.80,spatialReference:{wkid:4326}};
export function archiveWindow(now=new Date()){
 const end=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Dublin',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const [y,m,d]=end.split('-').map(Number);const days=new Date(Date.UTC(y-3,m,0)).getUTCDate();
 const start=`${y-3}-${String(m).padStart(2,'0')}-${String(Math.min(d,days)).padStart(2,'0')}`;
 const next=new Date(`${end}T00:00:00Z`);next.setUTCDate(next.getUTCDate()+1);
 return {start,end,exclusiveEnd:next.toISOString().slice(0,10)};
}
export function schemaFields(metadata){
 const fields=metadata.fields||[];
 const find=(names)=>fields.find(f=>names.some(n=>f.name.toLowerCase()===n.toLowerCase()))?.name;
 const result={id:metadata.objectIdField||fields.find(f=>f.type==='esriFieldTypeOID')?.name,date:find(['AcquisitionDate','acquisitiondate','acquisition_date']),cloud:find(['CloudCover','cloudcover','Cloud_Cover']),name:find(['Name','ProductName','SceneID']),category:find(['Category'])};
 if(!result.id||!result.date||!result.cloud)throw Error('The service does not expose the expected Sentinel acquisition-date and cloud-cover fields.');
 return result;
}
function checked(json){if(json?.error)throw Error(json.error.message||'ArcGIS request failed');return json;}
export async function loadArchive(request,url=SENTINEL_URL,now=new Date(),signal){
 const metadata=checked(await request(url,{f:'json'},signal));const fields=schemaFields(metadata);const window=archiveWindow(now);
 const where=`${fields.cloud} >= 0 AND ${fields.cloud} < 25 AND ${fields.date} >= timestamp '${window.start} 00:00:00' AND ${fields.date} < timestamp '${window.exclusiveEnd} 00:00:00'${fields.category?` AND ${fields.category} = 1`:''}`;
 const filter={f:'json',where,geometry:JSON.stringify(LOUGH_BOUNDS),geometryType:'esriGeometryEnvelope',inSR:4326,spatialRel:'esriSpatialRelIntersects'};
 const idsResponse=checked(await request(`${url}/query`,{...filter,returnIdsOnly:true},signal));
 if(!Array.isArray(idsResponse.objectIds))throw Error('The service did not return a complete scene ID list.');
 if(idsResponse.exceededTransferLimit)throw Error('The service truncated the ID list; a complete archive cannot be confirmed.');
 const ids=[...new Set(idsResponse.objectIds)];const records=[];
 const size=Math.max(1,Math.min(100,metadata.maxRecordCount||100));
 for(let i=0;i<ids.length;i+=size){
  const batch=checked(await request(`${url}/query`,{...filter,objectIds:ids.slice(i,i+size).join(','),outFields:'*',returnGeometry:false},signal));
  if(batch.exceededTransferLimit)throw Error('A scene page was truncated; please retry with another service configuration.');
  records.push(...(batch.features||[]).map(f=>({id:f.attributes[fields.id],date:f.attributes[fields.date],cloud:f.attributes[fields.cloud],name:f.attributes[fields.name]||`Scene ${f.attributes[fields.id]}`,attributes:f.attributes})));
 }
 const scenes=[...new Map(records.map(s=>[s.id,s])).values()].sort((a,b)=>b.date-a.date||b.id-a.id);
 if(scenes.length!==ids.length)throw Error('The archive changed during retrieval or a page is incomplete. Refresh to retry.');
 return {scenes,window,service:url,loadedAt:new Date().toISOString(),functions:metadata.rasterFunctionInfos||[]};
}
export function weatherLabel(code){
 if(code===0)return 'Clear sky';if([1,2].includes(code))return 'Partly cloudy';if(code===3)return 'Overcast';if([45,48].includes(code))return 'Fog';if([51,53,55,56,57].includes(code))return 'Drizzle';if([61,63,65,66,67].includes(code))return 'Rain';if([71,73,75,77,85,86].includes(code))return 'Snow';if([80,81,82].includes(code))return 'Rain showers';if([95,96,99].includes(code))return 'Thunderstorms';return 'Unavailable';
}
export function forecastDays(data){
 if(data.error||!Array.isArray(data.daily?.time)||data.daily.time.length<6)throw Error('The weather service returned an incomplete five-day forecast.');
 const fields=['weather_code','temperature_2m_max','temperature_2m_min','precipitation_sum','precipitation_probability_max','wind_speed_10m_max','wind_direction_10m_dominant'];
 return data.daily.time.slice(1,6).map((date,i)=>Object.fromEntries([['date',date],...fields.map(k=>[k,data.daily[k]?.[i+1]??null]) ]));
}
export const WEATHER_URL='https://api.open-meteo.com/v1/forecast?'+new URLSearchParams({latitude:'54.61',longitude:'-6.4',daily:'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_direction_10m_dominant',timezone:'Europe/Dublin',forecast_days:'6',wind_speed_unit:'kmh'});
