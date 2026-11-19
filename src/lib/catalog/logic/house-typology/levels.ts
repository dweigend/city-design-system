import { STORY } from '../../data/grid';
import { fieldLevel } from './fields';
import { branchLevel } from './branches';
import { bellGarden } from './bell';
import { clusterLevel } from './cluster';
import { courtLevel } from './court';
import { ringLevel } from './ring';
import { packedBodies } from './packing';
import { courseIndices, hasFloor } from './courses';
import { podLevel } from './pod';
import { collapse } from './collapse';
import { bodySpec,objectSlot,worldSize } from './objects';
import type { Body,Level,Plan,Point } from './types';

function useAt({site,type,seed}:Plan,i:number) {
	const paint=site.programme[i];
	const domain = site.living.has(i)?['living' as const]:[...new Set(paint)];
	return collapse(site.id+'/part/use/'+i,seed,type,domain.map(u=>[u,paint.filter(p=>p===u).length]));
}
const kinds: Partial<Record<Body['kind'],Level['kind']>> = {
	reservoir:'rack',capsule:'capsule',solar:'solar',grove:'grove',dome:'dome',lookout:'lookout'
};
function rectangular(plan:Plan,row:Body[],i:number,z:number):Level {
	const {site,sign,rear}=plan;
	const edges=(axis:0|1,side:number) => row.map(b=>b.position[axis]+side*worldSize(b)[axis]/2);
	const left=Math.min(...edges(0,-1)),right=Math.max(...edges(0,1));
	const inner=sign>0 ? Math.min(...edges(1,-1)):Math.max(...edges(1,1));
	const width=right-left+0.6,depth=Math.abs(rear-inner)+0.3;
	const x=(left+right)/2,y=rear-sign*depth/2;
	const outline:Point[]=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>[x+u*width/2,y+v*depth/2,z]);
	return {position:[x,y,z],width,depth,round:false,deckArea:width*depth,outline,
		programme:site.programme[i],use:row[0].use,kind:kinds[row[0].kind]??'workshop',
		bodies:row,landing:[x,rear-sign*0.625,z]};
}
function covered(level: Level) {
	const area=level.bodies.reduce((sum,b)=>sum+b.size[0]*b.size[1],0);
	const share=area/level.deckArea;
	return share>=0.55 && share<=0.85;
}
const special:Partial<Record<Plan['type'],typeof ringLevel>>={'cluster-mast':clusterLevel,'round-tower':ringLevel,'courtyard-house':courtLevel};
function planLevel(plan:Plan,i:number):Level {
	const {site,type}=plan,use=useAt(plan,i),z=plan.datum+i*STORY;
	if(site.compact) return podLevel(plan,i,use);
	if(type==='tree-house') return branchLevel(plan,i,use);
	const build=special[type];
	if(build) return build(plan,i,z,use);
	return infillLevel(plan,i,z,use);
}
function infillLevel(plan:Plan,i:number,z:number,use:Body['use']):Level {
	const {site,type}=plan;
	const spec=bodySpec(type,use,i);
	const first=objectSlot(site.id+'/level/'+i+'/body/0',spec,use,plan.seed,0);
	const row=type==='bell-house' && i===site.programme.length-1 ? bellGarden(plan,i,z) : packedBodies(plan,i,first,z);
	if (!row.length) return podLevel(plan,i,use);
	const level=rectangular(plan,row,i,z);
	const fitted=['rack','twin-stack'].includes(type) ? fieldLevel(plan,level) : level;
	return !hasFloor(plan,i) || covered(fitted) ? fitted : podLevel(plan,i,use);
}

/** Groups the complete painted programme onto the occupied courses of this typology. */
export function occupiedLevels(plan: Plan) {
	const ordered = courseIndices(plan), rows = plan.site.programme;
	return ordered.map((i,k) => ({
		...planLevel(plan,i), programme: rows.slice(k ? i : 0, ordered[k+1] ?? rows.length).flat()
	}));
}
