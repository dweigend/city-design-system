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
	expect(visible.get(key)?.map((p) => p.sectionDiameter)).toEqual(
		installed.rods.map((r) => r.diameter)
	);
	layer.show(study.at(2, true), 'all');
	expect(visible.get(key)).toEqual([]);
	layer.show(study.at(1, false), 'all');
	expect(visible.get(key)?.every((p) => p.planned)).toBe(true);
	layer.dispose();
});
