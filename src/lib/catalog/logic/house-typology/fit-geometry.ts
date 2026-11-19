import {bounds,type Bounds} from '../ansicht/geometrie';
import type {ObjectGeometry} from '../assets';
import type {Primitive} from '../parametrik/types';
import type {FitMetadata} from './types';
export type FitPart=(ObjectGeometry|Primitive)&FitMetadata;
type XY=[number,number];
export type Profile={bounds:Bounds;polygon?:XY[];bottom:XY[];top:XY[]};
const corners=[[-1,-1],[1,-1],[1,1],[-1,1]];
const EPS=1e-9;
function rectangle(p:Extract<FitPart,{kind:'box'|'wedge'|'frame'}>):XY[]{
 const [w,d]=p.size,[x,y]=p.position,a=p.rotation??0,c=Math.cos(a),s=Math.sin(a);
 return corners.map(([u,v])=>[x+w/2+(u*w*c-v*d*s)/2,y+d/2+(u*w*s+v*d*c)/2]);
}
function convex(p:XY[]){
 return p.every((a,i)=>{const b=p[(i+1)%p.length],c=p[(i+2)%p.length];
 return (b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0])>=-EPS;});
}
/** Separates broad phase volume from actual bearing faces. Unknown contacts fail closed. */
export function profile(p:FitPart):Profile{
 const box=bounds(p as Primitive),unused:XY[]=[];
 if(p.kind==='box'){
 const polygon=rectangle(p);
 for(const axis of [0,1] as const){box.min[axis]=Math.min(...polygon.map(v=>v[axis]));box.max[axis]=Math.max(...polygon.map(v=>v[axis]));}
 return {bounds:box,polygon,bottom:polygon,top:polygon};
 }
 if(p.kind==='prism'&&!p.rotation&&!p.holes?.length&&convex(p.polygon))
 return {bounds:box,polygon:p.polygon,bottom:p.polygon,top:p.polygon};
 if(p.kind==='cylinder'||p.kind==='cone'||p.kind==='dome'||p.kind==='sphere'){
 const [x,y]=p.position,center:XY[]=[[x,y]];
 const disk:XY[]=Array.from({length:48},(_,i)=>[x+p.radius*Math.cos(i*Math.PI/24),y+p.radius*Math.sin(i*Math.PI/24)]);
 return {bounds:box,bottom:p.kind==='sphere'?center:disk,top:p.kind==='cylinder'?disk:center};
 }
 if(p.kind==='capsule'){
 const low=p.from[2]<=p.to[2]?p.from:p.to,high=low===p.from?p.to:p.from;
 return {bounds:box,bottom:[[low[0],low[1]]],top:[[high[0],high[1]]]};
 }
 return {bounds:box,bottom:unused,top:unused};
}
function axes(poly:XY[]):XY[]{
 if(poly.length<2)return [[1,0],[0,1]];
 return poly.map((p,i)=>{const q=poly[(i+1)%poly.length],x=q[1]-p[1],y=p[0]-q[0],len=Math.hypot(x,y);
 return [x/len,y/len];});
}
/** Signed minimum translation on all face normals, in metres; negative means separation. */
export function penetration(a:XY[],b:XY[]){
 let minimum=Infinity;
 for(const [x,y] of [...axes(a),...axes(b)]){
 const u=a.map(p=>p[0]*x+p[1]*y),v=b.map(p=>p[0]*x+p[1]*y);
 minimum=Math.min(minimum, Math.max(...u)-Math.min(...v), Math.max(...v)-Math.min(...u));
 }
 return minimum;
}
