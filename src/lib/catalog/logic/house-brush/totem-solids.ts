import type { Vec3 } from '../parametrik/types';
import type { Form } from './form';

/** Local frame for a ceramic body, in meters and radians. */
export type Seat = { x: number; y: number; z: number; r: number; h: number; turn: number };

function block(s: Seat, width: number, depth: number, kind: 'box' | 'wedge'): Form {
	return {
		kind,
		position: [s.x - width / 2, s.y - depth / 2, s.z],
		size: [width, depth, s.h],
		rotation: s.turn
	};
}

function barrel(s: Seat): Form {
	const radius = Math.min(s.h / 2, s.r * 0.66);
	const reach = s.r - radius;
	const end = (sign: number): Vec3 => [
		s.x + sign * reach * Math.cos(s.turn),
		s.y + sign * reach * Math.sin(s.turn),
		s.z + radius
	];
	return { kind: 'capsule', from: end(-1), to: end(1), radius };
}

/** A single solid on its seat. Cones take an entire ground story. */
export function totemSolid(s: Seat, choice: number): Form {
	const { x, y, z, r, h, turn: rotation } = s;
	const position: Vec3 = [x, y, z];
	switch (choice) {
		case 0:
			return { kind: 'cone', position, radius: r, height: h };
		case 1:
			return { kind: 'sphere', position: [x, y, z + h / 2], radius: r, squash: h / (2 * r) };
		case 2:
			return {
				kind: 'arch',
				position,
				width: Math.min(r * 1.8, h * 1.9),
				length: r * 0.84,
				rise: h,
				thickness: r * 0.32,
				rotation
			};
		case 3:
			return { kind: 'vault', position, width: r * 1.48, length: r * 1.3, rise: h, rotation };
		case 4:
			return block(s, r * 1.6, r * 1.1, 'wedge');
		case 5:
			return barrel(s);
		case 6: {
			const outer = Math.min(h / 2, r);
			return {
				kind: 'torus',
				position: [x, y, z + outer],
				radius: outer * 0.74,
				tube: outer * 0.26,
				axis: 'x',
				rotation
			};
		}
		case 7:
			return block(s, r * 1.85, r * 0.73, 'box');
		default:
			return { kind: 'cylinder', position, radius: r, height: h };
	}
}
