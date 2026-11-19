import type { DistrictPreferences, PreferenceSnapshot } from '../../core/neighbourhood';
import {access,electricity,section} from './measures';

type Inputs = {
 walk: Parameters<typeof access>;
 resource: Parameters<typeof electricity>;
 shade: Parameters<typeof section>;
};
function measure(input: Inputs) {
 return {walk:access(...input.walk),resource:electricity(...input.resource),shade:section(...input.shade)};
}
type District = DistrictPreferences[string];

/** Measures one snapshot and freezes the profile's translation, including detached evidence lists. */
export function publishPreferences(snapshotRevision:string, districts:ReadonlyMap<string,Inputs>,profile:{
 revision:string; translate:(id:string,readings:ReturnType<typeof measure>)=>District;
}):PreferenceSnapshot {
 const entries=[...districts].map(([id,input])=>{
 const result=profile.translate(id,measure(input));
 const refs=Object.entries(result.evidenceRefs ?? {}).map(([form,ids])=>[form,Object.freeze([...ids])]);
 const suggestions=(result.suggestions ?? []).map(s=>Object.freeze({...s,evidenceRefs:Object.freeze([...s.evidenceRefs])}));
 return [id,Object.freeze({formMultipliers:Object.freeze({...result.formMultipliers}),evidenceRefs:Object.freeze(Object.fromEntries(refs)),suggestions:Object.freeze(suggestions)})];
 });
 return Object.freeze({snapshotRevision,profileRevision:profile.revision,preferences:Object.freeze(Object.fromEntries(entries))});
}
