import type { EnsembleContext } from './ensemble';
import type { Survey } from './survey';
import { collapse } from './collapse';
import type { Plan } from './types';
import type { Typology } from './families';

const bars: Partial<Record<Typology,number>>={'portal-house':0.3,'bridge-house':0.3,'lattice-head':0.3};

function rearOffset(site:Survey,type:Typology) {
	if(site.compact) return Math.min(site.depth,3.6)-site.depth/2;
	if(type==='cluster-mast' || type==='tree-house') return 0.15;
	if(type==='round-tower') return 0.41*Math.min(site.width,site.depth,20);
	return site.depth/2-site.accessDepth;
}

/** Locates the frame and access band against the fixed ensemble decision. */
export function layout(site:Survey,context:EnsembleContext) {
	const fixed=context.houses.get(site.id);
	if(!fixed) throw new RangeError('Site outside ensemble: '+site.id);
	const {typology:type,role,away}=fixed;
	const accessSide = site.compact && away[1] ? (away[1]>0?'south':'north') :
		collapse('part/side/'+site.id,context.seed,type,[['north',1],['south',1]] as const);
	const sign=accessSide==='north'?1:-1;
	const plan:Plan={site,type,sign,away,datum:context.datum,seed:site.seed,
		rear:site.center[1]+sign*rearOffset(site,type),bar:bars[type]??0.12};
	return {plan,role,accessSide};
}
