import type { AssetEntry } from '../../core/asset-registry';
import {
	accessObjectParams,
	createStairObject,
	createWalkwayObject
} from '../../domain/movement-network';
import {
	createRailPierObject,
	createStationPlatformObject,
	transitObjectParams
} from '../../domain/transit-line';
import type { CityAssetHost } from './hosts';

export const accessAssets: readonly AssetEntry<CityAssetHost>[] = [
	{
		id: 'access/walkway',
		kind: 'access',
		tags: ['deck'],
		params: accessObjectParams.walkway,
		hostKinds: ['graph-edge', 'plan-edge'],
		build(host, { width }) {
			if (host.kind !== 'graph-edge' && host.kind !== 'plan-edge')
				throw new RangeError('Expected an edge');
			return createWalkwayObject(host, width);
		}
	},
	{
		id: 'access/stair',
		kind: 'access',
		tags: ['steps'],
		params: accessObjectParams.stair,
		hostKinds: ['graph-edge', 'plan-edge'],
		build(host, { width }) {
			if (host.kind !== 'graph-edge' && host.kind !== 'plan-edge')
				throw new RangeError('Expected an edge');
			return createStairObject(host, width);
		}
	},
	{
		id: 'rail/pier',
		kind: 'rail',
		tags: ['support'],
		params: transitObjectParams.pier,
		hostKinds: ['graph-edge'],
		build(host, { radius }) {
			const { id, start, end } = edgeEnds(host);
			return createRailPierObject(id, start, end, radius);
		}
	},
	{
		id: 'rail/platform',
		kind: 'rail',
		tags: ['station'],
		params: transitObjectParams.platform,
		hostKinds: ['graph-edge'],
		build(host, { width }) {
			const { id, start, end } = edgeEnds(host);
			return createStationPlatformObject(id, start, [end[0] - start[0], end[1] - start[1]], width);
		}
	}
];

// Exact arithmetic: an edge must have two endpoints.
function edgeEnds(host: CityAssetHost) {
	if (host.kind !== 'graph-edge' || host.points.length < 2)
		throw new RangeError('Expected a resolved graph edge');
	const first = host.points[0];
	const last = host.points.at(-1);
	if (!last) throw new RangeError('Expected an edge endpoint');
	return { id: host.id, start: first, end: last };
}
