import { expect, test } from 'bun:test';
import { deckCovers, plotCovers } from './parcel-assertions.test-support';

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
