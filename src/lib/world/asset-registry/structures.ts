import type { AssetEntry } from '../../core/asset-registry';
import { createDeriveCache } from '../../core/derive';
import {
	latticeVariants,
	levelHeight,
	createLatticeBayObject,
	readLatticeBay,
	type CityLattice,
	type LatticeVariant
} from '../../domain/city-volume';
import { createFrameBayObject, type MemberGraph } from '../../domain/structure';
import { createCityStructure } from '../city-structure';
import type { CityAssetHost } from './hosts';

function latticeBay(model: LatticeVariant): AssetEntry<CityAssetHost> {
	return {
		id: `lattice/${model}`,
		kind: 'lattice',
		tags: ['bay', model],
		params: {},
		hostKinds: ['lattice-bay'],
		build(host) {
			if (host.kind !== 'lattice-bay') throw new RangeError('Expected a lattice bay');
			return createLatticeBayObject(host.readLattice(model), host.id);
		}
	};
}

const frameGraphs = createDeriveCache<CityLattice, MemberGraph>();

const frame: AssetEntry<CityAssetHost> = {
	id: 'structure/frame-bay',
	kind: 'structure',
	tags: ['frame'],
	params: {},
	hostKinds: ['frame', 'lattice-bay'],
	build(host) {
		if (host.kind === 'frame')
			return 'frame' in host
				? host.frame.object
				: createFrameBayObject(host.id, host.graph, { memberIds: host.memberIds });
		if (host.kind !== 'lattice-bay') throw new RangeError('Expected a frame or lattice bay');
		const lattice = host.readLattice(host.model);
		const levelHeightM = host.levelHeightM ?? levelHeight;
		const graph = frameGraphs(
			lattice,
			[host.datumZ, levelHeightM],
			[],
			() => createCityStructure(lattice, host.datumZ, levelHeightM).graph
		);
		const { members } = readLatticeBay(lattice, host.id);
		return createFrameBayObject(host.id, graph, { memberIds: members.map(({ id }) => id) });
	}
};

export const structuralAssets = [frame, ...latticeVariants.map(latticeBay)];
