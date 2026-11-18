import type { Vec3 } from '../parametrik/types';
export type TransitKind = 'viaduct' | 'capsule';
export type TransitStop = Readonly<{ position: Vec3; headingRad: number }>;
export type TransitPillar = Readonly<{ foot: Vec3; top: number }>;
export type TransitLine = Readonly<{
	id: string;
	kind: TransitKind;
	cellIds: readonly string[];
	path: readonly Vec3[];
	length: number;
	stops: readonly TransitStop[];
	pillars: readonly TransitPillar[];
}>;
export type TransitPose = Readonly<{ position: Vec3; headingRad: number; pitchRad: number }>;
export const DESIGN = {
	viaduct: {
		radius: 30,
		grade: 0.04,
		clearance: 9,
		supportSpacing: 20,
		deckRadius: 0.55,
		supportRadius: 0.32,
		speed: 11
	},
	capsule: {
		radius: 18,
		grade: 0.08,
		clearance: 6,
		supportSpacing: 15,
		deckRadius: 1.25,
		supportRadius: 0.22,
		speed: 15
	}
};
export const VEHICLE: Record<TransitKind, { length: number; radius: number; cars: number }> = {
	viaduct: { length: 7, radius: 1.15, cars: 3 },
	capsule: { length: 3.4, radius: 0.95, cars: 1 }
};
export const CAR_GAP = 0.6;
export const SHAFT_OFFSET = 2.6;
