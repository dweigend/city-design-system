import { createAssetBuild, type AssetEntry } from '../../core/asset-registry';
import {
	createSamplePlateObject,
	familyNames,
	samplePlateBackingM,
	samplePlateParams,
	type Family,
	type FamilySlot
} from '../../domain/material';
import type { CityAssetHost } from './hosts';

/** The family and role of every generated material specimen slot. */
export type SpecimenMaterials = Readonly<
	Record<string, Readonly<{ family: Family; role: FamilySlot }> | undefined>
>;

// Exact arithmetic: the sample patch faces up, with its across axis along world X.
function samplePlate(family: Family): AssetEntry<CityAssetHost, SpecimenMaterials> {
	const id = `surface/${family}`;
	return {
		id,
		kind: 'surface',
		tags: ['sample', family],
		params: samplePlateParams,
		hostKinds: ['ground'],
		build(host, { width, depth }, seed) {
			if (host.kind !== 'ground') throw new RangeError('Expected a ground point');
			const [x, y, z] = host.point;
			const { object, groups } = createSamplePlateObject(
				id,
				/* Exact arithmetic: card axes aligned to world X and Z. */ {
					origin: [x, y, z + samplePlateBackingM],
					across: [1, 0, 0],
					normal: [0, 0, 1],
					size: [width, depth],
					thickness: samplePlateBackingM
				},
				family,
				{ seed }
			);
			const materials = groups.flatMap(({ family, slots }) =>
				Array.from(slots, ([slot, role]) => [slot, Object.freeze({ family, role })] as const)
			);
			return createAssetBuild(object, Object.fromEntries(materials));
		}
	};
}

export const surfaceAssets = familyNames.map(samplePlate);
