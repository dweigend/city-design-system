import type { HouseEnvelope } from './envelope';
import type { HouseUse, Stacks } from '../../data/house-body';
import type { EnsembleDistrict } from '../district-frame';
import type { Vec3 } from '../parametrik/types';
import type { QuadCell } from '../quad-grid';

export type HouseSite = {
	cells: readonly QuadCell[];
	stacks: Stacks;
	seed: number;
	/** Finished ground-floor elevation in metres at the graded entrance. */
	finishedFloor?: number;
	district?: EnsembleDistrict;
	envelope?: Partial<HouseEnvelope>;
	plan?: 'rectangular' | 'round';
};
type TierKind = 'solar' | 'capsule' | 'dome' | 'lookout' | 'rack' | 'grove' | 'workshop';
type AssetKind = TierKind | 'panels' | 'lantern' | 'chimney' | 'reservoir';
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
