import { objectSlot } from './objects';
import type { HouseUse } from '../../data/house-body';
import type { Body,Level,Plan,Point } from './types';

/** Forms a pinwheel of four occupied wings, leaving an open garden at every level. */
export function courtLevel(plan: Plan,i: number,z: number,use: HouseUse): Level {
	const {site,sign,rear} = plan;
	const span = Math.min(site.width-0.6,site.depth-site.accessDepth-1.55);
	const n = Math.max(1,Math.round((span-2.5)/7.5));
	const nominal = [10,7.5,5].find(l=>(l*n+2.5)*0.85<=span) ?? 5;
	const scale = Math.min(1.15,span/(nominal*n+2.5));
	const length = nominal*scale,depth = 2.5*scale, wing = n*length;
	const side = depth+wing, [x] = site.center,y = rear-sign*(1.25+side/2);
	const door = use==='living' ? (Math.floor(i/4)%2 ? 'porthole' : 'ribbon') : 'door';
	const id = site.id+'/level/'+i+'/body/';
	const base = objectSlot(id+'0',['kit-capsule-'+door+'-'+String(nominal).replace('.','p')+'m','round-shoulder',use==='living'?'capsule':'workshop'],use,plan.seed,0);
	const bodies: Body[] = Array.from({length:n*4},(_,k)=>{
		const face=Math.floor(k/n),a=face*Math.PI/2, c=Math.round(Math.cos(a)),s=Math.round(Math.sin(a));
		const u= -side/2 + length*(k%n+0.5), v=-wing/2;
		return {...base,id:id+k,rotation:a,scale,size:base.nativeSize.map(m=>m*scale) as Point,
			position:[x+c*u-s*v,y+s*u+c*v,z+0.12]};
	});
	const width = side+0.6, d=side+1.55, cy=rear-sign*d/2;
	const hole = wing-depth-0.6;
	return {position:[x,cy,z],width,depth:d,round:false,
		deckArea:width*d-hole*hole,outline:[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>[x+u*width/2,cy+v*d/2,z]),
		court:{center:[x,y,z],width:hole}, bodies,landing:[x,y+sign*(hole/2+0.2),z],
		programme:site.programme[i],use,kind:use==='living'?'capsule':'workshop'};
}
