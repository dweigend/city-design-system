import { membranePanel } from '../../src/lib/catalog/logic/composed-house/membrane-panel';
import { expect, test } from 'bun:test';
import { planHouse, sectionParts } from '../../src/lib/catalog/logic/composed-house';
import {
	polygonHouseSite,
	type HouseEnvelope,
	type HouseSite
} from '../../src/lib/catalog/logic/house-typology';
import { polygonCases } from './polygon-cases';
import { cases, type Variant } from './sites';
import { auditPolygon } from './polygon-subset';

type Restraint = NonNullable<HouseEnvelope['fabric']>['restraint'];
function cloth(
	site: HouseSite,
	restraint: Restraint,
	pressure: number,
	tension: number,
	twist: number
) {
	const house = planHouse({
		...site,
		envelope: {
			system: 'inflated-cushion',
			section: 'vessel',
			twist,
			fabric: { restraint, pressure, tension }
		}
	});
	const parts = sectionParts(house);
	const shell = house.composition.exterior;
	const fabric = shell?.fabric;
	if (!shell || !fabric) throw Error('Missing textile envelope');
	// Compare material stations before the entrance cut creates load-dependent vertices.
	const points = shell.ring.flatMap((_, i) => membranePanel(shell, i, 0, 1, fabric).points);
	return { house, parts, points };
}
function sites() {
	const polygons = ['triangle', 'pentagon', 'amorphous'].map((name) => {
		const ring = [...polygonCases(name)][0].ring;
		return { name, site: polygonHouseSite(name, ring, Array(7).fill('living'), 91) };
	});
	const grids: Variant[] = ['regular', 'organic', 'rotated', 'mixed', 'hillside'];
	const footprints = ['L', 'T', 'U', 'court', 'irregular', 'strip', 'small', 'large'].map(
		(name, i) => {
			const item = cases(grids[i % 5]).find((c) => c.name.endsWith('/' + name + '/7'));
			if (!item) throw Error('Missing textile survey');
			return { name: item.name, site: item.sites[0] };
		}
	);
	return [...polygons, ...footprints];
}
/** Loads the same free membrane at two tensions and checks its anchored geometry and actual parcel fit. */
export function textileSubset(restraint: Restraint) {
	for (const { name, site } of sites())
		test(restraint + '/' + name, () => {
			const rest = cloth(site, restraint, 0, 1, 0.75),
				stiff = cloth(site, restraint, 2, 5, 0.75),
				full = cloth(site, restraint, 2, 1, 0.75);
			const distance = (p: number[], q: number[]) => Math.hypot(p[0] - q[0], p[1] - q[1]);
			let max = 0,
				minimumGain = Infinity,
				fixed = 0,
				anchorDrift = 0;
			for (const [i, p] of rest.points.entries()) {
				const movement = distance(p, full.points[i]);
				minimumGain = Math.min(minimumGain, movement - distance(p, stiff.points[i]));
				max = Math.max(movement, max);
				if (
					Math.abs(p[2] - rest.house.top) < 1e-8 ||
					Math.abs(p[2] - rest.house.composition.ground) < 1e-8
				)
					anchorDrift = Math.max(anchorDrift, movement);
				if (movement < 1e-8) fixed++;
			}
			expect(max).toBeGreaterThan(1e-6);
			expect(minimumGain).toBeGreaterThanOrEqual(-1e-8);
			expect(fixed).toBeGreaterThan(0);
			expect(anchorDrift).toBeLessThan(1e-8);
			const shell = full.house.composition.exterior;
			expect(shell?.stations[0].ring).toEqual(shell?.ring);
			if (name.includes('/court/')) {
				const inner = full.parts.filter(
					(p) => p.id.includes('/exterior/') && p.id.includes('/court/')
				);
				expect(inner.length).toBeGreaterThanOrEqual(4);
				expect(inner).toHaveLength(shell?.courtWalls.length ?? 0);
			}
			auditPolygon(restraint + '/' + name, site.seed, full.house, full.parts);
			console.log('FABRIC', restraint, name, 'max displacement (m)', max);
		});
}
