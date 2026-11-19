import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BLICK } from '../../data/leitstil';
import { focuses } from '../../logic/presentation';
import {
	acceptanceScene,
	applyEdit,
	createWorld,
	currentStacks,
	houseView,
	type World
} from '../../logic/sandbox';
import { contourWidthMeters } from './contour-width';
import { distanceDrawing } from './distance-drawing';

function chunk(world: World, id: string) {
	const cell = world.grid.cellsById.get(id);
	assert(cell);
	return houseView(world, currentStacks(world.state), cell.chunk, focuses.all);
}
test('the portrait city tread retains its projected surface below the half-pixel outline limit', () => {
	const id = '86/43',
		w = applyEdit(createWorld(7), { kind: 'raise', style: 'collage', use: 'living', cellId: id });
	const tread = chunk(w, id).find((p) => p.id === '86/43@3:roof/86/43/tread-0');
	assert(tread);
	const e = (11 * Math.PI) / 180,
		drawing = distanceDrawing([tread], {
			block: true,
			elevation: e,
			scale: 2.85,
			minContourPx: 0.5
		});
	const [surface] = drawing.parts;
	assert(surface.kind === 'membrane');
	assert(Math.abs(contourWidthMeters(surface, e) * 2.85 - 0.45542534) < 1e-6);
	assert(drawing.unoutlined.has(surface));
});
test('water and greenhouse contours follow the fitted guest in each city projection', () => {
	const vessels = [];
	const study = acceptanceScene();
	const tank = chunk(study.world, '83/44').find((p) => p.id === '83/44@0/83/44/vessel');
	assert(tank?.kind === 'sphere');
	assert(Math.abs(2 * tank.radius * 3.5 - 5.765633) < 1e-6);
	vessels.push(tank);
	const food = applyEdit(createWorld(7), {
		kind: 'raise',
		style: 'megastructure',
		use: 'food',
		cellId: '89/41'
	});
	const greenhouse = chunk(food, '89/41').find(
		(p) => p.id.endsWith('/vessel') && p.material === 'greenhouse'
	);
	assert(greenhouse?.kind === 'sphere');
	vessels.push(greenhouse);
	for (const vessel of vessels)
		for (const elevation of [BLICK.hoeheRad, (11 * Math.PI) / 180, Math.PI / 2]) {
			const width =
				2 *
				vessel.radius *
				Math.min(1, Math.hypot(Math.sin(elevation), (vessel.squash ?? 1) * Math.cos(elevation)));
			assert(Math.abs(contourWidthMeters(vessel, elevation) - width) < 1e-10);
			for (const cutoff of [0.5, 6, 16]) {
				const drawing = distanceDrawing([vessel], {
					block: true,
					elevation,
					scale: 3.5,
					minContourPx: cutoff
				});
				assert.equal(drawing.parts[0], vessel);
				assert.equal(drawing.unoutlined.has(vessel), width * 3.5 < cutoff);
			}
		}
});
