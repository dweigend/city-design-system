import type { TerrainGrid,TerrainCell } from '../terrain-grid';
import {seamVertices} from './seam-incidence';
const cache=new WeakMap<TerrainGrid,Map<string,string>>();
function boundary(grid:TerrainGrid,start:TerrainCell,seen:Set<string>){
 const queue=[start],edges=[];
 seen.add(start.id);
 for(let i=0;i<queue.length;i++){
 const cell=queue[i];
 for(const [side,id] of cell.neighbors.entries()){
 const n=id?grid.cellsById.get(id):undefined;
 if(n?.plan.square){
 if(!seen.has(n.id)){seen.add(n.id);queue.push(n);}
 continue;
 }
 const a=cell.corners[side],b=cell.corners[(side+1)%4];
 edges.push({id:JSON.stringify(seamVertices(cell,side)),street:n?.plan.kind==='alley'||n?.plan.kind==='stairAlley',river:n?.zone==='water'||n?.plan.kind==='riversidePromenade',x:(a[0]+b[0])/2,y:(a[1]+b[1])/2,cx:cell.center[0],cy:cell.center[1]});
 }
 }
 return edges.sort((a,b)=>Number(b.street)-Number(a.street)||(a.id<b.id?-1:1));
}
/** Reserves one deterministic access and an opposite river-facing side per connected court. */
export function courtOpenings(grid:TerrainGrid){
 const saved=cache.get(grid);
 if(saved)return saved;
 const result=new Map<string,string>(),seen=new Set<string>();
 for(const cell of grid.cells){
 if(!cell.plan.square||seen.has(cell.id))continue;
 const edges=boundary(grid,cell,seen),entry=edges[0];
 if(!entry)continue;
 result.set(entry.id,'square-access');
 const dist=(e:typeof entry)=>Math.hypot(e.x-entry.x,e.y-entry.y);
 const river=edges.filter(e=>e.river && (e.x-entry.x)*(entry.cx-entry.x)+(e.y-entry.y)*(entry.cy-entry.y)>0).sort((a,b)=>dist(b)-dist(a))[0];
 if(river)result.set(river.id,'river-opening');
 }
 cache.set(grid,result);
 return result;
}
