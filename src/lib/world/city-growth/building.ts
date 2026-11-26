import {
	measurePointSegmentDistance,
	isSimplePolygon,
	readVertexMean,
	type Vec2
} from '../../core/geometry';
import { required } from '../../core/invariant';
import type { Part } from '../../core/object';
import { encodeKey } from '../../core/ref';
import type { AddressedParcel, ParcelPortal } from '../../domain/parcels';
import type { CityVerticalRecipe } from '../city-site';
import type { CityConstructionEra, CityGrowthBuilding, CityGrowthPart } from './types';

function boundaryDistance(point: Vec2, outline: readonly Vec2[]) {
	return Math.min(
		...outline.map((from, i) =>
			measurePointSegmentDistance(point, from, outline[(i + 1) % outline.length])
		)
	);
}

function squareAt(center: Vec2, outline: readonly Vec2[], radiusShare: number) {
	const [x, y] = center;
	const half = (radiusShare * boundaryDistance(center, outline)) / Math.SQRT2;
	const ring: Vec2[] = [
		[x - half, y - half],
		[x + half, y - half],
		[x + half, y + half],
		[x - half, y + half]
	];
	if (!isSimplePolygon(outline, [ring])) return undefined;
	return Object.freeze(ring.map((point) => Object.freeze(point)));
}

export function readFootprint(parcel: AddressedParcel, portal: ParcelPortal, radiusShare: number) {
	const { outline, corners } = parcel;
	const centered = squareAt(readVertexMean(outline), outline, radiusShare);
	if (centered) return centered;

	// Use the known inward side of the portal edge for concave holdings.
	const index = corners.findIndex(({ id }) => id === portal.side[0]);
	const from = required(corners[index], 'holding frontage start').position;
	const to = required(corners[(index + 1) % corners.length], 'holding frontage end').position;
	const midpoint = readVertexMean([from, to]);
	const clearance = Math.min(
		...outline.flatMap((point, i) =>
			i === index
				? []
				: [measurePointSegmentDistance(midpoint, point, outline[(i + 1) % outline.length])]
		)
	);
	const dx = to[0] - from[0];
	const dy = to[1] - from[1];
	const scale =
		clearance / /* Exact arithmetic: half the clearance to other edges. */ (2 * Math.hypot(dx, dy));
	return squareAt([midpoint[0] - dy * scale, midpoint[1] + dx * scale], outline, radiusShare);
}

export function readStoreyPlanes(datumZ: number, recipe: CityVerticalRecipe) {
	const { levelHeightM, storeysPerLevel } = recipe;
	const offsets = /* Exact arithmetic: the first storey starts at the coarse plane. */ [0];
	for (let i = 1; i < storeysPerLevel; i++) {
		offsets.push(
			recipe.storeyHeightsM
				? offsets[i - 1] + recipe.storeyHeightsM[i - 1]
				: i * recipe.storeyHeightM
		);
	}
	const atIndex = (index: number) => {
		const level = Math.floor(index / storeysPerLevel);
		const storey = index - level * storeysPerLevel;
		return datumZ + level * levelHeightM + offsets[storey];
	};
	const indexAtOrAbove = (height: number) => {
		const level = Math.floor((height - datumZ) / levelHeightM);
		const first = level * storeysPerLevel;
		for (let i = first; i < first + storeysPerLevel; i++) {
			if (atIndex(i) >= height) return i;
		}
		return first + storeysPerLevel;
	};
	return { atIndex, indexAtOrAbove };
}

export type BuildingGround = Readonly<{
	footprint: readonly Vec2[];
	lowest: number;
	highest: number;
}>;

export type StoreyPlanes = ReturnType<typeof readStoreyPlanes>;

export type Construction = Readonly<{
	builtYear: number;
	era: CityConstructionEra;
	use: CityGrowthPart['use'];
	seed: number;
}>;

export function createDatedPrism(
	id: string,
	kind: CityGrowthPart['kind'],
	datumIndex: number,
	shape: Extract<Part['shape'], { kind: 'prism' }>,
	{ builtYear, era: { styleId }, use }: Construction,
	cellId?: string
): CityGrowthPart {
	const address = cellId === undefined ? [id, kind, datumIndex] : [id, cellId, kind, datumIndex];
	return Object.freeze({
		id: encodeKey(address),
		kind,
		datumIndex,
		builtYear,
		styleId,
		use,
		...(cellId === undefined ? {} : { cellId }),
		slot: kind,
		shape: Object.freeze(shape)
	});
}

export function createPrismRun(
	id: string,
	polygon: readonly Vec2[],
	first: number,
	storeys: number,
	planes: StoreyPlanes,
	construction: Construction
) {
	const parts: CityGrowthPart[] = [];
	for (let index = first; index < first + storeys; index++)
		parts.push(
			createDatedPrism(
				id,
				'storey',
				index,
				{
					kind: 'prism',
					polygon,
					base: planes.atIndex(index),
					top: planes.atIndex(index + 1)
				},
				construction
			)
		);
	return parts;
}

export function createBuilding(
	id: string,
	holdingId: string,
	{ footprint: polygon, lowest, highest }: BuildingGround,
	storeys: number,
	planes: StoreyPlanes,
	construction: Construction,
	cellParts?: readonly CityGrowthPart[]
): CityGrowthBuilding {
	const {
		builtYear,
		era: { styleId },
		use
	} = construction;
	if (cellParts) return Object.freeze({ id, holdingId, builtYear, styleId, use, parts: cellParts });
	const first = planes.indexAtOrAbove(highest);
	const floorZ = planes.atIndex(first);
	const parts = [];
	if (floorZ > lowest)
		parts.push(
			createDatedPrism(
				id,
				'foundation',
				first,
				{
					kind: 'prism',
					polygon,
					base: lowest,
					top: floorZ
				},
				construction
			)
		);
	parts.push(...createPrismRun(id, polygon, first, storeys, planes, construction));
	return Object.freeze({ id, holdingId, builtYear, styleId, use, parts: Object.freeze(parts) });
}
