import type { HouseUse, Stacks } from '../../data/house-body';
import type {
	houseAspect,
	CrownKind,
	EnsembleDistrict,
	HousePlan,
	TierKind
} from '../district-frame';
import type { Vec3 } from '../parametrik/types';
import type { QuadCell } from '../quad-grid';

export type HouseSite = {
	cells: readonly QuadCell[];
	stacks: Stacks;
	seed: number;
	district?: EnsembleDistrict;
	plan?: HousePlan;
};
export type AssetKind = Exclude<TierKind, 'void' | 'gallery'> | CrownKind | 'reservoir' | 'window';
/** Position is the bottom centre in world metres. Size is local width, depth, height.
 * Facing is the outward horizontal unit vector. */
export type HouseSlot = {
	id: string;
	anchor: 'deck' | 'roof' | 'facade' | 'ground';
	kind: AssetKind;
	position: Vec3;
	size: Vec3;
	facing: [number, number];
	use: HouseUse;
};
export type Deck = {
	position: Vec3;
	width: number;
	depth: number;
	round: boolean;
	programme: HouseUse[];
	kind: TierKind;
	use: HouseUse;
};
export type Section = {
	compact: boolean;
	stairAxis: [number, number];
	id: string;
	cells: readonly QuadCell[];
	plan: HousePlan;
	seed: number;
	typology: 'house' | 'tower';
	aspect: ReturnType<typeof houseAspect>;
	crown: CrownKind;
	base: Vec3;
	width: number;
	depth: number;
	district: EnsembleDistrict;
	start: number;
	stories: number;
	top: number;
	decks: Deck[];
	slots: HouseSlot[];
};
