import { shellSystems, type ShellSystem } from '../../data/house-shells';
import { membraneLoad } from './membrane';
import type { Membrane } from '../membrane';
import { sections } from './section-insets';
import { hashUnit } from '../../core/random';
import type { FinishId } from '../parametrik/types';

const frames = ['mast', 'fan-truss', 'scissor', 'ring', 'outrigger'] as const;
const skins = ['plain', 'woven', 'framed', 'cushioned'] as const;
const outlines = ['orthogonal', 'faceted', 'oval', 'fluted'] as const;
/** Independent choices for the inhabited section, its plan contour and its external finish. */
export type HouseEnvelope = {
	section: (typeof sections)[number];
	/** Requested roof rotation in radians relative to the anchored ground ring. */
	twist?: number;
	fabric?: Membrane;
	frame?: (typeof frames)[number];
	system: ShellSystem;
	outline: (typeof outlines)[number];
	finish?: FinishId;
	skin: (typeof skins)[number];
};

function pick<T>(choices: readonly T[], seed: number, id: string, axis: string) {
	return choices[Math.floor(hashUnit(seed, id, axis) * choices.length)];
}

function textile(
	system: ShellSystem,
	seed: number,
	id: string,
	requested?: Partial<HouseEnvelope>
) {
	const fabric = membraneLoad(
		requested?.frame ? 'tensile-sail' : system,
		seed,
		id,
		requested?.fabric
	);
	const frame =
		requested?.frame ??
		(system === 'tensile-sail' ? pick(frames, seed, id, 'envelope/frame') : undefined);
	return { frame, fabric };
}

/** Resolves each omitted envelope axis from its own stable draw. */
export function houseEnvelope(
	id: string,
	seed: number,
	requested?: Partial<HouseEnvelope>
): HouseEnvelope {
	const system = requested?.system ?? pick(shellSystems, seed, id, 'perimeter/system');
	const { frame, fabric } = textile(system, seed, id, requested);
	const twist =
		requested?.twist ?? (fabric ? (hashUnit(seed, id, 'envelope/twist') - 0.5) * 1.3 : 0);
	const section = requested?.section ?? pick(sections, seed, id, 'perimeter/profile');
	const pod = section === 'orbital-nodes' || section === 'vessel';
	if (!Number.isFinite(twist)) throw RangeError('Invalid envelope twist');
	return {
		system,
		fabric,
		frame,
		twist,
		section,
		outline: requested?.outline ?? (pod ? 'oval' : pick(outlines, seed, id, 'perimeter/outline')),
		skin: requested?.skin ?? pick(skins, seed, id, 'perimeter/skin'),
		...(requested?.finish && { finish: requested.finish })
	};
}
