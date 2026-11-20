import { test, expect } from 'bun:test';
import { shellSystems } from '../../src/lib/catalog/data/house-shells';
import { polygonHouseSite } from '../../src/lib/catalog/logic/house-typology';
import { planHouse, sectionParts } from '../../src/lib/catalog/logic/composed-house';
import { checkParcel } from '../../src/lib/catalog/logic/composed-house/parcel-assertions.test-support';
import { polygonCases } from './polygon-cases';

/** Keeps each exterior system on the original ring while the occupied floors vary independently. */
export function shellSubset(shape: string) {
	const ring = [...polygonCases(shape)][0].ring;
	for (const [i, system] of shellSystems.entries())
		test(shape + '/' + system, () => {
			const site = polygonHouseSite(shape, ring, Array(5 + (i % 3)).fill('living'), 81 + i, {
				system,
				section: 'vessel'
			});
			const house = planHouse(site),
				parts = sectionParts(house),
				h = house.composition;
			const skins = parts.filter((p) => p.source.objectId === 'full-height-shell');
			expect(skins).toHaveLength(ring.length);
			for (const p of skins) {
				if (p.kind !== 'mesh') throw Error('Expected full-height surface');
				expect(p.source.variant).toBe(system);
				const zs = p.points.map((q) => q[2]);
				expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThan((house.top - h.ground) * 0.64);
			}
			checkParcel(house, parts);
		});
}
