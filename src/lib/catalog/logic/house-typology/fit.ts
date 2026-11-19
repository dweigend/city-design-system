import {profile,penetration,type FitPart} from './fit-geometry';
import type {Joint} from './types';
const tolerance=.02+1e-9;
export type Finding={code:'floating'|'intersects'|'post-end'|'missing-socket'|'rigid-scale'|'invalid'|'uncertain-contact';part:string;other?:string};
function joint(p:FitPart):Joint|undefined{
 if(p.joint)return p.joint;
 if(p.source?.objectId==='capsule-cradle'||p.source?.objectId==='capsule-socket')return 'socket';
 if(p.kind==='capsule')return 'capsule';
 if(p.kind==='prism'&&p.bearing==='slab')return 'deck';
 return undefined;
}
function invalidScale(p:FitPart){
 if(!p.scale&&!p.nativeSize)return false;
 if(!p.scale||p.scale.some(s=>!Number.isFinite(s)||s<.85-1e-9||s>1.15+1e-9||Math.abs(s-p.scale![0])>1e-9))return true;
 return p.kind==='box'&&p.nativeSize?.some((d,i)=>!Number.isFinite(d)||d<=0||Math.abs(p.size[i]-d*p.scale![i])>1e-8);
}
function describe(p:FitPart){
 const shape=profile(p);
 return {p,...shape,joint:joint(p),below:new Set<Joint|undefined>(),above:new Set<Joint|undefined>()};
}
type Entry=ReturnType<typeof describe>;
function bearing(lower:Entry,upper:Entry){
 if(Math.abs(lower.bounds.max[2]-upper.bounds.min[2])>tolerance)return;
 if(!lower.top.length||!upper.bottom.length||penetration(lower.top,upper.bottom)<-1e-9)return;
 lower.above.add(upper.joint);upper.below.add(lower.joint);
}
function inspectPair(a:Entry,b:Entry,findings:Finding[]){
 const overlap=a.bounds.max.map((v,i)=>Math.min(v-b.bounds.min[i],b.bounds.max[i]-a.bounds.min[i]));
 if(overlap[0]<0||overlap[1]<0||overlap[2]<-tolerance)return;
 bearing(a,b);bearing(b,a);
 if(Math.min(...overlap)<=tolerance)return;
 if(a.polygon&&b.polygon&&penetration(a.polygon,b.polygon)<=tolerance)return;
 findings.push({code:a.polygon&&b.polygon?'intersects':'uncertain-contact',part:a.p.id,other:b.p.id});
}
function inspectJoint(e:Entry,findings:Finding[]){
 const {p,joint:j,above,below}=e;
 const grounded=Math.abs(e.bounds.min[2]-(p.ground??0))<=tolerance;
 if(!grounded&&!below.size)findings.push({code:'floating',part:p.id});
 if(j==='capsule'&&!below.has('socket'))findings.push({code:'missing-socket',part:p.id});
 if((j==='head'&&!above.has('deck')&&!above.has('beam'))||(j==='shaft'&&!above.has('head')&&!above.has('deck')&&!above.has('beam')))
 findings.push({code:'post-end',part:p.id});
 if(invalidScale(p))findings.push({code:'rigid-scale',part:p.id});
}
/** Audits world-space assembly solids, or registry primitives with optional joint/transform metadata.
 * Ground defaults to z=0. Unsupported non-convex contacts produce a finding when their envelopes conflict. */
export function checkFit(parts:readonly FitPart[]):Finding[]{
 const findings:Finding[]=[],entries=parts.filter(p=>p.kind!=='polyline').map(describe);
 for(const [i,a] of entries.entries()){
 if(a.bounds.min.some((n,j)=>!Number.isFinite(n)||!(a.bounds.max[j]>=n)||!Number.isFinite(a.bounds.max[j])))
 findings.push({code:'invalid',part:a.p.id});
 for(let j=0;j<i;j++)inspectPair(entries[j],a,findings);
 }
 for(const e of entries)inspectJoint(e,findings);
 return findings;
}
