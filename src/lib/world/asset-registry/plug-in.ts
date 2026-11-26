import type { AssetEntry } from '../../core/asset-registry';
import type { Bounds3 } from '../../core/geometry';
import type { PlaceableObject } from '../../core/object';
import { createDockedModule } from '../../domain/face-dock';
import type { CityAssetHost } from './hosts';

const dockedBounds = new WeakMap<PlaceableObject, Bounds3>();

export function readPlugInBounds(object: PlaceableObject): Bounds3 | undefined {
	return dockedBounds.get(object);
}

function readFrameSocket(host: CityAssetHost) {
	if (host.kind !== 'frame' || !('frame' in host))
		throw new RangeError('Expected an addressed supported frame');
	const bay = host.frame.sockets.find(({ socket }) => socket.id === host.id);
	if (!bay) throw new RangeError('Unknown plug-in socket on supported frame');
	return bay;
}

const id = 'plug-in/room';

export const plugInAsset: AssetEntry<CityAssetHost> = {
	id,
	kind: 'plug-in',
	tags: ['architecture', 'frame'],
	params: {},
	hostKinds: ['frame'],
	validateHost: readFrameSocket,
	build(host) {
		const { socket, clearHeightM } = readFrameSocket(host);
		const occupiedBounds = 'occupiedBounds' in host ? host.occupiedBounds : undefined;
		const result = createDockedModule(
			socket,
			{
				id,
				widthM: socket.widthM,
				heightM: socket.heightM,
				depthM: clearHeightM / /* Exact arithmetic: half height leaves room for the collar. */ 2
			},
			{ occupiedBounds }
		);
		if (result.status === 'rejected') throw new RangeError('Cannot seat plug-in: ' + result.reason);
		dockedBounds.set(result.object, result.bounds);
		return result.object;
	}
};
