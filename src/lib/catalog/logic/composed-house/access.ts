import type { Vec3 } from '../parametrik/types';
import { normal } from './deck-plan';
import { slab } from './parts';
import { accessRibbon } from './ribbon';
import type { Section,Deck } from './types';
import { flowToken } from '../../data/focus';

function end(d:Deck,s:Section,sign:number):Vec3{
 const [nx,ny]=normal[s.aspect.stair];
 return [d.position[0]+(nx*.47-ny*sign*.34)*d.width,d.position[1]+(ny*.47+nx*sign*.34)*d.depth,d.position[2]];
}
function switchbacks(s:Section){
 const first=end(s.decks[0],s,-1);first[2]=s.base[2]+.18;
 const points=[first,...s.decks.map((d,i)=>end(d,s,i%2?-1:1))];
 const last=points[points.length-1],roof=roofLanding(s);
 // Turn around the crown on the side face, landing on the rear roof walk.
 const d=s.decks[s.decks.length-1],side=last[0]>=d.position[0]?1:-1;
 const elbow:Vec3=[d.position[0]+side*d.width*.5,last[1],last[2]];
 return [...points,elbow,[elbow[0],roof[1],s.top] as Vec3,roof].slice(1).map((to,i,ends)=>[i?ends[i-1]:first,to]).filter(([a,b])=>Math.hypot(b[0]-a[0],b[1]-a[1])>.01);
}
function roofLanding(s:Section):Vec3{return [s.base[0]+s.width*.2,s.base[1]+s.depth*.22,s.top];}
function spiral(s:Section){
 const [nx,ny]=normal[s.aspect.stair];
 let angle=Math.atan2(ny,nx),radius=s.decks[0].width*.47,z=s.base[2]+.18;
 const paths:Vec3[][]=[];
 for(const d of s.decks){
  const next=d.width*.47,rise=d.position[2]-z;
  paths.push(Array.from({length:17},(_,i):Vec3=>{
   const t=i/16,a=angle+Math.PI*t,r=radius+(next-radius)*t;
   return [d.position[0]+Math.cos(a)*r,d.position[1]+Math.sin(a)*r,z+rise*t];
  }));
  z+=rise;angle+=Math.PI;radius=next;
 }
 const last=paths[paths.length-1][16];
 const top=roofLanding(s),d=s.decks[s.decks.length-1];
 const target=Math.atan2(top[1]-d.position[1],top[0]-d.position[0]);
 const turn=((target-angle)%(2*Math.PI)+2*Math.PI)%(2*Math.PI);
 paths.push(Array.from({length:17},(_,i):Vec3=>{
  const t=i/16,a=angle+turn*t,r=radius+(Math.hypot(top[0]-d.position[0],top[1]-d.position[1])-radius)*t;
  return [d.position[0]+Math.cos(a)*r,d.position[1]+Math.sin(a)*r,last[2]+(s.top-last[2])*t];
 }));
 return paths;
}
/** One solid flight and landing per tier, with a winding ribbon on circular plans. */
export function access(s:Section){
 const round=s.plan==='round',paths=round?spiral(s):switchbacks(s);
 return paths.flatMap((path,i)=>{
  const id=s.id+'/stair/'+i,p=path[path.length-1],width=1.6;
  return [...accessRibbon(id,path,width,!round),slab(id+'/landing',[p[0],p[1],p[2]-.14],width,width,.14,.14,flowToken.people)];
 });
}
