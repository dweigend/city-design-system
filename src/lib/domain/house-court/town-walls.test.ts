import { expect, test } from 'bun:test';
import { createStripSpace, parcelEdgeId, readStoreyHeight } from '../cell-space';
import {
	createHouseCourt,
	createHouseObject,
	houseFaces,
	houseFigures,
	houseStyles,
	readHousePartRefs,
	type AdjoiningWall
} from './index';

function plot(width: number, depth: number, storeyCount: number, x = 0) {
	return createStripSpace({
		id: `plot-${x}`,
		corners: [
			{ id: 'a', position: [x, 0] },
			{ id: 'b', position: [x + width, 0] },
			{ id: 'c', position: [x + width, depth] },
			{ id: 'd', position: [x, depth] }
		],
		frontage: [parcelEdgeId('a', 'b')],
		baseZ: 0,
		storeyCount
	});
}

test('the corner rise stays within a one-storey cap', () => {
	const space = plot(15, 15, 1);
	const house = createHouseCourt(space, { seed: 0 }, houseStyles.neutral, {
		scale: 'calm',
		corner: true
	});
	expect(houseFigures(space, house).storeys).toBe(1);
});

test('a shallow strip and an entrance that consumes the only cell are reported as garden', () => {
	for (const [width, depth, rise] of [
		[20, 2, 0],
		[7, 7, 2]
	]) {
		const space = plot(width, depth, 1);
		const house = createHouseCourt(space, { seed: 0 }, houseStyles.neutral, {
			scale: 'calm',
			entranceRiseM: rise
		});
		expect(house.unbuildable).toBe('no-built-cells');
		expect(house.cells.every(({ role }) => role === 'garden')).toBe(true);
	}
});

test('a one-storey 70 m hall fits its openings within each wall run', () => {
	const space = plot(70, 70, 1);
	const house = createHouseCourt(space, { seed: 0 }, houseStyles.neutral, { scale: 'large' });
	const pane = createHouseObject(space, house, 'full').parts.find(
		({ slot }) => slot === 'opening'
	)?.shape;
	expect(pane?.kind).toBe('mesh');
	if (pane?.kind === 'mesh')
		expect(Math.max(...pane.positions.filter((_, i) => i % 3 === 2))).toBeLessThanOrEqual(
			readStoreyHeight(space, 0)
		);
	const walls = houseFaces(space, house, 'full').filter(({ place }) => place === 'wall');
	expect(walls.some(({ openings }) => openings.length)).toBe(true);
	for (const {
		openings,
		size: [width, height]
	} of walls)
		for (const [l, b, r, t] of openings) {
			expect(l).toBeGreaterThanOrEqual(0);
			expect(b).toBeGreaterThanOrEqual(0);
			expect(r).toBeLessThanOrEqual(width);
			expect(t).toBeLessThanOrEqual(height);
		}
});

test('two adjoining 15 m houses lose party-wall faces and panes, keeping exposed wall above', () => {
	for (const x of [0, 15]) {
		const space = plot(15, 15, 2, x);
		const house = createHouseCourt(space, { height: 7, seed: 0 }, houseStyles.neutral, {
			scale: 'calm'
		});
		const adjacent: AdjoiningWall =
			x === 0
				? { a: [15, 15], b: [15, 0], bottom: 0, top: 3.5 }
				: { a: [15, 0], b: [15, 15], bottom: 0, top: 3.5 };
		const partyFaces = (adjoining?: AdjoiningWall[]) =>
			houseFaces(space, house, 'full', houseStyles.neutral, adjoining).filter(
				({ place, origin: [wallX], normal: [nx] }) =>
					place === 'wall' && wallX === 15 && nx === (x === 0 ? 1 : -1)
			);
		expect(partyFaces().some(({ openings }) => openings.length > 0)).toBe(true);
		expect(partyFaces([{ ...adjacent, top: 7 }])).toHaveLength(0);
		const exposed = partyFaces([adjacent]);
		expect(exposed.length).toBeGreaterThan(0);
		expect(exposed.every(({ origin: [, , base] }) => base === 3.5)).toBe(true);

		const object = createHouseObject(space, house, 'full', houseStyles.neutral, [
			{ ...adjacent, top: 7 }
		]);
		const context = [{ ...adjacent, top: 7 }];
		const refs = readHousePartRefs(house, 'town-fixture', context);
		expect(refs.map(({ partId, slot }) => [partId, slot])).toEqual(
			object.parts.map(({ id, slot }) => [id, slot])
		);
		const pane = object.parts.find(({ slot }) => slot === 'opening')?.shape;
		expect(pane?.kind).toBe('mesh');
		if (pane?.kind === 'mesh')
			expect(pane.positions.some((p, i) => i % 3 === 0 && Math.abs(p - 15) < 0.06)).toBe(false);
	}
});

test('omits the opening part and its storey refs when adjoining walls cover all windows', () => {
	const space = plot(15, 15, 2);
	const house = createHouseCourt(space, { height: 7, seed: 0 });
	const walls = space.cells.flatMap(({ quad }) =>
		quad.map((b, i): AdjoiningWall => ({
			a: quad[(i + 1) % quad.length],
			b,
			bottom: space.baseZ,
			top: space.storeyElevationsM.at(-1) ?? space.baseZ
		}))
	);
	const original = readHousePartRefs(house, 'town-fixture');
	const opening = original.find(({ slot }) => slot === 'opening');
	expect(opening?.storeyRefs.length).toBeGreaterThan(0);
	const object = createHouseObject(space, house, 'full', houseStyles.neutral, walls);
	const covered = readHousePartRefs(house, 'town-fixture', walls);
	expect(covered.map(({ partId, slot }) => [partId, slot])).toEqual(
		object.parts.map(({ id, slot }) => [id, slot])
	);
	expect(covered.some(({ slot }) => slot === 'opening')).toBe(false);
	expect(readHousePartRefs(house, 'town-fixture', [])).toEqual(original);
});
