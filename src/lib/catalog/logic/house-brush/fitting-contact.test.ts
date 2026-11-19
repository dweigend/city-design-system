import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { atSocket, type ModuleRecipe } from './module-group';
import { shellForms } from './style-totem';
import { castingSeed } from './ceramic-fitting';

const pitch = 1.7;
for (const recipe of [
	'tank',
	'solar-ring',
	'garden',
	'workshop',
	'access',
	'ceramic'
] satisfies ModuleRecipe[]) {
	test(recipe + ' meets its capsule side within the socket seam', () => {
		for (const share of [0.32, 0.68]) {
			const seat = atSocket(
				{ a: [0, 0, 0], b: [18, 0, 0], radius: 0.09 },
				share,
				recipe,
				[],
				pitch,
				castingSeed(7, '90/40')
			);
			assert(seat?.accent);
			const [sx, , sz] = seat.shell.center;
			const surface = shellForms('p/contact', recipe, seat)[2];
			assert(surface);
			let gap: number;
			if (surface.kind === 'mesh') {
				gap = Math.min(...surface.points.map(([x, , z]) => Math.hypot(x - sx, z - sz) - pitch));
			} else if (surface.kind === 'sphere') {
				gap =
					Math.hypot(surface.position[0] - sx, surface.position[2] - sz) - surface.radius - pitch;
			} else if (surface.kind === 'torus') {
				gap =
					Math.hypot(
						Math.abs(surface.position[0] - sx) - surface.radius,
						surface.position[2] - sz
					) -
					surface.tube -
					pitch;
			} else {
				assert(surface.kind === 'box');
				const end = seat.accent.center;
				gap =
					Math.hypot(
						Math.abs(end[0] - sx) - surface.size[1] / 2,
						end[2] + surface.size[2] / 2 - sz
					) - pitch;
			}
			assert(gap <= 0.002 && gap >= (recipe === 'tank' ? -0.081 : -0.01), String(gap));
		}
	});
}
