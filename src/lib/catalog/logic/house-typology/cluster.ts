import { objectSlot,worldSize } from './objects';
import type { HouseUse } from '../../data/house-body';
import type { Level,Plan,Point } from './types';

/** One tangential capsule per quarter turn. Its console connects the cradle to the common mast. */
export function clusterLevel(plan:Plan,i:number,z:number,use:HouseUse):Level {
	const {site}=plan,[cx,cy]=site.center,angle=i*Math.PI/2;
	const u=Math.round(Math.cos(angle)),v=Math.round(Math.sin(angle));
	const id=site.id+'/level/'+i+'/body/0';
	const length = Math.min(site.width,site.depth)>=12 ? 10 : 5;
	const body=objectSlot(id,['kit-capsule-ribbon-'+length+'m','round-shoulder','capsule'],use,plan.seed,angle+Math.PI/2);
	const span = u ? site.width : site.depth;
	const reach=Math.min(3.25,span/2-1.25);
	body.position=[cx+u*reach,cy+v*reach,z+0.12];
	body.facing=[-u,-v];
	const [bw,bd]=worldSize(body);
	const width = u ? reach+2.15 : 2.2, depth = v ? reach+2.15 : 1.65;
	const x=cx+u*(reach/2+0.175),y=cy+v*(reach/2+0.175);
	const outline: Point[]=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>[x+a*width/2,y+b*depth/2,z]);
	return {position:[x,y,z],width,depth,outline,round:false,deckArea:width*depth,
		landing:[body.position[0]-u*bw/2,body.position[1]-v*bd/2,z],
		bodies:[body],use,kind:'capsule',programme:site.programme[i]};
}
