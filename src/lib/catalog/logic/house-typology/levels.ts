import type {HouseSlot} from '../composed-house';
import {STORY} from '../../data/grid';
import {collapse} from './collapse';
import {bodySpec,objectSlot,worldSize} from './objects';
import type {Typology} from './families';
import type {Survey} from './survey';
import type {Body,Level,Point} from './types';

export type Plan={site:Survey;type:Typology;seed:number;sign:number;datum:number;rear:number;bar:number};
function offset(type:Typology,i:number,n:number){
 switch(type){
 case 'terrace-house':return (i/(n-1||1)-.5)*1.25;
 case 'cluster-mast':return .625*Math.cos(i*Math.PI/2);
 case 'tree-house':return [-.625,0,.625][i%3];
 case 'capsule-stack':case 'plinth-house':case 'slab-house':return (i%2-.5)*1.25;
 default:return 0;
 }
}
function programme(plan:Plan,i:number){
 const {site,type,seed}=plan,paint=site.programme[i];
 const use=collapse(site.id+'/part/use/'+i,seed,type,[...new Set(paint)].map(u=>[u,paint.filter(p=>p===u).length]));
 const length=site.width>11?10:site.width>8?7.5:5;
 const rotation=(site.depth>site.width?1:0)*Math.PI/2;
 return {use,length,rotation};
}
function count(plan:Plan,i:number,body:Body){
 const {site,type,seed}=plan;
 const [w,d]=worldSize(body), small=w*d/((w+.6)*(d+1.55))<.55;
 if(small||type==='twin-stack'||type==='rack')return 2;
 if(type==='round-tower'||type==='bell-house'||type==='courtyard-house')return 1;
 const max=site.cells.length>1||body.kind==='capsule';
 return Number(collapse(site.id+'/part/count/'+i,seed,type,[['1',2],['2',max?1:0]]));
}
function bodies(plan:Plan,i:number,z:number){
 const {site,type,sign,seed,rear}=plan;
 const {use,length,rotation}=programme(plan,i);
 const id=site.id+'/level/'+i;
 const spec=bodySpec(type,use,length,i);
 const first=objectSlot(id+'/0',spec,use,seed,rotation,use==='living'?length:undefined);
 const n=count(plan,i,first),out:Body[]=[];
 const dx=offset(type,i,site.programme.length);
 for(let j=0;j<n;j++){
 const garden=type==='rack'&&j===1&&i%2===0;
 const b=garden?objectSlot(id+'/'+j,['grove-island','extended','grove'],'food',seed,rotation):{...first,id:id+'/'+j};
 const d=worldSize(b)[1];
 const used=out.reduce((sum,other)=>sum+worldSize(other)[1],0);
 b.position=[site.center[0]+dx,rear-sign*(1.25+used+d/2),z+.12];
 b.facing=[0,sign];out.push(b);
 }
 return out;
}
function tierKind(kind:HouseSlot['kind']):Level['kind']{
 if(kind==='reservoir')return 'rack';
 if(kind==='capsule'||kind==='solar'||kind==='grove'||kind==='dome'||kind==='lookout')return kind;
 return 'workshop';
}
/** Places occupied decks inward from one continuous landing line. */
export function planLevel(plan:Plan,i:number):Level{
 const {site,datum,sign,rear}=plan,z=datum+i*STORY;
 const row=bodies(plan,i,z);
 const w=Math.max(...row.map(b=>worldSize(b)[0]))+.6;
 const d=row.reduce((s,b)=>s+worldSize(b)[1],0)+1.55;
 const x=row[0].position[0],y=rear-sign*d/2;
 const outline:Point[]=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>[x+a*w/2,y+b*d/2,z]);
 return {position:[x,y,z],width:w,depth:d,round:false,deckArea:w*d,outline,
 programme:site.programme[i],use:row[0].use,kind:tierKind(row[0].kind),bodies:row,landing:[x,rear-sign*.625,z]};
}
