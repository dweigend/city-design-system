import { resolveParams } from '../../core/params';
import { createSupportedFrame } from '../../domain/structure';
import { createCellSpace, parcelEdgeId, type Parcel } from '../../domain/cell-space';
import {
	buildAsset,
	buildAssetResult,
	listAssets,
	readAsset,
	type CityAssetHost,
	type Placement
} from './index';

/** Replays fixed house placements through JSON and builds the three sculpture specimens. */
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
	const ground = { kind: 'ground', point: [12, -7, 3] } as const;
	const sculptures = listAssets({ kind: 'sculpture' }).map(({ id }) =>
		buildAssetResult(id, ground, { scale: 1.25, rotation: Math.PI / 2 }, 37)
	);
	return { records, original, json, restored, rebuilt: restored.map(build), sculptures };
}

/** Seats a replaceable room on a diagonal supported frame at a fixed world address. */
export function plugInExample() {
	const frame = createSupportedFrame({
		id: 'diagonal-frame',
		start: [2, 3],
		end: [8, 11],
		widthM: 4,
		deckZ: 6,
		groundAt: () => 1
	});
	if (frame.status === 'rejected') throw new Error(frame.reason);
	const [{ socket }] = frame.sockets;
	const host = { kind: 'frame', id: socket.id, frame } as const;
	const record: Placement = {
		assetId: 'plug-in/room',
		host: { kind: 'frame', id: socket.id },
		params: {},
		seed: 37
	};
	return {
		host,
		record,
		socket,
		room: buildAsset(record.assetId, host, record.params, record.seed)
	};
}
