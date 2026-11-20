import type { ShellSystem } from '../../data/house-shells';
import type { Vec3 } from '../parametrik/types';
import { face, tau, type Mesh } from './shell-mesh';

// Open frames carry a solid folded wall between their structural bays. Its two reveals
// run independently of the floor datums and expose the interior along a full-height cut.
type Opening = (height: number) => [centre: number, halfWidth: number];
const opening: Partial<Record<ShellSystem, Opening>> = {
	'woven-basket': (v) => [0.5 + 0.13 * Math.sin(tau * v), 0.18],
	diagrid: (v) => [0.5, 0.04 + 0.33 * (1 - Math.abs(4 * (v % 0.5) - 1))],
	'branching-frame': (v) => [0.36 + 0.26 * v, 0.04 + 0.25 * v],
	'lamella-vault': (v) => [0.5, 0.26 * Math.sin(Math.PI * v)],
	'service-risers': (v) => [0.68 + 0.09 * Math.sin(tau * v), 0.18],
	'helical-services': (v) => [0.5 + 0.21 * Math.sin(tau * v), 0.17],
	'fan-truss': (v) => [0.25 + 0.37 * v, 0.05 + 0.22 * v],
	'arch-ribs': (v) => [0.5, 0.235 * Math.sqrt(Math.max(0, 1 - (v / 0.83) ** 2))],
	'sawtooth-fins': (v) => [0.32 + 0.38 * v, 0.16],
	'cable-harp': (v) => [0.23 + 0.54 * v, 0.16],
	'bundled-columns': (v) => [0.5, 0.08 + 0.22 * Math.abs(2 * v - 1)]
};
/** Adds folded side walls and deep reveals where a structural frame bounds a room. */
export function foldedWall(m: Mesh, system: ShellSystem) {
	const cut = opening[system];
	if (!cut) return;
	const row = (v: number, side: number): Vec3[] => {
		const [centre, half] = cut(v);
		const edge = centre + (2 * side - 1) * half;
		return [
			[0, side, v],
			[-0.48, (side + edge) / 2, v],
			[-0.18, edge, v],
			[0.82, edge, v]
		];
	};
	for (const side of [0, 1]) {
		let lo = row(0, side);
		for (let j = 1; j <= 12; j++) {
			const hi = row(j / 12, side);
			for (let i = 0; i < 3; i++) {
				const quad = [lo[i], lo[i + 1], hi[i + 1], hi[i]];
				face(m, side ? quad.reverse() : quad);
			}
			lo = hi;
		}
	}
}

export const foldedSkins = {
	// Paired convex valves enclose a vertical seed chamber. The seam widens across its belly.
	'seed-pod': (m) => {
		for (const side of [0, 1]) {
			const vertex = (s: number, t: number): Vec3 => {
				const belly = Math.sin(Math.PI * t);
				const seam = 0.5 + (2 * side - 1) * 0.16 * belly;
				return [-0.9 * Math.sin(Math.PI * s) * belly, side + s * (seam - side), t];
			};
			for (let i = 0; i < 6; i++)
				for (let j = 0; j < 10; j++) {
					const quad = [
						vertex(i / 6, j / 10),
						vertex((i + 1) / 6, j / 10),
						vertex((i + 1) / 6, (j + 1) / 10),
						vertex(i / 6, (j + 1) / 10)
					];
					face(m, side ? quad.reverse() : quad);
				}
		}
	},
	// A diagonal clerestory divides two folded plates rising in the same direction.
	'ramp-fold': (m) => {
		const vertex = (u: number, band: number): Vec3 => {
			const slope = 0.16 + 0.52 * u;
			const heights = [0, slope - 0.09, slope, slope + 0.16, slope + 0.23, 1];
			return [[0, -0.6, -0.85, 0.64, 0.25, 0][band], u, heights[band]];
		};
		for (const b of [0, 1, 3, 4])
			for (let i = 0; i < 8; i++)
				face(m, [
					vertex(i / 8, b),
					vertex((i + 1) / 8, b),
					vertex((i + 1) / 8, b + 1),
					vertex(i / 8, b + 1)
				]);
	}
} satisfies Record<'seed-pod' | 'ramp-fold', (m: Mesh) => void>;
