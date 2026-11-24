import { resolveParams } from '../../core/params';
import { createCellSpace, parcelEdgeId, type Parcel } from '../../domain/cell-space';
import { buildAsset, readAsset, type CityAssetHost, type Placement } from './index';

/** Builds three houses, round-trips their placement records through JSON and rebuilds them. */
export function placementsExample() {
	const parcels = new Map<string, Parcel>();
	for (const [index, id] of ['first', 'second', 'third'].entries()) {
		const x = index * 22;
		parcels.set(id, {
			id,
			corners: [
				{ id: 'a', position: [x, 0] },
				{ id: 'b', position: [x + 16, 0] },
				{ id: 'c', position: [x + 16, 16] },
				{ id: 'd', position: [x, 16] }
			],
			frontage: [parcelEdgeId('a', 'b')],
			baseZ: 0,
			storeyCount: 10
		});
	}

	const records: Placement[] = ['neutral', 'memphis', 'organic'].map((style, index) => {
		const assetId = `house/court-${style}`;
		return {
			assetId,
			host: {
				kind: index === 1 ? 'cell-space' : 'parcel',
				id: ['first', 'second', 'third'][index]
			},
			params: resolveParams(readAsset(assetId).params),
			seed: index + 1
		};
	});
	const build = ({ assetId, host, params, seed }: Placement) => {
		if (host.kind !== 'parcel' && host.kind !== 'cell-space')
			throw new RangeError('Expected a house address');
		const parcel = parcels.get(host.id);
		if (!parcel) throw new RangeError(`Missing parcel "${host.id}"`);
		const request: CityAssetHost =
			host.kind === 'parcel'
				? { kind: 'parcel', parcel }
				: { kind: 'cell-space', space: createCellSpace(parcel) };
		return buildAsset(assetId, request, params, seed);
	};
	const original = records.map(build);
	const json = JSON.stringify(records);
	const restored = JSON.parse(json) as Placement[];
	return { records, original, json, restored, rebuilt: restored.map(build) };
}
