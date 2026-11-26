import { distance, type Vec2, type Vec3 } from '../../core/geometry';
import { required } from '../../core/invariant';
import { resolveParams } from '../../core/params';
import type { Random } from '../../core/random';
import { encodeKey } from '../../core/ref';
import { buildAsset, readAsset, type CityAssetHost, type HostAddress } from '../asset-registry';
import type { HoldingCandidate } from './carrier';
import { freezeGeometry } from './infrastructure';
import type { AssetPlaced, EventDate } from './types';

export function placePublicAsset(
	assetId: string,
	host: HostAddress,
	resolved: CityAssetHost,
	anchor: Vec3,
	date: EventDate,
	random: Random,
	physicalKey = host.kind === 'ground' ? undefined : host.id
): AssetPlaced {
	const id = encodeKey(['public-asset', assetId, required(physicalKey, 'public asset anchor key')]);
	const seed = random.derive(id).seed;
	const params = resolveParams(readAsset(assetId).params);
	return freezeGeometry({
		kind: 'asset-placed',
		...date,
		asset: {
			id,
			assetId,
			host,
			anchor,
			builtYear: date.year,
			seed,
			params,
			object: buildAsset(assetId, resolved, params, seed)
		}
	});
}

export function readParkGround({ parcel, anchor, outlineElevationsM }: HoldingCandidate) {
	// Grove triangulation rounds the perimeter vertices before sampling their elevations.
	return (point: Vec2) => {
		let nearest = distance(point, [anchor[0], anchor[1]]);
		let height = anchor[2];
		for (const [index, vertex] of parcel.outline.entries()) {
			const spanM = distance(point, vertex);
			if (spanM >= nearest) continue;
			nearest = spanM;
			height = outlineElevationsM?.[index] ?? anchor[2];
		}
		return height;
	};
}
