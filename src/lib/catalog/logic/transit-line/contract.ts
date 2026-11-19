import { defineParams, numberParam, resolveParams, type ParamOverrides } from '../../core/params';
import type { Vec3 } from '../parametrik/types';
export type TransitKind = 'viaduct' | 'capsule';
export type TransitStop = Readonly<{ position: Vec3; headingRad: number }>;
export type TransitPillar = Readonly<{ foot: Vec3; top: number }>;
export type TransitLine = Readonly<{
	id: string;
	kind: TransitKind;
	profile?: TransitOverrides;
	cellIds: readonly string[];
	path: readonly Vec3[];
	length: number;
	stops: readonly TransitStop[];
	pillars: readonly TransitPillar[];
}>;
export type TransitPose = Readonly<{ position: Vec3; headingRad: number; pitchRad: number }>;
const stationFields = {
	platformDrop: numberParam('Platform drop', 'm', 0.6, [0, 5, 0.05]),
	platformHeight: numberParam('Platform thickness', 'm', 0.35, [0.05, 3, 0.05]),
	hoopSpacing: numberParam('Hoop spacing', 'm', 10, [1, 100, 0.5]),
	shaftOffset: numberParam('Station shaft offset', 'm', 2.6, [0, 10, 0.1])
};

/** Routing, station, support and vehicle controls by transit kind, in meters, ratios and m/s. */
export const TRANSIT_PARAMS = {
	viaduct: defineParams({
		...stationFields,
		radius: numberParam('Curve radius', 'm', 30, [1, 250, 1]),
		grade: numberParam('Maximum grade', 'ratio', 0.04, [0, 1, 0.01]),
		clearance: numberParam('Clearance', 'm', 9, [1, 60, 0.5]),
		supportSpacing: numberParam('Support spacing', 'm', 20, [2, 100, 0.5]),
		deckRadius: numberParam('Deck radius', 'm', 0.55, [0.1, 5, 0.05]),
		supportRadius: numberParam('Support radius', 'm', 0.32, [0.05, 5, 0.01]),
		speed: numberParam('Vehicle speed', 'm/s', 11, [0.1, 80, 0.5])
	}),
	capsule: defineParams({
		...stationFields,
		radius: numberParam('Curve radius', 'm', 18, [1, 250, 1]),
		grade: numberParam('Maximum grade', 'ratio', 0.08, [0, 1, 0.01]),
		clearance: numberParam('Clearance', 'm', 6, [1, 60, 0.5]),
		supportSpacing: numberParam('Support spacing', 'm', 15, [2, 100, 0.5]),
		deckRadius: numberParam('Deck radius', 'm', 1.25, [0.1, 5, 0.05]),
		supportRadius: numberParam('Support radius', 'm', 0.22, [0.05, 5, 0.01]),
		speed: numberParam('Vehicle speed', 'm/s', 15, [0.1, 80, 0.5])
	})
} as const;

const DESIGN = {
	viaduct: resolveParams(TRANSIT_PARAMS.viaduct),
	capsule: resolveParams(TRANSIT_PARAMS.capsule)
};
export type TransitProfile = typeof DESIGN.viaduct;
/** Sparse transit settings in the units defined by TRANSIT_PARAMS. */
export type TransitOverrides = ParamOverrides<typeof TRANSIT_PARAMS.viaduct>;

export const CAPSULE_HOOP_RADIUS = 1.4;

export function resolveTransitProfile(
	kind: TransitKind,
	overrides?: TransitOverrides
): TransitProfile {
	if (!overrides) return DESIGN[kind];
	const profile = resolveParams(TRANSIT_PARAMS[kind], undefined, overrides);
	const { clearance, deckRadius, platformDrop, platformHeight } = profile;
	if (deckRadius >= clearance) throw new RangeError('Deck radius must be below clearance');
	const stationDrop = platformDrop + (kind === 'viaduct' ? platformHeight : 0);
	if (stationDrop >= clearance) throw new RangeError('Station drop must be below clearance');
	if (kind === 'capsule' && deckRadius >= CAPSULE_HOOP_RADIUS)
		throw new RangeError('Capsule deck radius must be below the hoop radius');
	return profile;
}

/** Validates transit overrides and returns a detached record containing only differences from
 * the kind's defaults, or undefined for the default profile. Invalid dimensions throw RangeError.
 */
export function transitOverrides(
	kind: TransitKind,
	overrides?: TransitOverrides
): TransitOverrides | undefined {
	if (!overrides) return;
	return changedTransitOverrides(kind, resolveTransitProfile(kind, overrides));
}

export function changedTransitOverrides(
	kind: TransitKind,
	profile: TransitProfile
): TransitOverrides | undefined {
	const changed = Object.entries(profile).filter(
		([key, value]) => value !== DESIGN[kind][key as keyof TransitProfile]
	);
	return changed.length ? Object.fromEntries(changed) : undefined;
}
export const VEHICLE: Record<TransitKind, { length: number; radius: number; cars: number }> = {
	viaduct: { length: 7, radius: 1.15, cars: 3 },
	capsule: { length: 3.4, radius: 0.95, cars: 1 }
};
export const CAR_GAP = 0.6;
