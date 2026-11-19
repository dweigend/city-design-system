import { flowToken } from '../../data/focus';
import type { Vec3 } from '../parametrik/types';
import { deckParts,deckCorners } from '../walkway';
import { piece } from './parts';

function station(path:Vec3[],i:number,offset:number):Vec3{
 const a=path[Math.max(0,i-1)],b=path[Math.min(path.length-1,i+1)],p=path[i];
 const dx=b[0]-a[0],dy=b[1]-a[1],k=offset/(Math.hypot(dx,dy)||1);
 return [p[0]-dy*k,p[1]+dx*k,p[2]];
}
// Four vertices at each station form a closed rectangular section. Only its long edges are inked.
function strip(id:string,path:Vec3[],l:number,r:number,bottom:number,top:number){
 const points:Vec3[]=[],triangles:number[]=[0,2,3,0,1,2];
 for(let i=0;i<path.length;i++){
  const a=station(path,i,l),b=station(path,i,r),j=i*4;
  for(const [p,h] of [[a,top],[b,top],[b,bottom],[a,bottom]] as const)points.push([p[0],p[1],p[2]+h]);
  if(i===0)continue;
  for(let k=0;k<4;k++){const u=j-4+k,v=j-4+(k+1)%4;triangles.push(u,v+4,v,u,u+4,v+4);}
 }
 const j=points.length-4;triangles.push(j,j+2,j+1,j,j+3,j+2);
 const lines=[0,1,2,3].map(k=>path.map((_,i)=>4*i+k));
 return piece(id,{kind:'mesh',points,triangles,lines},flowToken.people);
}
/** Closed access band and raised solid parapets follow the same walking stations in metres. */
export function accessRibbon(id:string,path:Vec3[],width:number,steps=true){
 const half=width/2,wall=Math.min(.2,width*.14);
 const band=[strip(id+'/bed',path,-half,half,-.16,0),
  strip(id+'/stringer/left',path,-half,-half+wall,-.16,.72),
  strip(id+'/stringer/right',path,half-wall,half,-.16,.72)];
 if(!steps)return band;
 return [...band,...path.slice(1).flatMap((b,i)=>deckParts(deckCorners(path[i],b,width-2*wall),id+':'+i,width-2*wall,flowToken.people,{thickness:.12,treadRise:.32},true).filter(p=>p.kind==='prism'))];
}
