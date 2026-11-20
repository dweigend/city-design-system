import { membraneResponse } from '../membrane';
import { shellSystems, type ShellSystem } from '../../data/house-shells';
import { mount, type AssetRecipe } from './definition';
import { surface } from './parts';
import type { Vec3 } from '../parametrik/types';

import { face, sweepRib, fabric, curve, tau, type Mesh } from './shell-mesh';
import { foldedWall, foldedSkins } from './folded-wall';

type Draw = (m: Mesh) => void;
const draw: Record<ShellSystem, Draw> = {
	...foldedSkins,
	// A heavy wall cut by a single stepped portal in each bay.
	'quarry-portals': (m) =>
		fabric(
			m,
			10,
			12,
			(u) => 0.42 * Math.abs(2 * u - 1),
			(i, j) => j < 7 && i >= 3 && i <= 6 && j < 7 - Math.abs(i - 4.5)
		),
	// Broad overlapping sheets curl away from a narrow diagonal seam.
	'lapped-sails': (m) => {
		for (let course = 0; course < 3; course++)
			for (let i = 0; i < 8; i++) {
				const rib = (u: number, top: boolean): Vec3 => [
					top ? 0.72 * Math.sin(Math.PI * u) : -0.3,
					u,
					Math.min(
						1,
						Math.max(0, (course + (top ? (course === 2 ? 1.14 : 0.88) : 0) + 0.28 * (u - 0.5)) / 3)
					)
				];
				const a = i / 8,
					b = (i + 1) / 8;
				face(m, [rib(a, false), rib(b, false), rib(b, true), rib(a, true)]);
			}
	},
	// Silo flutes terminate in a belt of projecting, four-facet lantern panes.
	'prismatic-lantern': (m) => {
		fabric(
			m,
			12,
			6,
			(u) => 0.42 * Math.cos(tau * 3 * u),
			(_, j) => j >= 4
		);
		for (let i = 0; i < 3; i++) {
			const a = i / 3,
				b = (i + 1) / 3;
			const ring: Vec3[] = [
				[0, a, 2 / 3],
				[0, b, 2 / 3],
				[0, b, 1],
				[0, a, 1]
			];
			for (const j of [0, 1, 3]) face(m, [ring[j], ring[(j + 1) % 4], [0.92, (a + b) / 2, 0.84]]);
		}
	},
	'tensile-sail': (m) =>
		fabric(
			m,
			10,
			12,
			(u, v) => 0.66 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v) + 0.22 * (u - v) ** 2,
			(i, j) => Math.abs(i - 4.5 - 2 * Math.sin((j / 12) * Math.PI)) < 1.2 && j > 1 && j < 11
		),
	'inflated-cushion': (m) =>
		fabric(
			m,
			12,
			16,
			(u, v) =>
				membraneResponse(
					{ pressure: 2, tension: 1, restraint: 'net' },
					3,
					4.5,
					u,
					(v * 2) % 1,
					0.65
				).fraction * 0.65,
			(i, j) => (i === 5 || i === 6) && j % 8 > 0 && j % 8 < 7
		),
	'pleated-sheet': (m) =>
		fabric(
			m,
			12,
			6,
			(u, v) => 0.52 * Math.abs(((u * 6 + v) % 1) - 0.5) * 2,
			(i, j) => (i + j) % 6 === 2
		),
	'woven-basket': (m) => {
		for (let k = -4; k <= 4; k++)
			for (const sign of [-1, 1]) {
				const p = curve((t) => [k / 4 + t * sign, t], 24).filter(([u]) => u >= 0 && u <= 1);
				sweepRib(m, p, 0.013);
			}
	},
	diagrid: (m) => {
		for (let j = 0; j < 2; j++) {
			sweepRib(
				m,
				[
					[0, j / 2],
					[1, (j + 1) / 2]
				],
				0.032
			);
			sweepRib(
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
		sweepRib(
			m,
			[
				[0.5, 0],
				[0.5, 0.38]
			],
			0.06
		);
		for (const u of [0.2, 0.8]) {
			sweepRib(
				m,
				[
					[0.5, 0.38],
					[u, 0.7]
				],
				0.039
			);
			for (const dx of [-0.18, 0.18])
				sweepRib(
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
				sweepRib(
					m,
					curve((t) => [i / 5 + 0.1 + s * 0.09 * Math.sin(Math.PI * t), t]),
					0.016
				);
	},
	'suspended-curtain': (m) => {
		fabric(
			m,
			12,
			8,
			(u, v) => 0.17 * Math.cos(tau * 3 * u) * (1 - v) + 0.21,
			(i, j) => i % 6 === 3 && j > 0 && j < 7
		);
		for (const u of [0.15, 0.85])
			sweepRib(
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
			sweepRib(
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
			sweepRib(
				m,
				curve((t) => [0.5 + 0.4 * Math.sin(tau * (t + phase)), t], 24),
				0.034,
				0.17
			);
	},
	'fan-truss': (m) => {
		for (let i = 0; i <= 6; i++)
			sweepRib(
				m,
				[
					[0.12, 0],
					[i / 6, 1]
				],
				0.017
			);
		sweepRib(
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
			sweepRib(
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
		sweepRib(
			m,
			[
				[0.08, 0],
				[0.92, 1]
			],
			0.042
		);
		for (let i = 1; i < 9; i++)
			sweepRib(
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
			sweepRib(
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
		const system = shellSystems[index];
		foldedWall(m, system);
		draw[system](m);
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
