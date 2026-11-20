import { expect, test } from 'bun:test';
import { buildObject } from './index';
import { STORY } from '../../data/grid';

for (const span of [2.5, 3.75, 5, 7.5, 10])
	for (const storeys of [1, 2]) {
		const radius = span < 5 ? 0.3 : 0.45;
		const id = 'kit-band-body-' + storeys + 's-' + String(span).replace('.', 'p') + 'm';
		test(id + ' recesses its window band on both axes', () => {
			for (const variant of ['plain', 'porthole-row', 'corner-window']) {
				const { geometry, footprint } = buildObject(id, variant, 17);
				const windows = geometry.filter((p) => p.slot === 'glass');
				expect(windows.length).toBe(storeys);
				for (const [floor, band] of windows.entries()) {
					if (band.kind !== 'prism') throw Error('Expected continuous recessed glazing');
					expect(band.z).toBe(1 + floor * STORY);
					expect(band.height).toBe(1);
					for (const axis of [0, 1])
						expect(footprint[axis] / 2 - Math.max(...band.polygon.map((p) => p[axis]))).toBeCloseTo(
							0.35
						);
				}
				const base = buildObject(
					'kit-plinth-chamfer-' + String(span).replace('.', 'p') + 'm',
					'standard',
					17
				).geometry[0];
				if (base.kind !== 'prism') throw Error('Expected chamfered base');
				for (const axis of [0, 1])
					expect(Math.max(...base.polygon.map((p) => p[axis])) - footprint[axis] / 2).toBeCloseTo(
						0.3
					);
				const roof = geometry.find(
					(p) => p.kind === 'mesh' && p.points.some((q) => q[2] === storeys * STORY)
				);
				if (roof?.kind !== 'mesh') throw Error('Expected a cast roof edge');
				const top = roof.points.filter((p) => p[2] === storeys * STORY);
				expect(footprint[0] / 2 - Math.max(...top.map((p) => p[0]))).toBeCloseTo(radius, 2);
			}
		});
	}
