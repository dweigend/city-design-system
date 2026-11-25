import { expect, spyOn, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { defaults } from '../../config/town-review';
import * as houseCourt from '../../lib/domain/house-court';
import { createTownReview } from './town';
import { houseUseColors } from '../../lib/scene/house-projection';

type DetailPass = ReturnType<ReturnType<typeof createTownReview>['createDetailPass']>;

test('only a confirmed silhouette can start a capped and cancellable detail pass', () => {
	const assemblies = spyOn(houseCourt, 'createHouseAssembly');
	const objects = spyOn(houseCourt, 'createHouseObject');
	const fullBuilds = () =>
		[...assemblies.mock.calls, ...objects.mock.calls].filter(([, , detail]) => detail === 'full');
	try {
		const town = createTownReview();
		const first = town.draw('houses');
		expect(town.figures.triangles).toBe(0);
		expect(first.some(({ id }) => id.includes('/clad/') || id.includes('/opening'))).toBe(false);
		expect(first.filter(({ id }) => id.startsWith('["grove",'))).toHaveLength(87);
		expect(first.some(({ id, visible }) => visible && id.includes('/addition-frame/'))).toBe(true);
		expect(assemblies.mock.calls.length + objects.mock.calls.length).toBeGreaterThan(0);
		expect(fullBuilds()).toHaveLength(0);

		let time = 0;
		const now = () => (time += 100); // One job per advance with this clock.
		const interrupted = town.createDetailPass(now);
		expect(interrupted.advance()).toBeUndefined();
		expect(fullBuilds()).toHaveLength(0);
		interrupted.confirmSilhouette();
		expect(interrupted.advance()).toBeUndefined();
		expect(fullBuilds()).toHaveLength(1);

		interrupted.cancel();
		expect(interrupted.advance()).toBeUndefined();
		expect(fullBuilds()).toHaveLength(1);

		const next = town.createDetailPass(now);
		expect(next.advance()).toBeUndefined();
		expect(fullBuilds()).toHaveLength(1);
		next.confirmSilhouette();
		let settled: ReturnType<typeof next.advance>;
		for (let frame = 0; frame < 100 && !settled; frame++) settled = next.advance();
		if (!settled) throw new Error('The town did not settle');
		const built = fullBuilds();
		expect(built.length).toBeGreaterThan(0);
		expect(built.length).toBeLessThanOrEqual(defaults.detailedHouseCap);
		expect(built).toHaveLength(48);
		expect(new Set(built.map(([space]) => space.id)).size).toBe(built.length);
		expectSettlement(settled);
	} finally {
		objects.mockRestore();
		assemblies.mockRestore();
	}
}, 30_000);

function expectSettlement(town: NonNullable<ReturnType<DetailPass['advance']>>) {
	const draw = town.draw('town');
	// Stable drawable ordering and IDs from the seed-3 rebuild before the progressive pipeline.
	expect(draw.some(({ id }) => id.startsWith('structure/'))).toBe(false);
	const ids = draw.map(({ id }) => id);
	expect(new Set(ids).size).toBe(ids.length);
	expect(createHash('sha256').update(JSON.stringify(ids)).digest('hex')).toBe(
		'30df677924a542eb79c2bf431e551cff620def46f134cd87f8f85dc94a151f72'
	);
	expect(town.figures.parks).toEqual({
		parks: 17,
		shore: 12,
		gardens: 19,
		greenBlocks: 2,
		drawables: 144,
		triangles: 6277
	});
	expect(town.figures.unbuildable).toBe(26);
	// Centering stripe bands within each fitted period adds 12 clipped triangles across 6 faces.
	expect(town.figures.triangles).toBe(1080);
	const structure = town.draw('structure');
	expect(structure.some(({ id, visible }) => id.startsWith('structure/') && visible)).toBe(true);
	expect(draw.every(({ shape }, index) => shape === structure[index]?.shape)).toBe(true);

	const normal = draw.filter(({ useColor }) => useColor !== undefined);
	const focus = town.draw('houses').filter(({ useColor }) => useColor !== undefined);
	expect(new Set(focus.map(({ color }) => color))).toEqual(new Set(Object.values(houseUseColors)));
	expect(normal.some(({ color }) => color === '--stock-pencil' || color === '--stock-veil')).toBe(
		true
	);
	expect(
		normal.some(({ color, finish }) => color === '--model-acrylic' && finish === 'glass')
	).toBe(true);
	expect(draw.some(({ id, visible }) => visible && id.includes('/addition-frame/'))).toBe(true);
	expect(town.figures.walkwaysKm).toBeGreaterThan(0);
	expect(focus).toHaveLength(normal.length);
	for (const [index, body] of normal.entries()) {
		expect(focus[index].shape).toBe(body.shape);
		expect(body.preserveColor).toBeUndefined();
		expect(focus[index]).toMatchObject({
			color: body.useColor,
			preserveColor: true,
			hatch: undefined,
			occlude: undefined
		});
	}
	const pathHouses = town.draw('paths').filter(({ useColor }) => useColor !== undefined);
	expect(
		pathHouses.every(({ preserveColor, color }) => !preserveColor && color === '--paper')
	).toBe(true);
}
