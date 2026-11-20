import { expect, test } from 'bun:test';
import { shellSystems } from '../../src/lib/catalog/data/house-shells';
import { planHouse, sectionParts } from '../../src/lib/catalog/logic/composed-house';
import { auditPolygon } from './polygon-subset';
import { cases, type Variant } from './sites';

const variants: Variant[] = ['regular', 'organic', 'rotated', 'mixed', 'hillside'];

/** Crosses all sixteen systems with one footprint, rotating grid and terrain between cases. */
export function gridShellSubset(shape: string, offset: number) {
	for (const [i, system] of shellSystems.entries()) {
		const variant = variants[(i + offset) % variants.length];
		const item = cases(variant).find((c) => c.name === variant + '/' + shape + '/7');
		if (!item) throw Error('Unknown footprint ' + shape);
		const name = [variant, shape, system].join('/');
		test(name, () => {
			const house = planHouse({ ...item.sites[0], envelope: { system } });
			const parts = sectionParts(house);
			const exterior = house.composition.exterior;
			if (!exterior) throw Error('Missing parcel envelope');
			expect(parts.filter((p) => p.source.objectId === 'full-height-shell')).toHaveLength(
				exterior.faces.filter(Boolean).length
			);
			expect(exterior.system).toBe(system);
			auditPolygon(name, item.seed, house, parts);
		});
	}
}
