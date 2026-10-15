"""Create reproducible NDCI/RGB snapshots from public Sentinel-2 COGs.
Run: .venv/bin/python scripts/process_satellite.py
Output grid: EPSG:4326, approx 60m; no calibrated concentration inference.
"""
import json, pathlib, requests, numpy as np, rasterio
from rasterio.vrt import WarpedVRT
from rasterio.enums import Resampling
from rasterio.transform import from_bounds
from PIL import Image
OUT=pathlib.Path(__file__).resolve().parents[1]/'public/data'
BBOX=[-6.65,54.43,-6.18,54.80]
W,H=530,690
TRANSFORM=from_bounds(*BBOX,W,H)
# Conservative study area polygon; not an official shoreline. SCL further masks land.
from rasterio.features import geometry_mask
POLYGON={'type':'Polygon','coordinates':[[[-6.51,54.76],[-6.40,54.77],[-6.32,54.73],[-6.23,54.73],[-6.22,54.67],[-6.27,54.60],[-6.28,54.51],[-6.32,54.46],[-6.40,54.47],[-6.47,54.49],[-6.54,54.49],[-6.59,54.53],[-6.58,54.62],[-6.54,54.68],[-6.51,54.76]]]}
roi=geometry_mask([POLYGON],out_shape=(H,W),transform=TRANSFORM,invert=True)
def band(f,key):
    asset=f['assets'][key]
    with rasterio.open(asset['href']) as ds:
        with WarpedVRT(ds,crs='EPSG:4326',transform=TRANSFORM,width=W,height=H,resampling=Resampling.nearest if key=='scl' else Resampling.bilinear) as vrt:
            raw=vrt.read(1).astype('float32')
    if key=='scl':return raw
    meta=asset.get('raster:bands',[{}])[0]
    # Legacy COGs may retain source-JP2 offsets in asset metadata.
    # Honor explicit BOA-applied flag to avoid subtracting the offset twice.
    offset=0 if f['properties'].get('earthsearch:boa_offset_applied') else meta.get('offset',0)
    return np.where(raw>0,raw*meta.get('scale',.0001)+offset,np.nan)
frames=[]
for year in [2023,2024,2025]:
    response=requests.get('https://earth-search.aws.element84.com/v1/search',params={'collections':'sentinel-2-l2a','bbox':','.join(map(str,BBOX)),'datetime':f'{year}-06-01T00:00:00Z/{year}-09-30T23:59:59Z','limit':100},timeout=60);response.raise_for_status()
    payload=response.json();features=payload['features']
    while any(l.get('rel')=='next' for l in payload.get('links',[])):
        link=next(l for l in payload['links'] if l.get('rel')=='next');r=requests.get(link['href'],timeout=60);r.raise_for_status();payload=r.json();features+=payload['features']
    candidates=[f for f in features if '_29UPA_' in f['id'] and all(k in f['assets'] for k in ['red','rededge1','scl','green','blue'])]
    f=min(candidates,key=lambda f:f['properties'].get('eo:cloud_cover',100))
    print(year,f['id'],f['properties']['eo:cloud_cover'],flush=True)
    (OUT/f'source-{year}.json').write_text(json.dumps(f))
    scl=band(f,'scl');red=band(f,'red');edge=band(f,'rededge1');green=band(f,'green');blue=band(f,'blue')
    with np.errstate(invalid='ignore',divide='ignore'):ndci=(edge-red)/(edge+red)
    valid=(scl==6)&roi&np.isfinite(ndci)&(red>0)&(edge>0)
    frames.append((year,f,valid,ndci,red,green,blue))
reference=np.logical_or.reduce([x[2] for x in frames])
Image.fromarray((reference*255).astype('uint8')).save(OUT/'reference-water-mask.png')
records=[]
for year,f,valid,ndci,red,green,blue in frames:
    valid &= reference
    stops=np.array([[21,76,100],[85,183,161],[184,217,107],[239,190,77],[216,97,62]])
    t=np.clip((np.nan_to_num(ndci,nan=0,posinf=1,neginf=-1)+.2)/.6,0,1)*4
    colors=np.stack([np.interp(t,np.arange(5),stops[:,i]) for i in range(3)],axis=-1)
    rgba=np.dstack([colors,valid*220]).astype('uint8');Image.fromarray(rgba).save(OUT/f'ndci-{year}.png')
    rgb=np.stack([red,green,blue],axis=-1);rgb=(np.clip(np.nan_to_num(rgb)/.28,0,1)**(1/1.4)*255).astype('uint8');Image.fromarray(rgb).save(OUT/f'rgb-{year}.png')
    records.append({'year':year,'date':f['properties']['datetime'],'id':f['id'],'bounds':BBOX,'median':float(np.median(ndci[valid])),'validPercent':float(valid.sum()/reference.sum()*100),'validPixels':int(valid.sum()),'referencePixels':int(reference.sum()),'tileCloudCover':f['properties']['eo:cloud_cover'],'ndci':f'ndci-{year}.png','rgb':f'rgb-{year}.png','resolution':'Approx. 60 m display grid; B05 native 20 m','source':f'https://earth-search.aws.element84.com/v1/collections/sentinel-2-l2a/items/{f["id"]}'})
(OUT/'scenes.json').write_text(json.dumps(records,indent=2))
print(json.dumps(records,indent=2),flush=True)
