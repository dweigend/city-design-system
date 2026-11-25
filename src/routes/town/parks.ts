import { defaults } from '../../config/town-parks';
import { measurePolygon, type Vec2 } from '../../lib/core/geometry';
import { Random } from '../../lib/core/random';
import type { Parcel } from '../../lib/domain/parcels';
import { projectGrove } from '../../lib/scene/surface';
import { buildAsset } from '../../lib/world/asset-registry';
import type { ParcelHouseResult } from '../../lib/world/house-site';
import type { townStage } from '../architecture/town';

type Town = ReturnType<typeof townStage>;
type Garden = Pick<Parcel, 'id' | 'outline' | 'blockId'> & {
	holes?: readonly (readonly Vec2[])[];
};
type ParkKind = 'parks' | 'shore' | 'gardens';
type Planting = Readonly<{ kind: ParkKind; garden: Garden }>;

/** Selects review greenery above the existing city plan. Only directly reserved holdings are
 * omitted from the house sheet; lanes, squares, topology and growth retain their addresses. */
export function createTownParks(
	town: Town,
	recipe: {
		minimumPlantingAreaM2: number;
		shoreReachM: number;
		shoreParkLimit: number;
		parksPerDistrict: number;
		openGardenLimit: number;
	} = defaults
) {
	const { holdings, parcelsByBlock, blocks, layout, site } = town;
	const random = Random.create({ seed: layout.seed }).derive('town-parks');
	const study = new Set(Object.values(blocks).map(({ id }) => id));
	const rank = (id: string) => random.derive(id).number();
	const ordered = <T extends { id: string }>(items: readonly T[]) =>
		items
			.map((item) => ({ item, rank: rank(item.id) }))
			.sort((a, b) => a.rank - b.rank)
			.map(({ item }) => item);

	const nearShore = new Set(
		holdings.lanes.filter(({ hierarchy }) => hierarchy.includes('promenade')).map(({ id }) => id)
	);
	const shore = holdings.parcels.flatMap((parcel) => {
		if (parcel.publicUse || parcel.areaM2 < recipe.minimumPlantingAreaM2) return [];
		const portal = town.portals.get(parcel.portalId);
		if (!portal) return [];
		const [a, b] = portal.points;
		// Exact arithmetic: evaluate the frontage midpoint as well as its ends.
		const midpoint: Vec2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
		const samples = [a, midpoint, b].map(([x, y]) => site.sampleGround(x, y));
		const clearance = Math.min(...samples.map(({ waterClearance }) => waterClearance));
		return nearShore.has(portal.laneId) || clearance <= recipe.shoreReachM
			? [{ parcel, clearance }]
			: [];
	});
	const frontages = [...Map.groupBy(shore, ({ parcel }) => parcel.blockId).values()].map(
		(fronts) => fronts.sort((a, b) => a.clearance - b.clearance)[0].parcel
	);
	const shoreParcels = ordered(frontages).slice(0, recipe.shoreParkLimit);
	const shorelineBlocks = new Set(frontages.map(({ blockId }) => blockId));

	const candidates = holdings.blocks.filter(({ id, plannedKind }) => {
		if (
			study.has(id) ||
			shorelineBlocks.has(id) ||
			plannedKind === 'hall' ||
			plannedKind === 'square'
		)
			return false;
		return parcelsByBlock
			.get(id)
			?.some(({ areaM2, publicUse }) => !publicUse && areaM2 >= recipe.minimumPlantingAreaM2);
	});
	const parkBlocks = [
		...Map.groupBy(candidates, ({ plannedKind }) => plannedKind).values()
	].flatMap((district) => ordered(district).slice(0, recipe.parksPerDistrict));
	const parkParcels = parkBlocks.flatMap(({ id }) =>
		(parcelsByBlock.get(id) ?? []).filter(({ publicUse }) => !publicUse)
	);
	const reserved = new Set([...shoreParcels, ...parkParcels].map(({ id }) => id));

	const open = holdings.blocks.flatMap(({ id: blockId, publicGround, plannedKind }) =>
		plannedKind === 'square'
			? []
			: [...publicGround.court, ...publicGround.open].flatMap(
					([outline, ...holes], i): Garden[] => {
						const area = [outline, ...holes].reduce(
							(total, ring) => total + measurePolygon(ring).area,
							0
						);
						return area >= recipe.minimumPlantingAreaM2
							? [{ id: JSON.stringify([blockId, 'open', i]), blockId, outline, holes }]
							: [];
					}
				)
	);

	return {
		parcelsByBlock: new Map(
			[...parcelsByBlock].map(([id, parcels]) => [
				id,
				parcels.filter((parcel) => !reserved.has(parcel.id))
			])
		),
		/** Draws the same grove as the brush on every selected holding, then measures the result. */
		draw(unbuildable: readonly Extract<ParcelHouseResult, { status: 'unbuildable' }>[]) {
			const gardens = [
				...open,
				...unbuildable
					.map(({ parcel }) => parcel)
					.filter(({ areaM2 }) => areaM2 >= recipe.minimumPlantingAreaM2)
			];
			const green = [
				...gardens.filter(({ blockId }) => study.has(blockId)),
				...ordered(gardens.filter(({ blockId }) => !study.has(blockId))).slice(
					0,
					recipe.openGardenLimit
				)
			];
			const assign = (kind: ParkKind, gardens: readonly Garden[]): Planting[] =>
				gardens.map((garden) => ({ kind, garden }));
			const figures = {
				parks: 0,
				shore: 0,
				gardens: 0,
				greenBlocks: parkBlocks.length,
				drawables: 0,
				triangles: 0
			};
			const drawables = [
				...assign('parks', parkParcels),
				...assign('shore', shoreParcels),
				...assign('gardens', green)
			].flatMap(({ kind, garden }) => {
				const { id, outline, holes } = garden;
				const grove = buildAsset(
					'park/grove',
					{
						kind: 'parcel',
						parcel: { id, outline },
						holes,
						groundAt: town.groundAt
					},
					{},
					random.derive(id).seed
				);
				figures[kind]++;
				figures.drawables += grove.parts.length;
				// Exact arithmetic: indexed triangles use three indices each.
				for (const { shape } of grove.parts)
					if (shape.kind === 'mesh')
						figures.triangles += shape.indices.length / /* Exact arithmetic: triangle arity. */ 3;
				return projectGrove(town.local(grove)).map((part) => ({
					...part,
					id: JSON.stringify(['grove', id, part.id])
				}));
			});
			return { figures, drawables };
		}
	};
}
