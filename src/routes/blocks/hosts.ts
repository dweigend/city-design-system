import { defaults } from '../../config/blocks-board';
import { parcelEdgeId } from '../../lib/domain/cell-space';
import {
	createCityLattice,
	type StructuralColumn,
	type CityLattice,
	type LatticeVariant
} from '../../lib/domain/city-volume';
import { portalExample } from '../../lib/domain/structure';
import type { AssetDefinition, CityAssetHost } from '../../lib/world/asset-registry';

const { boardPlotSideM: parcelSideM } = defaults;
const baySideM = 8;
const frontage = parcelEdgeId('a', 'b');
const alternatingLattices = new Set(['lattice/antiprism', 'lattice/diagrid', 'lattice/tree']);
const column: StructuralColumn = {
	planCellId: 'specimen',
	corners: [
		{ id: 'a', position: [0, 0, 0] },
		{ id: 'b', position: [baySideM, 0, 0.5] },
		{ id: 'c', position: [baySideM, baySideM, 1.2] },
		{ id: 'd', position: [0, baySideM, 0.3] }
	],
	neighbors: [null, null, null, null],
	levels: 2
};

const datumZ = 0;
const specimenLattices = new Map<LatticeVariant, CityLattice>();

function readLattice(variant: LatticeVariant) {
	const cached = specimenLattices.get(variant);
	if (cached) return cached;
	const lattice = createCityLattice([column], datumZ, variant);
	specimenLattices.set(variant, lattice);
	return lattice;
}

function parcel(id: string): CityAssetHost {
	return {
		kind: 'parcel',
		parcel: {
			id,
			corners: [
				{ id: 'a', position: [0, 0] },
				{ id: 'b', position: [parcelSideM, 0] },
				{ id: 'c', position: [parcelSideM, parcelSideM] },
				{ id: 'd', position: [0, parcelSideM] }
			],
			frontage: [frontage],
			baseZ: 0,
			storeyCount: 10
		}
	};
}

/** Supplies the fixed geometric hosts for the chapter's registry specimens. */
export function specimenHost({ id, kind }: AssetDefinition): CityAssetHost {
	switch (kind) {
		case 'park':
		case 'house':
			return parcel(id);
		case 'access':
			return id === 'access/stair'
				? {
						kind: 'plan-edge',
						id,
						points: [
							[0, 0, 0],
							[9, 0, 3],
							[9, 3, 3]
						]
					}
				: {
						kind: 'graph-edge',
						id,
						points: [
							[0, 0, 3],
							[6, 0, 3],
							[11, 3, 3]
						],
						supports: [
							{ base: [1, 0, 0], top: [0, 0, 3] },
							{ base: [11, 3, 0], top: [11, 3, 3] }
						]
					};
		case 'rail':
			return {
				kind: 'graph-edge',
				id,
				points:
					id === 'rail/pier'
						? [
								[0, 0, 0],
								[1.6, 0, 7]
							]
						: [
								[0, 0, 1],
								[10, 3, 1]
							]
			};
		case 'surface':
			return { kind: 'ground', point: [0, 0, 0] };
		case 'structure':
			return { kind: 'frame', id, graph: portalExample().graph };
		case 'lattice': {
			const model = 'box';
			const level = alternatingLattices.has(id) ? 2 : 0;
			const bay = readLattice(model).cells.find((cell) => cell.level === level);
			if (!bay) throw new Error(`Missing specimen bay at level ${level}`);
			return {
				kind: 'lattice-bay',
				id: bay.id,
				model,
				datumZ,
				readLattice
			};
		}
		default:
			throw new Error(`Missing specimen host for ${id}`);
	}
}
