import { expect, test } from 'bun:test';
import { polygonHouseSite } from '../../src/lib/catalog/logic/house-typology';
import { planHouse, sectionParts } from '../../src/lib/catalog/logic/composed-house';
import { polygonCases } from './polygon-cases';
import { checkParcel } from '../../src/lib/catalog/logic/composed-house/parcel-assertions.test-support';

for (const shape of ['triangle', 'pentagon', 'amorphous'])
	for (const twist of [-0.75, 0.75]) {
		test(shape + ' / progressive signed twist ' + twist, () => {
			const ring = [...polygonCases(shape)][0].ring;
			const house = (angle: number) =>
				planHouse(
					polygonHouseSite(shape, ring, Array(7).fill('living'), 91, {
						system: 'inflated-cushion',
						section: 'vessel',
						twist: angle
					})
				);
			const original = house(0),
				turned = house(twist),
				shell = turned.composition.exterior;
			const baseline = original.composition.exterior;
			if (!shell || !baseline) throw Error('Missing envelope');
			const rates = shell.stations.flatMap((s, i) => {
				if (s.atBoundary) return [];
				const heading = (r: typeof ring) => Math.atan2(r[1][1] - r[0][1], r[1][0] - r[0][0]);
				const diff = heading(s.ring) - heading(baseline.stations[i].ring);
				return [
					Math.atan2(Math.sin(diff), Math.cos(diff)) /
						((s.z - shell.bottom) / (shell.top - shell.bottom))
				];
			});
			expect(Math.min(...rates.map((v) => v * Math.sign(twist)))).toBeGreaterThan(0);
			expect(Math.max(...rates) - Math.min(...rates)).toBeLessThan(1e-8);
			expect(shell.stations[0]).toEqual(baseline.stations[0]);
			checkParcel(turned, sectionParts(turned));
			console.log('TWIST', shape, twist, 'fitted roof radians', rates.at(-1));
		});
	}

test('a pressurised skin keeps the diagrid carrier on the same surveyed section', () => {
	const ring = [...polygonCases('pentagon')][0].ring;
	const fabric = { pressure: 1, tension: 2, restraint: 'net' } as const;
	const walls = (system: 'diagrid' | 'inflated-cushion', load?: typeof fabric) => {
		const house = planHouse(
			polygonHouseSite('study', ring, Array(7).fill('living'), 91, {
				system,
				twist: 0,
				section: 'vessel',
				fabric: load
			})
		);
		return sectionParts(house)
			.filter((p) => p.source.objectId === 'full-height-shell')
			.flatMap((p) => (p.kind === 'mesh' ? [p] : []));
	};
	const carrier = walls('diagrid'),
		cloth = walls('inflated-cushion', fabric),
		combined = walls('diagrid', fabric);
	for (const [i, p] of combined.entries()) {
		expect(p.triangles.length).toBe(carrier[i].triangles.length + cloth[i].triangles.length);
		expect(p.points.slice(cloth[i].points.length)).toEqual(carrier[i].points);
	}
});
