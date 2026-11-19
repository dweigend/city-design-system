import { objectSlot } from './objects';
import type { Level, Plan, Point } from './types';
import type { HouseUse } from '../../data/house-body';

/** Seats one glazed circular cabin on the carrier, reserving a rear strip for its mast. */
export function podLevel(plan:Plan,i:number,use:HouseUse): Level {
	const {site,sign,rear}=plan;
	const z=plan.datum+i*4;
	const b=objectSlot(site.id+'/level/'+i+'/body/0',['kit-crown-lantern-2p5m','tall',use==='living'?'capsule':'workshop'],use,plan.seed,0);
	const scale=Math.max(0.85,Math.min(1,site.width/2.5,(site.depth-0.5)/2.5));
	b.scale=scale;
	b.size=b.nativeSize.map(v=>v*scale) as Point;
	const [w,d]=b.size;
	const width=Math.min(site.width,w+0.6);
	const depth=Math.min(site.depth,d+1.25);
	const [cx,cy]=site.center;
	const y=rear-sign*depth/2;
	const band=Math.min(0.9,Math.max(0.25,depth-d));
	const shift=(side:0|1) => {
		const span=side===0?site.width:site.depth;
		const need=Math.max(0,(b.size[side]-span)/2);
		return need*plan.away[side];
	};
	b.position=[cx+shift(0),cy+shift(1),z+0.12];
	if(depth>=d+0.25 || !plan.away[1]) b.position[1]=rear-sign*(band+d/2);
	b.facing=[0,sign];
	const outline:Point[]=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>[cx+u*width/2,y+v*depth/2,z]);
	return {position:[cx,y,z],width,depth,round:false,deckArea:width*depth,outline,bodies:[b],kind:use==='living'?'capsule':'workshop',use,programme:site.programme[i],landing:[cx,rear-sign*band/2,z]};
}
