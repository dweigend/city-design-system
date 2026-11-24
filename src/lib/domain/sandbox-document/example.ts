import { createSandboxDocument } from './index';

/** Paints two parcels as one gesture on an addressed, fixed world. */
export function example() {
	const document = createSandboxDocument({
		seed: 1201,
		id: 'square-plan',
		registryRevision: 'registry-test',
		terrainRevision: 'terrain-test',
		topologyRevision: 'topology-test'
	});
	document.apply(
		['north', 'south'].map((id) => ({
			kind: 'place',
			assetId: 'house/court-neutral',
			host: { kind: 'parcel', id },
			params: { height: 14 }
		}))
	);
	return document;
}
