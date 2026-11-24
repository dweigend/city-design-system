import type { AssetEntry } from '../../core/asset-registry';
import {
	createSamplePlateObject,
	familyNames,
	samplePlateBackingM,
	samplePlateParams,
	type Family
} from '../../domain/material';
import type { CityAssetHost } from './hosts';

// Exact arithmetic: the sample patch faces up, with its across axis along world X.
function samplePlate(family: Family): AssetEntry<CityAssetHost> {
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
			return createSamplePlateObject(
				id,
				{
					origin: [x, y, z + samplePlateBackingM],
					across: [1, 0, 0],
					normal: [0, 0, 1],
					size: [width, depth],
					thickness: samplePlateBackingM
				},
				family,
				{ seed }
			).object;
		}
	};
}

export const surfaceAssets = familyNames.map(samplePlate);
