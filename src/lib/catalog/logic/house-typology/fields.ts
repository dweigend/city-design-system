import { worldSize } from './objects';
import type { Level,Plan,Point } from './types';

/** Cuts away the empty frame bays while preserving one rear gallery across the two banks. */
export function fieldLevel(plan:Plan,l:Level):Level {
	const {rear,sign,site}=plan,[cx]=site.center,z=l.position[2];
	const boxes=l.bodies.map(b=>{
		const [w,d]=worldSize(b);
		return {left:b.position[0]-w/2-0.3,right:b.position[0]+w/2+0.3,depth:(rear-b.position[1])*sign+d/2+0.3};
	});
	const left=Math.min(cx-1,...boxes.map(b=>b.left)),right=Math.max(cx+1,...boxes.map(b=>b.right));
	const xs=[...new Set([left,right,...boxes.flatMap(b=>[b.left,b.right])])].sort((a,b)=>a-b);
	const outline:Point[]=[[left,rear,z]];
	let area=0;
	for(let i=1;i<xs.length;i++){
		const a=xs[i-1],b=xs[i],mid=(a+b)/2;
		const depth=Math.max(1.25,...boxes.filter(box=>box.left<mid && box.right>mid).map(box=>box.depth));
		area+=(b-a)*depth;
		const y=rear-sign*depth;
		outline.push([a,y,z],[b,y,z]);
	}
	outline.push([right,rear,z]);
	if(sign<0) outline.reverse();
	return {...l,position:[(left+right)/2,l.position[1],z],width:right-left,outline,field:true,deckArea:area,landing:[cx,rear-sign*0.625,z]};
}
