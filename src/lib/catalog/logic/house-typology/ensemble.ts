import type {HouseSite} from '../composed-house';
import {STORY} from '../../data/grid';
import {collapse} from './collapse';
import {affinities,typologies,type HouseRole,type Typology} from './families';
import {survey,type Survey} from './survey';

type Decision={role:HouseRole;typology:Typology};
export type EnsembleContext={datum:number;seed:number;houses:ReadonlyMap<string,Decision>};

function skyline(sites:Survey[],seed:number) {
 const roles=new Map<string,HouseRole>(sites.map(s=>[s.id,'medium']));
 const sorted=[...sites].sort((a,b)=>a.base+a.programme.length*STORY-b.base-b.programme.length*STORY);
 const top=sorted.at(-1)!;
 const ties=sorted.filter(s=>s.base+s.programme.length*STORY===top.base+top.programme.length*STORY);
 const high=collapse('ensemble/high',seed,'skyline',ties.map(s=>[s.id,1]));
 roles.set(high,'high');
 const lows=sorted.filter(s=>s.id!==high);
 for(let i=0;i<Math.min(lows.length,Math.ceil(sites.length/4));i++){
 const h=lows[0].programme.length;
 const id=collapse('ensemble/low/'+i,seed,'high/'+high,lows.filter(s=>s.programme.length===h).map(s=>[s.id,1]));
 roles.set(id,'low');lows.splice(lows.findIndex(s=>s.id===id),1);
 }
 return roles;
}

function houseLayer(sites:Survey[],roles:Map<string,HouseRole>,seed:number){
 const houses=new Map<string,Decision>(),counts=new Map<Typology,number>();
 for(const site of sites){
 const role=roles.get(site.id)!;
 const weights=affinities(site,role);
 let choices=typologies.filter(t=>weights[t]>0);
 if(counts.size===1) choices=choices.filter(t=>!counts.has(t));
 if(counts.size===2) {
 const least=Math.min(...counts.values());
 choices=[...counts.keys()].filter(t=>counts.get(t)===least);
 }
 const typology=collapse('house/'+site.id,seed,role,choices.map(t=>[t,Math.max(0.1,weights[t])]));
 houses.set(site.id,{role,typology});counts.set(typology,(counts.get(typology)??0)+1);
 }
 return houses;
}
/** Solves one ensemble (one to eight houses) in stable site order. Datum is the first shared half-storey above all painted bases. */
export function planEnsemble(sites:readonly HouseSite[],seed?:number):EnsembleContext{
 if(!sites.length||sites.length>8) throw new RangeError('Expected one to eight house sites');
 const sorted=sites.map(survey).sort((a,b)=>a.id.localeCompare(b.id));
 if(new Set(sorted.map(s=>s.id)).size!==sites.length) throw new RangeError('Duplicate house site');
 const selectedSeed=seed??sorted[0].seed;
 const origin=Math.min(...sorted.map(s=>s.ground)),step=STORY/2;
 const datum=origin+step*(1+Math.ceil((Math.max(...sorted.map(s=>s.base))-origin)/step));
 return {seed:selectedSeed,datum,houses:houseLayer(sorted,skyline(sorted,selectedSeed),selectedSeed)};
}
