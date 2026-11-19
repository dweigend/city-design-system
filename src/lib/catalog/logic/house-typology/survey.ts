import type {HouseSite} from '../composed-house';
import {STORY} from '../../data/grid';
/** Surveys stable site identity, actual painted storeys and the dominant ground-plane axis. */
export function survey(site:HouseSite) {
 const cells=[...site.cells].sort((a,b)=>a.id.localeCompare(b.id));
 const rows=cells.map(c=>site.stacks.get(c.id)??[]);
 const start=Math.min(...rows.map(row=>row.findIndex(Boolean)).filter(i=>i>=0));
 const end=Math.max(...rows.map(row=>row.length));
 if(!Number.isFinite(start)||end<=start) throw new RangeError('Empty painted site');
 const programme=Array.from({length:end-start},(_,i)=>rows.map(r=>r[start+i]).filter(Boolean));
 if(programme.some(p=>!p.length)) throw new RangeError('Unpainted interior storey');
 const axis=(i:0|1)=>{const a=cells.flatMap(c=>c.corners.map(p=>p[i]));return Math.max(...a)-Math.min(...a);};
 const width=axis(0), depth=axis(1);
 const cx=cells.reduce((s,c)=>s+c.center[0],0)/cells.length,cy=cells.reduce((s,c)=>s+c.center[1],0)/cells.length;
 const anchor=cells.reduce((a,b)=>Math.hypot(b.center[0]-cx,b.center[1]-cy)<Math.hypot(a.center[0]-cx,a.center[1]-cy)?b:a);
 const ground=anchor.pad;
 return {id:cells[0].id+(start?'@'+start:''),cells,programme,ground,start,base:ground+start*STORY,
 width,depth,elongated:Math.max(width,depth)>1.5*Math.min(width,depth),center:anchor.center,
 district:site.district??'infill',seed:site.seed};
}
export type Survey=ReturnType<typeof survey>;
