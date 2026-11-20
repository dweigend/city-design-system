import { expect, test } from 'bun:test';
import { createFrameStudy } from '../../logic/sandbox';
import type { Primitive } from '../../logic/parametrik/types';
import { createFrameLayer } from './frame-layer';

test('the sandbox draws pending rods, installed sections and the reopened entry on the same stage', () => {
	const study = createFrameStudy();
	const visible = new Map<string, Primitive[]>();
	const layer = createFrameLayer(
		{
			set: (key, forms) => {
				visible.set(key, forms);
			}
		},
		() => {},
		(reason) => {
			throw new Error(reason);
		}
	);
	const key = 'tg/' + study.entrance;
	layer.show(study.at(0, false), 'all');
	expect(visible.size).toBe(0);
	layer.show(study.at(1, false), 'all');
	expect(visible.get(key)?.map((p) => p.planned)).toEqual([true, true, true]);
	const original = study.at(2, false);
	layer.show(original, 'all');
	const installed = original.state.frameInstallations?.get(study.entrance)?.result;
	if (installed?.status !== 'sized') throw new Error('Missing installed entrance frame');
	expect(
		visible
			.get(key)
			?.filter((p) => p.kind === 'pipe')
			.map((p) => p.sectionDiameter)
	).toEqual(installed.rods.map((r) => r.diameter));
	expect(
		visible
			.get(key)
			?.filter((p) => p.kind === 'pipe')
			.map((p) => p.token)
	).toEqual(installed.rods.map(() => '--ink-3'));
	const shoes = visible.get(key)?.flatMap((part) => part.bearings ?? []) ?? [];
	const feet = installed.rods.filter((rod) => rod.id !== '2').map((rod) => rod.a);
	expect(new Set(shoes.map((p) => p.join(',')))).toEqual(new Set(feet.map((p) => p.join(','))));
	expect(shoes).toHaveLength(new Set(feet.map((p) => p.join(','))).size);
	layer.show(study.at(2, true), 'all');
	expect(visible.get(key)).toEqual([]);
	layer.show(study.at(1, false), 'all');
	expect(visible.get(key)?.every((p) => p.planned)).toBe(true);
	layer.show(study.at(1, false), 'all', false);
	expect([...visible.values()].flat()).toHaveLength(0);
	layer.show(original, 'all', false);
	expect(visible.get(key)?.flatMap((p) => p.bearings ?? [])).toEqual(shoes);
	expect(visible.get(key)?.flatMap((p) => (p.kind === 'cylinder' ? [p.position] : []))).toEqual(
		shoes
	);
	layer.dispose();
});
