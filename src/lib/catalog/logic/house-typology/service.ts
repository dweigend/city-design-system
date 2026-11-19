import { STORY } from '../../data/grid';
import { mounted,objectSlot } from './objects';
import type { Level, Plan } from './types';

/** Mounts a stock outlet on a cistern with enough headroom below the next deck. */
export function tankOutlet(plan:Plan,levels:Level[]) {
	if(plan.type!=='water-house') return [];
	const tank=levels[0].bodies.find(b=>b.objectId.startsWith('kit-cistern-plinth'));
	if(!tank) return [];
	const valve=objectSlot(tank.id+'/outlet',['kit-pipe-valve-0p5m','short-neck','reservoir'],'water',plan.seed,0);
	const z=tank.position[2]+tank.size[2];
	const next=levels[1]?.position[2] ?? plan.site.base+plan.site.programme.length*STORY;
	if(z+valve.size[2]>next-1.1) return [];
	valve.position=[tank.position[0],tank.position[1],z];
	return [{slot:valve,solid:mounted(valve,plan.site.ground,'service')}];
}
