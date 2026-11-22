import type { Vec3 } from '../parametrik/types';
import type { Kit } from './kit';
import { optional, type Lot } from './lot';

/**
 * Memphis: primary solids stacked like blocks, each in its own material. Nothing aligns to a
 * system beyond the plan module; the roof is a wedge, a cube and a cone.
 */
export function drawMemphis(kit: Kit, { width, height, complexity }: Lot) {
	const u = width / 3;
	const s = height / 4.6;
	const x0 = -width / 2;
	const y0 = -width / 2;
	const cell = (i: number, j: number, level = 0): Vec3 => [x0 + i * u, y0 + j * u, level * s];

	// Tower: two cells wide, carrying the roof figures.
	kit.box('shell', cell(0, 1), [2 * u, u, 2.6 * s]);
	kit.wedge('screen', cell(0, 1, 2.6), [u, u, s], 0.08, Math.PI);
	kit.box('shell', cell(1, 1, 2.6), [u, u, 0.9 * s]);
	kit.cone('accent', [x0 + 1.5 * u, y0 + 1.5 * u, 3.5 * s], 0.36 * u, 1.1 * s);

	// Front row: stair with cheek, timber gate under a barrel, chipboard cube.
	const steps = 5;
	kit.box('counter', cell(0, 0), [0.2 * u, u, 1.25 * s]);
	for (let i = 0; i < steps; i++)
		kit.box(
			i % 2 ? 'screen' : 'shell',
			[x0 + 0.2 * u, y0 + (i * u) / steps, 0],
			[0.8 * u, u / steps, ((i + 1) * s) / steps]
		);
	kit.arch('timber', [x0 + 1.5 * u, y0 + 0.5 * u, 0], [u, u, s], 0.2 * u);
	kit.vault('counter', [x0 + 1.5 * u, y0 + 0.5 * u, s], [u, u, 0.42 * s]);
	kit.box('board', cell(2, 0), [u, u, s]);

	// Right wing behind the cube, back column.
	kit.box('check', cell(2, 1), [u, u, 0.9 * s]);
	kit.box('accent', cell(2, 1, 0.9), [u, u, 1.1 * s]);
	kit.box('aggregate', cell(0, 2), [3 * u, u, 1.6 * s]);

	const extras = [
		() => {
			kit.drum('stand', [x0 + 2.5 * u, y0 + 1.5 * u, 2 * s], 0.3 * u, 0.3 * s);
			kit.helix(
				'screen',
				[x0 + 2.5 * u, y0 + 1.5 * u, 2.3 * s],
				[0.3 * u, 0.14 * u, 1.3 * s],
				3,
				0.22
			);
			kit.drum('screen', [x0 + 2.5 * u, y0 + 1.5 * u, 2.3 * s], 0.06 * u, 1.45 * s);
			kit.ball('screen', [x0 + 2.5 * u, y0 + 1.5 * u, 3.8 * s], 0.09 * u);
		},
		() => {
			kit.lattice('frame', cell(2, 0, 1), [u, u, u], [1, 1, 1], 0.2);
			kit.ball('bead', [x0 + 2.5 * u, y0 + 0.5 * u, s + 0.3 * u], 0.3 * u);
		},
		() => {
			const eye: Vec3 = [x0 + 1.5 * u, y0 + u, 3.05 * s];
			kit.ring('signal', eye, [0.27 * u, 0.15 * u, 0.3], Math.PI / 2);
			kit.ring('pane', eye, [0.15 * u, 0, 0.1], Math.PI / 2);
		},
		() => {
			kit.drum('aggregate', [x0 + 2.5 * u, y0 + 2.5 * u, 1.6 * s], 0.36 * u, 1.9 * s);
			kit.drum('timber', [x0 + 2.5 * u, y0 + 2.5 * u, 3.5 * s], 0.2 * u, 0.45 * s);
		},
		() =>
			kit.arch('counter', [x0 + 0.6 * u, y0 + u - 0.06, s], [0.62 * u, 0.24, 0.8 * s], 0.11 * u),
		() => kit.ball('signal', [x0 + 0.5 * u, y0 + 2.5 * u, 1.6 * s + 0.24 * u], 0.24 * u)
	];
	for (const draw of optional(extras, complexity)) draw();
}
