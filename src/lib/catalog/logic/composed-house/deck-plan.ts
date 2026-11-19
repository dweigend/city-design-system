import type { HouseSide } from '../district-frame';
import type { Section } from './types';
export const normal:Record<HouseSide,[number,number]>={west:[-1,0],south:[0,-1],east:[1,0],north:[0,1]};
/** Alternates the projecting axis and keeps the narrow decks over the central bearings. */
export function deckPlan(i:number,count:number,round:boolean,aspect:Section['aspect']){
 const [nx,ny]=normal[aspect.offset];
 const crown=i===count-1;
 if(count===1)return {width:1,depth:.88,x:0,y:0};
 if(round){
  const diameter=crown?1.13:i%2?.76:1.03;
  return {width:diameter,depth:diameter,x:nx*.035,y:ny*.035};
 }
 if(crown)return {width:1.09,depth:1.05,x:nx*aspect.reach,y:ny*aspect.reach};
 const phase=i%3;
 const k=[-.13,.15,.04][phase],j=[-.05,.04,-.16][phase];
 return {width:[.83,.98,.77][phase],depth:[.86,.72,.97][phase],x:nx*k-ny*j,y:ny*k+nx*j};
}
