import { defineRules, weightedForm } from '../../core/neighbourhood';
import { required } from '../required';
import type { HouseUse } from '../../data/house-body';

const sides = ['west','south','east','north'] as const;
export type HouseSide=(typeof sides)[number];
type Bed={side:HouseSide;level:number};

/** Collapse one fixture address against its remaining surveyed domain. */
function choose<T extends string>(choices:readonly T[],id:string,seed:number){
 const contacts=Object.fromEntries(choices.map(c=>[c,choices]));
 const node={id,form:choices[0],district:'house',neighbors:[null,null,null]};
 const target=defineRules({contacts}).solve([id],new Map([[id,node]]),seed).get(id)?.target;
 return required(choices.find(c=>c===target),'eligible house fitting');
}
function gardenLevels(uses:HouseUse[][]){
 const middle=uses.length===2?[0]:uses.slice(1,-1).map((_,i)=>i+1);
 return middle.sort((a,b)=>Number(uses[b].includes('food'))-Number(uses[a].includes('food')));
}
/** Resolves the stair face, plan displacement and independently addressed planting brackets. */
export function houseAspect(id:string,stories:number,uses:HouseUse[][],seed:number){
 const stair=choose(sides,id+'/access',seed);
 const offset=choose(sides,id+'/cantilever',seed);
 const levels=gardenLevels(uses);
 const count=stories<3?0:Number(choose(levels.map((_,i)=>String(i+1)),id+'/orchards',seed));
 const gardens:Bed[]=[];
 const available=sides.filter(side=>side!==stair);
 for(const level of levels.slice(0,count)){
  const side=choose(available,id+'/orchard/'+level,seed);
  available.splice(available.indexOf(side),1);gardens.push({side,level});
 }
 const reach=weightedForm([{form:'short',end:1},{form:'long',end:2}],seed,id,'deck-reach-v2');
 return {stair,offset,reach:reach==='long'?.115:.08,gardens};
}
