import type {Level,Point,Solid} from './types';
import type {Plan} from './levels';
import {solid,worldSize,mounted} from './objects';
const volume=([w,d,h]:Point)=>w*d*h;

/** Transfers each storey load through articulated bearings on the outer edge of the access band. */
export function bearings(plan:Plan,id:string,z:number,top:number,stations:number[]){
 const rise=top-z,collar=Math.min(.16,rise/4),y=plan.rear-plan.sign*.15;
 return stations.flatMap((x,i)=>{
 const address=id+'/post/'+i;
 const size=plan.bar;
 const member=(name:'foot'|'shaft'|'head',at:number,height:number,width:number)=>
 solid(address+'/'+name,name,[x,y,at],[width,width,height],plan.site.ground,'frame');
 return [member('foot',z,collar,size),member('shaft',z+collar,rise-2*collar,size*.72),
 member('head',top-collar,collar,size)];
 });
}
export function tierParts(plan:Plan,l:Level,i:number,below:number,stations:number[]){
 const {site}=plan,id=site.id+'/level/'+i,[x,y,z]=l.position;
 const bodyVolume=l.bodies.reduce((sum,b)=>sum+volume(b.size),0);
 const thickness=Math.min(.55,bodyVolume*.31/l.deckArea);
 const floor=solid(id+'/deck','deck',[x,y,z-thickness],[l.width,l.depth,thickness],site.ground,'deck');
 const posts=bearings(plan,id,below,z-thickness,stations);
 const pieces=l.bodies.flatMap(b=>{
 const [w,d]=worldSize(b);
 return [solid(b.id+'/socket','socket',[b.position[0],b.position[1],z],[w*.75,d*.75,.12],site.ground,'frame'),
 mounted(b,site.ground,b.kind==='capsule'?'capsule':'body')];
 });
 return [...posts,floor,...pieces];
}
