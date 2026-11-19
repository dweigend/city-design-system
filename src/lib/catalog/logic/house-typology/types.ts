import type {HouseSite, HouseSlot, Section} from '../composed-house';
import type {ObjectGeometry} from '../assets';
import type {Typology,HouseRole} from './families';
export type Point=HouseSlot['position'];
export type Deck=Section['decks'][number];
export type Joint='deck'|'body'|'capsule'|'socket'|'foot'|'shaft'|'head'|'brace'|'beam'|'crown';
export type FitMetadata={joint?:Joint;ground?:number;nativeSize?:Point;scale?:Point;source?:{objectId:string;variant:string}};
/** Assembly envelopes carry registry dimensions and functional slots, independent of dressing. */
export type Solid=Extract<ObjectGeometry,{kind:'box'}>&FitMetadata&{joint:Joint;ground:number};
export type Body=HouseSlot & {objectId:string;variant:string;rotation:number;scale:number;nativeSize:Point; nativeCenter:Point};
export type Level=Deck & {bodies:Body[];landing:Point;deckArea:number;outline:Point[]};
export type Port={level:number;position:Point};
export type HouseComposition={id:string;role:HouseRole;typology:Typology;cells:HouseSite['cells'];datum:number;ground:number;
 accessSide:'north'|'south';family:{radius:number;bar:number;parapet:'rail'|'panel'};core:{position:Point;width:number};
 levels:Level[];supports:Solid[];parts:Solid[];crown:Body;ports:Port[]};
export type Bridge={a:string;b:string;from:Point;to:Point;span:number;pier?:Point;kind:'walkway'|'tube'|'platform'|'bridge-house'};
