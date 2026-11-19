import type {
	Body,
	Deck,
	EnsembleContext,
	HouseComposition,
	HouseSite as Site,
	Typology
} from '../house-typology';
import type { Vec3 } from '../parametrik/types';
import type { EnsembleDistrict } from '../district-frame';
import type { QuadCell } from '../quad-grid';
export type { HouseSlot } from '../house-typology';
export type HouseSite = Site & { context?: EnsembleContext };
export type Section = {
	compact: boolean;
	stairAxis: [number, number];
	id: string;
	cells: readonly QuadCell[];
	composition: HouseComposition;
	seed: number;
	typology: Typology;
	base: Vec3;
	width: number;
	depth: number;
	district: EnsembleDistrict;
	start: number;
	stories: number;
	top: number;
	decks: Deck[];
	slots: Body[];
};
