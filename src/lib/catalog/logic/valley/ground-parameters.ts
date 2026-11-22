import { VALLEY_GROUND_DEFAULTS, type ValleyGroundProfile } from '../../data/valley-ground';

const STANDARD_LIMITS = [0.001, 3000] as const;
const LIMITS: Partial<Record<keyof ValleyGroundProfile, readonly [number, number]>> = {
	wideningM: [-3000, 3000],
	axisBowGain: [0, 2],
	axisReachM: [6.25, 3000],
	apronRiseM: [0, 3000],
	valleySlope: [0, 1]
};
const keys = Object.keys(VALLEY_GROUND_DEFAULTS) as (keyof ValleyGroundProfile)[];

function validGroundValue(key: keyof ValleyGroundProfile, value: unknown) {
	const [min, max] = LIMITS[key] ?? STANDARD_LIMITS;
	if (Array.isArray(VALLEY_GROUND_DEFAULTS[key])) {
		return (
			Array.isArray(value) &&
			value.length === 2 &&
			Number.isFinite(value[0]) &&
			Number.isFinite(value[1]) &&
			min <= value[0] &&
			value[0] <= value[1] &&
			value[1] <= max
		);
	}
	return typeof value === 'number' && min <= value && value <= max;
}

/** Applies the ground defaults, validates each value and detaches the profile from its input. */
export function resolveGroundProfile(
	overrides?: Partial<ValleyGroundProfile>
): ValleyGroundProfile {
	const profile = { ...VALLEY_GROUND_DEFAULTS, ...overrides };
	for (const key of keys) {
		const value = profile[key];
		if (!validGroundValue(key, value)) throw new RangeError('invalid-valley-ground');
		if (Array.isArray(value)) Object.assign(profile, { [key]: Object.freeze([...value]) });
	}
	if (profile.closeEdgeM[1] >= profile.openEdgeM[0]) throw new RangeError('invalid-valley-ground');
	return Object.freeze(profile);
}
