import React from 'react';
import {Download,RefreshCw} from 'lucide-react';
import {chartSegments,comparison,seriesCsv} from './ndci-series';
import {dateLabel} from './data';
const dateTime=v=>new Date(v).toISOString().slice(0,16).replace('T',' ');
export default function NdciChart({scenes,point,rows,activeId,onPick,onRetry,onClear}){
 const pending=rows.filter(r=>r.status==='pending').length,valid=rows.filter(r=>r.status==='valid'),failed=rows.filter(r=>r.status==='error').length,summary=comparison(rows);
 const W=900,H=280,L=65,R=25,T=25,B=55;
 const start=scenes[0]?.date||0,end=scenes.at(-1)?.date||start;
 const low=Math.min(-0.2,...valid.map(r=>r.value)),high=Math.max(0.4,...valid.map(r=>r.value));
 const x=d=>end===start?(L+W-R)/2:L+(d-start)/(end-start)*(W-L-R),y=v=>H-B-(v-low)/(high-low)*(H-T-B);
 const ticks=Array.from({length:5},(_,i)=>low+(high-low)*i/4);
 function download(){const url=URL.createObjectURL(new Blob([seriesCsv(rows,point)],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='lough-neagh-point-ndci.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 return <section className="ndci-series" aria-label="NDCI through time">
  <div className="card-heading"><div><div className="eyebrow">SAME LOCATION · EVERY CHOSEN ACQUISITION</div><h2>Relative chlorophyll through time</h2></div>{point&&<div className="series-actions"><button className="button" disabled={!!pending} onClick={onRetry}><RefreshCw size={14}/> Retry readings</button><button className="button" disabled={!rows.length||!!pending} onClick={download}><Download size={14}/> Export readings</button><button onClick={onClear}>Clear location</button></div>}</div>
  {!scenes.length?<p className="empty">Choose and load multiple scenes from the archive to start comparing.</p>:!point?<p className="empty">Click a location on the lake. NDCI will be calculated for that same location in all {scenes.length} loaded scenes, in either map display mode.</p>:<>
   <p className="live-note"><strong>{point.latitude.toFixed(5)}° N, {Math.abs(point.longitude).toFixed(5)}° W</strong> · nominal 20 m sampling · {valid.length} valid / {scenes.length} chosen · {pending?`${pending} readings pending`:'all requests finished'}{failed?` · ${failed} requests failed`:''}</p>
   <div className="comparison-note" role="status">{pending?'Calculating NDCI for every chosen scene…':summary?<><strong>{summary.direction==='unchanged at displayed precision'?'No change at displayed precision':`Latest valid signal is ${summary.direction}`}</strong><span>Δ NDCI {summary.delta>=0?'+':''}{summary.delta.toFixed(4)} · {dateLabel(summary.first.scene.date)} to {dateLabel(summary.last.scene.date)} · earliest and latest valid observations at this point</span></>:<><strong>At least two valid readings are needed to compare.</strong><span>Masked or unavailable values are excluded; they are never treated as zero.</span></>}</div>
   <div className="time-chart">
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="NDCI values by acquisition date; gaps indicate masked, failed or pending readings">
     <text transform={`translate(16 ${H/2}) rotate(-90)`} textAnchor="middle" className="axis-title">NDCI (dimensionless)</text>
     {ticks.map(v=><g key={v}><line x1={L} x2={W-R} y1={y(v)} y2={y(v)} className="grid-line"/><text x={L-10} y={y(v)+4} textAnchor="end">{v.toFixed(2)}</text></g>)}
     <line x1={L} x2={W-R} y1={H-B} y2={H-B} className="axis-line"/>
     {(end===start?[start]:[start,start+(end-start)/3,start+2*(end-start)/3,end]).map((d,i)=><text key={i} x={x(d)} y={H-B+24} textAnchor={i===0&&end!==start?'start':i===3?'end':'middle'}>{dateLabel(d)}</text>)}
     <text x={(L+W-R)/2} y={H-5} textAnchor="middle">Acquired (UTC) · actual elapsed time</text>
     {chartSegments(rows).filter(s=>s.length>1).map((segment,i)=><polyline key={i} points={segment.map(r=>`${x(r.scene.date)},${y(r.value)}`).join(' ')} className="series-line"/>)}
     {rows.map(r=><g key={r.scene.id} role="button" tabIndex={0} aria-label={`${dateTime(r.scene.date)} UTC, ${r.status==='valid'?`NDCI ${r.value.toFixed(4)}`:r.status}, show scene on map`} aria-pressed={r.scene.id===activeId} onClick={()=>onPick(r.scene.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onPick(r.scene.id)}}} className="chart-point">
      <title>{r.scene.name}{'\n'}{dateTime(r.scene.date)} UTC · {r.status==='valid'?`NDCI ${r.value.toFixed(4)}`:r.status==='masked'?'No valid water pixel':r.status==='error'?'Request failed':'Pending'} · {Number(r.scene.cloud).toFixed(1)}% scene cloud</title>
      {r.status==='valid'?<><circle cx={x(r.scene.date)} cy={y(r.value)} r={13} fill="transparent"/><circle cx={x(r.scene.date)} cy={y(r.value)} r={r.scene.id===activeId?7:5} className={r.scene.id===activeId?'active-point':'valid-point'}/></>:<rect x={x(r.scene.date)-5} y={H-B-5} width={10} height={10} className={r.scene.id===activeId?'active-point':'missing-point'}/>}
     </g>)}
    </svg>
   </div>
   <p className="live-note">● Valid NDCI · □ Masked / failed / pending (symbol is not a zero value). Gaps break the line. Click a chart point or table date to show that acquisition on the map. Closely timed scenes can overlap; use the table to select each separately.</p>
   <div className="scene-table series-table"><table><thead><tr><th>Acquired (UTC)</th><th>Satellite / scene ID</th><th>Scene cloud</th><th>NDCI</th><th>Reading status</th></tr></thead><tbody>{rows.map(r=><tr key={r.scene.id} className={r.scene.id===activeId?'active-scene':''}><td><button className="table-date" aria-pressed={r.scene.id===activeId} onClick={()=>onPick(r.scene.id)}>{dateTime(r.scene.date)}</button></td><td><span title={r.scene.name}>{r.scene.name.slice(0,3)} · {r.scene.id}</span></td><td>{Number(r.scene.cloud).toFixed(1)}%</td><td>{r.status==='valid'?r.value.toFixed(4):'—'}</td><td>{r.status==='valid'?'Valid water pixel':r.status==='masked'?'Masked / no coverage':r.status==='pending'?'Calculating…':<span title={r.error}>Request failed · retry</span>}</td></tr>)}</tbody></table></div>
   <p className="live-note">This compares the selected pixel, not a lake-wide average or a fitted trend. Season, atmosphere, turbidity and shoreline effects can affect NDCI. Water masking can exclude dense blooms. NDCI is a relative optical signal, not chlorophyll concentration or toxicity.</p>
  </>}
 </section>
}
