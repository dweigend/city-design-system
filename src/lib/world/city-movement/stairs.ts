import type { Vec3 } from '../../core/geometry';
import type { MovementNode } from '../../domain/movement-network';
import { defaults } from '../../../config/city-movement';
import { link } from './links';

// Exact arithmetic: paired flights turn at alternate sides and reach the original plan address.
export function stair(id: string, base: MovementNode, top: MovementNode) {
	const [x, y, z] = base.position;
	const rise = top.position[2] - z;
	const pairs = Math.ceil(rise / defaults.stairFlightRiseM / 2);
	const flightRise = rise / (pairs * 2);
	const run = flightRise * defaults.stairRunRatio;
	const side = defaults.stairFlightSeparationM / 2;
	const at = (u: number, v: number, w: number): Vec3 => [x + u, y + v, z + w];
	const steps: Vec3[] = [];
	for (let i = 0; i < pairs; i++) {
		const level = i * 2 * flightRise;
		const landing = level + flightRise;
		const next = level + 2 * flightRise;
		steps.push(
			at(0, -side, level),
			at(run, -side, landing),
			at(run, side, landing),
			at(0, side, next)
		);
	}
	if (top.position[0] !== x || top.position[1] !== y) steps.push(at(0, 0, rise));
	return link(id, 'stair', base, top, steps);
}
