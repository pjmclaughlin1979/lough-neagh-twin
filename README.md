# Lough Neagh Environmental Twin

React 19 + Vite, ArcGIS Maps SDK for JavaScript **5.1**, loaded through Esri's pinned CDN and `$arcgis.import`. No ArcGIS API key is required for the public reference imagery and the locally processed overlays used here.

## Run

```
npm install
npm run dev
npm run build
npm test
```

## What is connected

- DAERA/NIEA confirmed blue-green algae public FeatureServer, filtered to `LocalManagementArea = 'Lough Neagh'`. Refreshes on opening and on request, with a dated bundled fallback. Queries paginate. Observations available in this layer cover 2024–2026. Reports are not area or severity measurements.
- Copernicus Sentinel-2 L2A COGs via Element 84 Earth Search. Real June–September low-cloud scenes selected for 2023–2025. Exact scene IDs, dates, bounds, coverage and median NDCI are in `public/data/scenes.json`; full source STAC records are retained alongside the image assets.
- DfI water-level published snapshot, 15 October 2026: 12.464 m OD Belfast. Not a live feed or historical level matched to satellite dates.
- DAERA near-shore chemistry and probe downloads, and AFBI/NIEA monitoring programme references are in the source catalogue. The download portal returned HTTP 403; those sensor data have not been ingested.

## Satellite reproducibility and limitations

```
python3 -m venv .venv
.venv/bin/pip install -r scripts/requirements.txt
.venv/bin/python scripts/process_satellite.py
npm test
npm run build
```

The processor searches summer scenes in tile 29UPA, selects the lowest tile cloud percentage, reads public COG windows and applies the asset scale and offset, with offset zero when `earthsearch:boa_offset_applied` is true (the legacy COG metadata retains the source JP2 offset). Lake-centre spot checks confirmed corrected DN values of 92/145 for B04/B05 in 2023; subtracting another 1000 DN would be erroneous. B04/B05 are bilinearly resampled onto a common approximately 60 m EPSG:4326 display grid. NDCI = (B05 − B04)/(B05 + B04). SCL is resampled with nearest neighbour. Only class 6 water with finite positive reflectance contributes. A conservative manually specified study polygon excludes unrelated waters; it is not an authoritative lake boundary. The fixed reference water mask is the union of valid water across the three scenes inside that polygon. Coverage is relative to this reference, not the full lake area. Dense blooms classified as vegetation/land may be excluded. Valid pixels can differ across scenes; medians must not be interpreted as a lake-wide trend.

NDCI is a chlorophyll-related optical proxy, not a calibrated concentration, cyanobacteria classification, toxin measurement or swimming-safety decision. Display range −0.2 to 0.4 is not a risk threshold. Three summer snapshots are not an annual time series. Shore adjacency, atmospheric correction, suspended sediments and cloud classification affect results. This observation dashboard is a digital-twin prototype, not a validated hydrodynamic or predictive model.

## Sources

- https://custom-scripts.sentinel-hub.com/custom-scripts/sentinel-2/ndci/

- https://www.daera-ni.gov.uk/articles/lough-neagh-additional-resources-including-data-downloads
- https://services-eu1.arcgis.com/kswen6BYexuc1SUk/arcgis/rest/services/BGA_Confirmed_Locations_PublicView/FeatureServer/0
- https://www.infrastructure-ni.gov.uk/articles/lough-neagh-levels
- https://earth-search.aws.element84.com/v1/collections/sentinel-2-l2a
- https://github.com/Element84/earth-search/blob/main/docs/collections/sentinel-2-l2a.md
- https://documentation.dataspace.copernicus.eu/APIs/STAC.html
- https://www.daera-ni.gov.uk/sites/default/files/2026-04/Appendix%203.PDF

Contains modified Copernicus Sentinel data. Preserve source attribution and review source licence terms before further redistribution. Network access is needed for Esri SDK/basemap, fonts and live DAERA refresh; historical overlays and fallback reports are packaged locally.

The 2022 candidate was excluded because its calibration metadata was inconsistent with lake pixel values; it is not used in the published analysis.

## GitHub Pages

The Pages workflow tests and builds on pushes to `main`, then publishes `dist`. Relative Vite asset paths support repository subpaths. In GitHub Settings → Pages, the build source is GitHub Actions.
