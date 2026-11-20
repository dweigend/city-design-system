import { test, expect } from 'bun:test';
import { openingScene, cityCentreView } from '../sandbox';
import { houseSurfaces } from '../composed-house';
import { area } from '../ansicht/geometrie';
import { intersect, shoelaceArea } from '../parametrik/raster/geometry';
import { publicFlight } from './town-deck';
import { walkingPlates } from './town-survey.test-support';

test('an unsupported ground span uses plain cast paving', () => {
	const parts = publicFlight({ id: 'ground', a: [0, 0, 0.2], b: [5, 0, 0.2] }, () => 0);
	expect(parts.find((p) => p.kind === 'prism')).toMatchObject({
		token: '--paper',
		finish: 'beton-schalung',
		material: 'concrete'
	});
});

test('a tread crossing the grid edge has finite retaining faces up to its soffit', () => {
	const parts = publicFlight({ id: 'edge', a: [0, 0, 0.2], b: [5, 0, 0.2] }, (_, y) =>
		y < 0 ? NaN : 0
	);
	const foot = parts.find((p) => p.kind === 'mesh' && p.id === 'edge/pier/foot');
	if (foot?.kind !== 'mesh') throw Error('Missing retaining face at the grid edge');
	expect(foot.points.flat().every(Number.isFinite)).toBe(true);
	expect(foot.points.filter(([, y]) => y < 0).every(([, , z]) => z === 0)).toBe(true);
	expect(foot.points.some(([, y, z]) => y > 0 && z < 0)).toBe(true);
});

for (const seed of [7, 13, 29])
	test(
		'single flush walking surfaces on ' + seed,
		() => {
			const parts = cityCentreView(openingScene(seed).world),
				faces = walkingPlates(parts);
			expect(faces.length).toBeGreaterThan(0);
			expect(
				parts
					.filter(
						(p) =>
							(p.id.startsWith('town-walk/') || p.id.startsWith('court/')) &&
							p.finish === 'holz-natur'
					)
					.map((p) => p.id)
			).toEqual([]);
			const courts = faces.filter((p) => /^court\/\d+\/\d+$/.test(p.id));
			expect(new Set(courts.map((p) => p.finish))).toEqual(
				new Set(['beton-schalung', 'beton-terrazzo'])
			);
			const joints = faces.filter((p) => p.id.startsWith('town-walk/joint/'));
			expect(joints.some((p) => p.token === houseSurfaces.access.token)).toBe(true);
			const checked = faces.map((p) => {
				expect(p.finish, p.id).not.toBe('holz-natur');
				if (p.token === houseSurfaces.access.token) expect(p.finish).toBe('kunststoff-formteil');
				if (p.id.startsWith('town-walk/platform/'))
					expect(p).toMatchObject({ token: '--paper', finish: 'beton-schalung' });
				return {
					p,
					polygon: shoelaceArea(p.polygon) < 0 ? [...p.polygon].reverse() : p.polygon,
					top: p.z + p.height
				};
			});
			for (const [i, a] of checked.entries())
				for (const b of checked.slice(i + 1)) {
					if (Math.abs(a.top - b.top) > 1e-7) continue;
					expect(
						area(intersect(a.polygon, b.polygon)),
						a.p.id + ' / ' + b.p.id
					).toBeLessThanOrEqual(0.0001);
				}
		},
		30000
	);
