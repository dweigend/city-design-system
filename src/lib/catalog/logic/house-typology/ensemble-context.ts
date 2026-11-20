import type { HouseRole, Typology } from './families';
import type { UpperWing } from './upper-wings';

export type Decision = {
	roof: 'head' | 'terrace';
	frontage?: ReadonlySet<string>;
	galleryCourse?: number;
	upperWing?: UpperWing;
	role: HouseRole;
	typology: Typology;
	away: [number, number];
};
export type EnsembleContext = {
	leadingSystem: import('./envelope').HouseEnvelope['system'];
	datum: number;
	skyline: number;
	seed: number;
	houses: ReadonlyMap<string, Decision>;
};
