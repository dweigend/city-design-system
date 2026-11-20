import { expect, test } from 'bun:test';
import { squareGrid } from '../quad-grid';
import { houseObject } from './house-object';
import { footprint, plotCovers } from './parcel-footprint';
import { parcelFitsRail } from './stair-parcel';
import { deckCovers } from './parcel-assertions.test-support';

type XY = [number, number];
const square = (x: number, y: number, w: number, d: number): XY[] => [
	[x, y],
	[x + w, y],
	[x + w, y + d],
	[x, y + d]
];

test('a bearing plate bridging a gap between two cells is outside the plot although every vertex lies in a cell', () => {
	const cells = [{ corners: square(0, 0, 4, 4) }, { corners: square(7, 0, 4, 4) }];
	const bridge = { ring: square(1, 1, 9, 2), holes: [] };
	expect(
		bridge.ring.every(([x, y]) =>
			cells.some((c) => x >= c.corners[0][0] && x <= c.corners[1][0] && y >= 0 && y <= 4)
		)
	).toBe(true);
	expect(plotCovers(cells, bridge, 0)).toBe(false);
	expect(plotCovers(cells, { ring: square(0.5, 0.5, 3, 3), holes: [] }, 0)).toBe(true);
	expect(
		plotCovers(
			[{ corners: square(0, 0, 4, 4) }, { corners: square(4, 0, 4, 4) }],
			{ ring: square(1, 1, 6, 2), holes: [] },
			0
		)
	).toBe(true);
});

test('a cantilever is allowed its margin and no more', () => {
	const cells = [{ corners: square(0, 0, 4, 4) }];
	expect(plotCovers(cells, { ring: square(-0.5, 0, 5, 4), holes: [] }, 0.6)).toBe(true);
	expect(plotCovers(cells, { ring: square(-0.9, 0, 5, 4), holes: [] }, 0.6)).toBe(false);
});

test('an occupant straddling a deck opening is off the deck although its corners stand on it', () => {
	const deck = { ring: square(0, 0, 6, 4), holes: [square(2.6, 1.6, 0.8, 0.8)] };
	const bench = { ring: square(2, 1.2, 2, 1.6), holes: [] };
	expect(bench.ring.every(([x, y]) => x >= 0 && x <= 6 && y >= 0 && y <= 4)).toBe(true);
	expect(deckCovers(deck, bench)).toBe(false);
	expect(deckCovers(deck, { ring: square(0.2, 0.2, 2, 1.2), holes: [] })).toBe(true);
	const notched: XY[] = [
		[0, 0],
		[6, 0],
		[6, 4],
		[4, 4],
		[4, 2],
		[2, 2],
		[2, 4],
		[0, 4]
	];
	expect(deckCovers({ ring: notched, holes: [] }, { ring: square(1, 2.5, 4, 1), holes: [] })).toBe(
		false
	);
});

test('a centimetre slot between grid samples rejects overlap and permits boundary contact', () => {
	const cells = [{ corners: square(0, 0, 3.037, 5) }, { corners: square(3.047, 0, 4, 5) }];
	const deck = { ring: square(0, 0, 7, 5), holes: [square(3.037, 0.5, 0.01, 4)] };
	for (const [x, covered] of [
		[2, false],
		[0.5, true],
		[0, true],
		[1.037, true]
	] as const) {
		const shape = { ring: square(x, 1, 2, 2), holes: [] };
		expect(plotCovers(cells, shape, 0)).toBe(covered);
		expect(deckCovers(deck, shape)).toBe(covered);
	}
});

test('mounted railing bays respect the common cantilever margin and parcel gaps', () => {
	const cell = squareGrid(1, 1, 4).cells[0];
	const [x, y] = cell.corners[0];
	const rail = houseObject('railing', 'standard', 0, { instanceId: 'rail', slots: {} }).parts[0];
	if (rail.kind !== 'pipe') throw Error('Missing rail tube');
	const fitted = (outside: number) => ({
		...rail,
		points: [1, 3].map((dx) => [x + dx, y - outside + rail.radius, 1] as [number, number, number])
	});
	expect(parcelFitsRail({ cells: [cell] }, fitted(0.59))).toBe(true);
	expect(parcelFitsRail({ cells: [cell] }, fitted(0.61))).toBe(false);
	const row = squareGrid(3, 1, 4).cells;
	const [start, end] = [row[0], row[2]].map((c) => c.corners[0]);
	expect(
		parcelFitsRail(
			{ cells: [row[0], row[2]] },
			{ ...rail, points: [start, end].map(([u, v]) => [u + 2, v + 2, 1]) }
		)
	).toBe(false);
});

test('cantilever corners follow the 0.6 metre disk', () => {
	const cells = [{ corners: square(0, 0, 4, 4) }];
	for (const [distance, allowed] of [
		[0.59, true],
		[0.61, false]
	] as const) {
		const offset = -distance / Math.sqrt(2);
		expect(plotCovers(cells, { ring: square(offset, offset, 0.1, 0.1), holes: [] }, 0.6)).toBe(
			allowed
		);
	}
});

test('the full tube radius counts between twelve sampled directions', () => {
	const angle = Math.PI / 12,
		c = Math.cos(angle),
		s = Math.sin(angle);
	const cell = { corners: square(-4, -2, 4, 4).map(([x, y]) => [c * x - s * y, s * x + c * y]) };
	const member = houseObject('railing', 'standard', 0, { instanceId: 'rail', slots: {} }).parts[0];
	if (member.kind !== 'pipe') throw Error('Missing tube');
	const radius = 0.5,
		centre = 0.6 - radius + 0.01;
	const tube = {
		...member,
		radius,
		points: [-1, 1].map(
			(t) => [centre * c - t * s, centre * s + t * c, 1] as [number, number, number]
		)
	};
	expect(centre + radius * Math.cos(angle)).toBeLessThan(0.6);
	expect(plotCovers([cell], footprint(tube), 0.6)).toBe(false);
});
