import { shellSystems, type ShellSystem } from '../../data/house-shells';
import { mount, type AssetRecipe } from './definition';
import { surface } from './parts';
import type { Vec3 } from '../parametrik/types';

type Mesh = { points: Vec3[]; triangles: number[]; lines: number[][] };
type UV = [number, number];
const tau = 2 * Math.PI;
function face(m: Mesh, points: Vec3[]) {
	const k = m.points.length;
	m.points.push(...points);
	for (let j = 1; j < points.length - 1; j++) m.triangles.push(k, k + j, k + j + 1);
}
function rod(m: Mesh, path: UV[], width: number, relief = 0.06) {
	for (let i = 1; i < path.length; i++) {
		const [u, v] = path[i - 1],
			[a, b] = path[i],
			length = Math.hypot(a - u, b - v);
		if (!length) continue;
		const x = (-(b - v) / length) * width,
			y = ((a - u) / length) * width;
		const ring = (s: number, t: number): Vec3[] => [
			[relief - 0.04, s - x, t - y],
			[relief + 0.05, s, t],
			[relief - 0.04, s + x, t + y]
		];
		const lo = ring(u, v),
			hi = ring(a, b);
		for (let j = 0; j < 3; j++) face(m, [lo[j], lo[(j + 1) % 3], hi[(j + 1) % 3], hi[j]]);
	}
}
function fabric(
	m: Mesh,
	nx: number,
	nz: number,
	depth: (u: number, v: number) => number,
	skip?: (i: number, j: number) => boolean
) {
	for (let i = 0; i < nx; i++)
		for (let j = 0; j < nz; j++) {
			if (skip?.(i, j)) continue;
			const vertex = (a: number, b: number): Vec3 => [depth(a / nx, b / nz), a / nx, b / nz];
			face(m, [vertex(i, j), vertex(i + 1, j), vertex(i + 1, j + 1), vertex(i, j + 1)]);
		}
}
function curve(f: (t: number) => UV, n = 12) {
	return Array.from({ length: n + 1 }, (_, i) => f(i / n));
}
type Draw = (m: Mesh) => void;
const draw: Record<ShellSystem, Draw> = {
	'tensile-sail': (m) =>
		fabric(
			m,
			10,
			12,
			(u, v) => 0.66 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v) + 0.22 * (u - v) ** 2
		),
	'inflated-cushion': (m) =>
		fabric(
			m,
			12,
			16,
			(u, v) => 0.65 * Math.abs(Math.sin(2 * Math.PI * u) * Math.sin(2 * Math.PI * v))
		),
	'pleated-sheet': (m) => fabric(m, 12, 6, (u, v) => 0.52 * Math.abs(((u * 6 + v) % 1) - 0.5) * 2),
	'woven-basket': (m) => {
		for (let k = -4; k <= 4; k++)
			for (const sign of [-1, 1]) {
				const p = curve((t) => [k / 4 + t * sign, t], 24).filter(([u]) => u >= 0 && u <= 1);
				rod(m, p, 0.013);
			}
	},
	diagrid: (m) => {
		for (let j = 0; j < 2; j++) {
			rod(
				m,
				[
					[0, j / 2],
					[1, (j + 1) / 2]
				],
				0.032
			);
			rod(
				m,
				[
					[1, j / 2],
					[0, (j + 1) / 2]
				],
				0.032
			);
		}
	},
	'branching-frame': (m) => {
		rod(
			m,
			[
				[0.5, 0],
				[0.5, 0.38]
			],
			0.06
		);
		for (const u of [0.2, 0.8]) {
			rod(
				m,
				[
					[0.5, 0.38],
					[u, 0.7]
				],
				0.039
			);
			for (const dx of [-0.18, 0.18])
				rod(
					m,
					[
						[u, 0.7],
						[u + dx, 1]
					],
					0.022
				);
		}
	},
	'lamella-vault': (m) => {
		for (let i = 0; i < 5; i++)
			for (const s of [-1, 1])
				rod(
					m,
					curve((t) => [i / 5 + 0.1 + s * 0.09 * Math.sin(Math.PI * t), t]),
					0.016
				);
	},
	'suspended-curtain': (m) => {
		fabric(m, 12, 8, (u, v) => 0.17 * Math.cos(tau * 3 * u) * (1 - v) + 0.21);
		for (const u of [0.15, 0.85])
			rod(
				m,
				[
					[u, 0.08],
					[u, 1]
				],
				0.013
			);
	},
	'service-risers': (m) => {
		for (let i = 0; i < 3; i++) {
			const u = 0.14 + i * 0.24;
			rod(
				m,
				[
					[u, 0],
					[u, 0.32],
					[u + 0.14, 0.38],
					[u + 0.14, 0.74],
					[u, 0.79],
					[u, 1]
				],
				0.034,
				0.17
			);
		}
	},
	'helical-services': (m) => {
		for (const phase of [0, 0.5])
			rod(
				m,
				curve((t) => [0.5 + 0.4 * Math.sin(tau * (t + phase)), t], 24),
				0.034,
				0.17
			);
	},
	'fan-truss': (m) => {
		for (let i = 0; i <= 6; i++)
			rod(
				m,
				[
					[0.12, 0],
					[i / 6, 1]
				],
				0.017
			);
		rod(
			m,
			[
				[0.12, 0],
				[0.86, 0.52],
				[1, 1]
			],
			0.032
		);
	},
	'arch-ribs': (m) => {
		for (const z of [0.66, 0.98])
			rod(
				m,
				curve((t) => [t, z * (1 - (2 * t - 1) ** 2)]),
				0.034
			);
	},
	'sawtooth-fins': (m) => {
		for (let i = 0; i < 5; i++)
			face(m, [
				[0, i / 5, 0],
				[0.48, i / 5 + 0.09, 0.08],
				[0.28, i / 5 + 0.12, 1],
				[0, i / 5, 1]
			]);
	},
	'cable-harp': (m) => {
		rod(
			m,
			[
				[0.08, 0],
				[0.92, 1]
			],
			0.042
		);
		for (let i = 1; i < 9; i++)
			rod(
				m,
				[
					[i / 10, 0],
					[0.08 + (0.84 * i) / 10, i / 10]
				],
				0.01
			);
	},
	'perforated-shell': (m) =>
		fabric(
			m,
			10,
			12,
			(u, v) => 0.21 + 0.14 * Math.sin(tau * (u + v)),
			(i, j) => (i + 2 * j) % 4 === 1
		),
	'bundled-columns': (m) => {
		for (const u of [0.22, 0.39, 0.61, 0.78])
			rod(
				m,
				curve((t) => [0.5 + (u - 0.5) * (0.42 + 2 * (2 * t - 1) ** 2), t]),
				0.032
			);
	}
};
export const fullHeightShell: AssetRecipe = {
	id: 'full-height-shell',
	variants: shellSystems,
	footprint: [0.8, 3],
	slotNames: ['body'],
	category: 'facades',
	anchors: [mount('facade')],
	draw(index) {
		const m: Mesh = { points: [], triangles: [], lines: [] };
		draw[shellSystems[index]](m);
		return [
			{
				...surface(),
				kind: 'mesh',
				...m,
				points: m.points.map(([d, u, v]) => [d, 3 * (u - 0.5), 9 * v]),
				edges: false
			}
		];
	}
};
