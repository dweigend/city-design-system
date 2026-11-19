import { expect, spyOn, test } from 'bun:test';
import { random } from '../../core/random';
import * as hardware from '../megastructure';
import { atSocket, moduleGroup, socketBounds, type ModuleRod } from './module-group';

const pitch = 1.5;
function placements(rods: ModuleRod[], recipe: 'capsule' | 'solar-ring') {
	return rods.flatMap((rod, index) =>
		[0.5, 0.32, 0.68, 0.2, 0.8].flatMap((share) => {
			const seat = atSocket(
				rod,
				share,
				recipe,
				rods.filter((other) => other !== rod),
				pitch
			);
			return seat ? [{ index, share, center: seat.shell.center, bounds: socketBounds(seat) }] : [];
		})
	);
}
type Placement = ReturnType<typeof placements>[number];
function allowed(a: Placement, b: Placement) {
	return (
		Math.hypot(a.center[0] - b.center[0], a.center[1] - b.center[1]) <= 6 * pitch &&
		!a.bounds.some((box) => b.bounds.some((other) => hardware.dockBoundsOverlap(box, other)))
	);
}

function exhaustive(rods: ModuleRod[]) {
	const lower = placements(rods, 'capsule'),
		upper = placements(rods, 'solar-ring');
	for (let i = 0; i < lower.length; i++) {
		for (let j = i + 1; j < lower.length; j++) {
			if (!allowed(lower[i], lower[j])) continue;
			for (const u of upper) {
				if (allowed(lower[i], u) && allowed(lower[j], u))
					return [lower[i], lower[j], u].map((p) => [p.index, p.share]);
			}
		}
	}
}

function compare(rods: ModuleRod[]) {
	const reference = exhaustive(rods);
	const probe = spyOn(hardware, 'dockModule');
	try {
		const result = moduleGroup(rods, rods, 'energy', [], pitch, {
			seed: 7,
			cell: (r) => String(rods.indexOf(r))
		});
		expect(probe.mock.calls.length).toBeLessThanOrEqual(15 * rods.length);
		expect(result?.map((p) => [rods.indexOf(p.rod), p.share])).toEqual(reference);
		return !!result;
	} finally {
		probe.mockRestore();
	}
}
function rod(x: number, y: number, length: number, vertical: boolean): ModuleRod {
	return {
		a: [x, y, 0],
		b: [x + (vertical ? 0 : length), y + (vertical ? length : 0), 0],
		radius: 0.09
	};
}

test('inclusive nine-metre socket reach across zero on either axis', () => {
	for (const vertical of [false, true]) {
		const pair = (a: number, b: number) =>
			[a, b].map((v) => rod(vertical ? v : 0, vertical ? 0 : v, 4.5, vertical));
		for (const offset of [-Number.EPSILON, 0, Number.EPSILON]) {
			expect(compare(pair(offset, 9))).toBe(true);
			expect(compare(pair(-9, offset))).toBe(true);
		}
		expect(compare(pair(-2e-15, 9))).toBe(false);
	}
});

test('indexed and exhaustive searches select the same ordered seats on seeded rod layouts', () => {
	const draw = random(719);
	let accepted = 0;
	for (let layout = 0; layout < 384; layout++) {
		const count = 2 + Math.floor(draw() * 4);
		const coordinate = () =>
			(Math.floor(draw() * 7) - 3) * 9 +
			(draw() < 0.5 ? (draw() - 0.5) * 8 : (draw() - 0.5) * 1e-14);
		const rods = Array.from({ length: count }, () =>
			rod(coordinate(), coordinate(), draw() < 0.8 ? 4.5 : 4.5 + draw() * 12, draw() < 0.5)
		);
		if (compare(rods)) accepted++;
	}
	expect(accepted).toBeGreaterThan(0);
	expect(accepted).toBeLessThan(384);
});

test('finite extreme translations terminate and preserve exhaustive survey order', () => {
	for (const x of [1e15, 9 * 2 ** 52, 9 * 2 ** 53, -9 * 2 ** 54, 1e300, -1e300]) {
		for (const vertical of [true, false]) {
			const rods = [0, 10].map((offset) =>
				rod(vertical ? x : offset, vertical ? offset : x, 4.5, vertical)
			);
			compare(rods);
			compare([rod(0, 0, 4.5, vertical), ...rods]);
		}
	}
});
