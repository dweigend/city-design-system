import {STORY} from '../../data/grid';
import type {HouseSite} from '../composed-house';
import {planEnsemble,type EnsembleContext} from './ensemble';
import {survey} from './survey';
import {collapse} from './collapse';
import {planLevel,type Plan} from './levels';
import {bearings,tierParts} from './frame';
import {solid,objectSlot,crownSpec,mounted} from './objects';
import type {HouseComposition,Point,Port} from './types';
function crownParts(plan:Plan,below:number,role:HouseComposition['role'],stations:number[]){
 const {site,seed,rear,type}=plan,z=below+STORY+(role==='high'?STORY/2:0);
 const crown=objectSlot(site.id+'/crown',crownSpec(type),'energy',seed,0);
 const [w,d]=crown.size,x=site.center[0],y=rear-plan.sign*d/2;
 crown.position=[x,y,z];crown.anchor='roof';
 const deck=solid(site.id+'/roof','deck',[x,y,z-.25],[Math.max(w+.6,stations.at(-1)!-stations[0]+.4),d+.6,.25],site.ground,'deck');
 return {crown,parts:[...bearings(plan,site.id+'/roof',below,z-.25,stations),deck,mounted(crown,site.ground,'crown')]};
}
/** Composes one painted site against the frozen ensemble; a singleton uses the same three layers. */
export function composeHouse(input:HouseSite,context:EnsembleContext=planEnsemble([input])):HouseComposition{
 const site=survey(input),fixed=context.houses.get(site.id);
 if(!fixed)throw new RangeError('Site outside ensemble: '+site.id);
 const {role,typology:type}=fixed;
 const accessSide=collapse('part/side/'+site.id,context.seed,type,[['north',1],['south',1]] as const);
 const sign=accessSide==='north'?1:-1,bar=type==='lattice-head'||type==='portal-house'?.3:.12;
 const plan={site,type,seed:context.seed,sign,datum:context.datum,rear:site.center[1]+sign*3,bar};
 const levels=site.programme.map((_,i)=>planLevel(plan,i));
 const x=site.center[0],stations=[x-.625,x+.625];
 const parts=levels.flatMap((l,i)=>tierParts(plan,l,i,levels[i-1]?.position[2]??site.ground,stations));
 const last=levels[levels.length-1],roof=crownParts(plan,last.position[2],role,stations);
 parts.push(...roof.parts);
 const supports=parts.filter(p=>['foot','shaft','head','brace'].includes(p.joint));
 const ports:Port[]=levels.flatMap((l,level)=>[-1,1].map(side=>({level,position:[l.position[0]+side*l.width/2,l.landing[1],l.landing[2]] as Point})));
 return {id:site.id,role,typology:type,cells:site.cells,datum:context.datum,ground:site.ground,accessSide,
 family:{bar,radius:bar===.3?.45:.15,parapet:bar===.3?'panel':'rail'},
 core:{position:[x,plan.rear-sign*.15,site.ground],width:1.25+bar},levels,parts,supports,ports,crown:roof.crown};
}
