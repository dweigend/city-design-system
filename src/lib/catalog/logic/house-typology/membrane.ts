import { hashUnit } from '../../core/random';
import type { ShellSystem } from '../../data/house-shells';

import type { Membrane } from '../membrane';

const restraints: Partial<Record<ShellSystem, Membrane['restraint']>> = {
	'inflated-cushion': 'net',
	'tensile-sail': 'straps',
	'suspended-curtain': 'hoops'
};

/** Resolves the textile load independently of section, colour and finish. */
export function membraneLoad(system: ShellSystem, seed: number, id: string, request?: Membrane) {
	if (request) {
		if (
			!Number.isFinite(request.pressure) ||
			request.pressure < 0 ||
			!Number.isFinite(request.tension) ||
			request.tension <= 0
		)
			throw RangeError('Invalid membrane load');
		return request;
	}
	const restraint = restraints[system];
	if (restraint)
		return {
			restraint,
			pressure:
				(system === 'inflated-cushion' ? 1 : 0.035) *
				(0.4 + 1.4 * hashUnit(seed, id, 'envelope/pressure')),
			tension: 1.1 + 2 * hashUnit(seed, id, 'envelope/tension')
		};
}
