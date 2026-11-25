import { expect, test } from 'bun:test';
import { bounds, type Vec3 } from '../../lib/core/geometry';
import { shapeArrays } from '../../lib/scene/stage';
import type { Drawable } from '../../lib/scene/surface';
import { houseUseColors } from '../../lib/scene/house-projection';
import { spongePicture } from './sponge';

const states = [
	['dry', 'baseline'],
	['wet', 'baseline'],
	['dry', 'sponge'],
	['wet', 'sponge']
] as const;

const frames = states.map(([condition, measures]) => spongePicture(condition, measures));

function find(drawables: readonly Drawable[], id: string) {
	const part = drawables.find((part) => part.id === id);
	if (!part) throw new Error(`Missing ${id}`);
	return part;
}

function level(drawables: readonly Drawable[], id: string) {
	const { shape } = find(drawables, id);
	if (shape.kind !== 'prism') throw new Error(`Expected a prism for ${id}`);
	return shape.top;
}

test('all four views keep the same district, addressed houses and camera', () => {
	const [first] = frames;
	expect(first.fit.subject?.halfWidth).toBeGreaterThan(0);
	expect(first.district.buildingIds).toEqual(['house/workshop-court', 'house/farm-court']);
	for (const { drawables, transparent, district, fit, view } of frames) {
		expect({ district, fit, view }).toEqual({
			district: first.district,
			fit: first.fit,
			view: first.view
		});
		const ids = drawables.map(({ id }) => id);
		expect(new Set(ids).size).toBe(ids.length);
		expect(transparent.map(({ id }) => id)).toEqual(ids);
		for (const id of district.partIds) {
			const { shape } = find(first.drawables, id);
			expect(find(drawables, id).shape).toEqual(shape);
			expect(find(transparent, id).shape).toEqual(shape);
		}
	}
});

test('the open cistern shows four levels, with one shortage and one spill', () => {
	const storageId = 'cistern/water';
	expect(frames.map(({ storage }) => storage)).toEqual([
		'Shortage',
		'Overflowing',
		'Buffer available',
		'Buffered'
	]);
	expect(frames.map(({ drawables }) => level(drawables, storageId))).toEqual([1.15, 5, 3.2, 4.2]);
	for (const [index, { drawables }] of frames.entries()) {
		expect(drawables.some(({ id }) => id === 'cistern/shortage-marker')).toBe(index === 0);
		expect(drawables.some(({ id }) => id === 'cistern/overflow')).toBe(index === 1);
		expect(drawables.some(({ id }) => id === 'cistern/overflow-apron')).toBe(index === 1);
	}
});

test('the sponge district retains water beside planted banks and both houses gain green roofs', () => {
	const [dryBaseline, wetBaseline, drySponge, wetSponge] = frames;
	const retainedId = 'swale/retained-water';
	for (const [index, { district, drawables }] of frames.entries()) {
		for (const part of ['lawn', 'trunk', 'canopy']) {
			expect(find(drawables, `district/grove/${part}`).shape.kind).toBe('mesh');
		}
		const planted = index >= 2;
		expect(drawables.some(({ id }) => id === retainedId)).toBe(planted);
		expect(find(drawables, 'swale/banks').color).toBe(planted ? '--cat-lawn' : '--ground-stone');
		for (const id of district.buildingIds) {
			const beds = drawables.filter((part) => part.id.startsWith(`${id}/green-roof/`));
			expect(beds.length > 0).toBe(planted);
			expect(beds.every(({ color }) => color === '--cat-grass')).toBe(true);
		}
	}
	expect(dryBaseline.drawables.some(({ id }) => id.startsWith('swale/runoff'))).toBe(false);
	expect(find(wetBaseline.drawables, 'swale/runoff').color).toBe('--river-water');
	expect(level(wetSponge.drawables, retainedId)).toBeGreaterThan(
		level(drySponge.drawables, retainedId)
	);
});

test('addressed storey bodies show stacked uses and become neutral in transparency', () => {
	const [{ drawables, transparent }] = frames;
	for (const [house, upper] of [
		['workshop-court', houseUseColors.housing],
		['farm-court', houseUseColors.greenhouse]
	]) {
		const parts = drawables.filter(
			({ id, useColor }) => id.startsWith(`house/${house}/`) && useColor
		);
		expect(parts.every(({ id }) => /\/datum\/\d+$/.test(id))).toBe(true);
		expect(
			parts.some(({ id, color }) => id.endsWith('/datum/0') && color === houseUseColors.workshop)
		).toBe(true);
		expect(parts.some(({ id, color }) => id.endsWith('/datum/2') && color === upper)).toBe(true);
		expect(parts.every(({ id }) => !find(transparent, id).preserveColor)).toBe(true);
	}
});

function partBounds(part: Drawable) {
	const { positions } = shapeArrays(part.shape);
	const points: Vec3[] = [];
	for (let index = 0; index < positions.length; index += 3)
		points.push([positions[index], positions[index + 1], positions[index + 2]]);
	const extent = bounds(points);
	if (!extent) throw new Error(`No geometry for ${part.id}`);
	return extent;
}

function touches(left: Drawable, right: Drawable) {
	const a = partBounds(left);
	const b = partBounds(right);
	return a.min.every((min, axis) => min <= b.max[axis] && b.min[axis] <= a.max[axis]);
}

test('both color-coded networks connect the same two buildings through joints and risers', () => {
	for (const { district, drawables, transparent } of frames) {
		for (const [kind, color] of [
			['water', '--water'],
			['power', '--energy']
		] as const) {
			const trunk = `conduit/${kind}`;
			for (const id of district.buildingIds) {
				const address = `${trunk}/${id}`;
				for (const part of [
					'branch',
					'riser',
					'service',
					'junction',
					'base-collar',
					'head-collar',
					'entry-collar'
				]) {
					const service = find(drawables, `${address}/${part}`);
					expect(service.shape.kind).toBe('mesh');
					expect(service.color).toBe(color);
					expect(find(transparent, service.id).preserveColor).toBe(true);
				}
			}
			expect(find(drawables, `${trunk}/main`).color).toBe(color);
			expect(find(drawables, `${trunk}/source/junction`).color).toBe(color);
		}
	}
});

test('service geometry physically meets the mains, connectors and ground storeys', () => {
	const [{ drawables, district }] = frames;
	for (const kind of ['water', 'power']) {
		const network = `conduit/${kind}`;
		const trunk = find(drawables, `${network}/main`);
		const source = find(drawables, `${network}/source`);
		const sourceJoint = find(drawables, `${network}/source/junction`);
		expect(touches(trunk, sourceJoint) && touches(sourceJoint, source)).toBe(true);
		for (const house of district.buildingIds) {
			const parts = [
				'junction',
				'branch',
				'base-collar',
				'riser',
				'head-collar',
				'service',
				'entry-collar'
			];
			const path = [trunk, ...parts.map((part) => find(drawables, `${network}/${house}/${part}`))];
			for (let index = 1; index < path.length; index++)
				expect(touches(path[index - 1], path[index])).toBe(true);
			const groundStoreys = drawables.filter(
				({ id }) => id.startsWith(`${house}/`) && id.endsWith('/datum/0')
			);
			expect(
				groundStoreys.some((storey) => touches(storey, path[path.length - 1])),
				`${kind} service entry into ${house}`
			).toBe(true);
		}
	}
});

test('repeated calls produce identical fixed illustrations', () => {
	for (const [index, [condition, measures]] of states.entries()) {
		expect(spongePicture(condition, measures)).toEqual(frames[index]);
	}
});
