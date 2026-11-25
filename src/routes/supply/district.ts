import { crossProduct, readVertexMean, type Vec2, type Vec3 } from '../../lib/core/geometry';
import { required } from '../../lib/core/invariant';
import { createCellSpace, parcelEdgeId, readStoreyElevation } from '../../lib/domain/cell-space';
import {
	createHouseAssembly,
	createHouseCourt,
	houseFaces,
	houseStyles,
	type HouseFace
} from '../../lib/domain/house-court';
import type { StoreyProgram } from '../../lib/domain/massing';
import { houseUseColors, paintHouseUse, projectHouse } from '../../lib/scene/house-projection';
import { projectFocus, type ViewFit } from '../../lib/scene/stage';
import { projectGrove, type Drawable, type Surface } from '../../lib/scene/surface';
import { buildAsset, groveLawnLiftM } from '../../lib/world/asset-registry';

type Use = StoreyProgram['use'];

/** Counterclockwise rectangle in district meters. */
export function rectangle(
	west: number,
	south: number,
	east: number,
	north: number
): readonly Vec2[] {
	return [
		[west, south],
		[east, south],
		[east, north],
		[west, north]
	];
}

export function slab(
	id: string,
	polygon: readonly Vec2[],
	base: number,
	top: number,
	color: Surface['color']
): Drawable {
	return { id, shape: { kind: 'prism', polygon, base, top }, color, finish: 'matte' };
}

/** Keeps the district and its infrastructure solid and in color during transparency mode. */
export function infrastructure(part: Drawable): Drawable {
	return { ...part, preserveColor: true, opacity: '--alpha-opaque' };
}

const parcels = [
	{
		id: 'workshop-court',
		outline: rectangle(-35, 5, -8, 26),
		uses: ['workshop', 'housing', 'housing'],
		seed: 17
	},
	{
		id: 'farm-court',
		outline: rectangle(3, 5, 26, 26),
		uses: ['workshop', 'city-farm', 'greenhouse'],
		seed: 38
	}
] as const satisfies readonly {
	id: string;
	outline: readonly Vec2[];
	uses: readonly Use[];
	seed: number;
}[];

function serviceFrontage(
	space: ReturnType<typeof createCellSpace>,
	house: ReturnType<typeof createHouseCourt>,
	entranceX: number
) {
	const groundCells = new Set(
		house.cells
			.filter(({ fromStorey, toStorey }) => fromStorey === 0 && toStorey > 0)
			.map(({ id }) => id)
	);
	const frontages = space.cells
		.filter(({ id }) => groundCells.has(id))
		.flatMap(({ sides, quad }) =>
			sides.flatMap(({ frontage }, index) => {
				if (!frontage) return [];
				const [a, b] = [quad[index], quad[(index + 1) % quad.length]];
				return [{ west: Math.min(a[0], b[0]), east: Math.max(a[0], b[0]), y: a[1] }];
			})
		);
	const distance = ({ west, east }: (typeof frontages)[number]) =>
		Math.abs((west + east) / 2 - entranceX);
	// A gate can span an open ground storey. Attach to the nearest occupied frontage.
	return required(
		frontages.sort((a, b) => distance(a) - distance(b))[0],
		'supply service frontage'
	);
}

function plantRoof(id: string, { body, origin: [x, y, z], across, normal, outline }: HouseFace) {
	if (!outline || normal[2] !== 1) return [];
	const [u0, v0] = readVertexMean(outline);
	const up = crossProduct(normal, across);
	const plantingShare = 0.86;
	const polygon = outline.map(([u, v]): Vec2 => {
		const a = u0 + (u - u0) * plantingShare;
		const b = v0 + (v - v0) * plantingShare;
		return [x + across[0] * a + up[0] * b, y + across[1] * a + up[1] * b];
	});
	return [slab(`${id}/green-roof/${body}`, polygon, z, z + 0.26, '--cat-grass')];
}

function buildHouse({ id, outline, uses, seed }: (typeof parcels)[number]) {
	const space = createCellSpace({
		id,
		corners: outline.map((position, index) => ({ id: String(index), position })),
		frontage: [parcelEdgeId('0', '1')],
		baseZ: 0,
		storeyHeightsM: [4.6, 3.5, 3.5],
		storeyCount: uses.length
	});
	const style = houseStyles.neutral;
	const house = createHouseCourt(
		space,
		{
			height: readStoreyElevation(space, uses.length),
			width: outline[1][0] - outline[0][0],
			complexity: 0.25,
			seed
		},
		style,
		{
			storeyProgram: (datumIndex) => ({
				use: uses[datumIndex],
				phase: datumIndex === 0 ? 'retained' : 'addition'
			})
		}
	);
	const { object, addresses } = createHouseAssembly(space, house, 'block', style, [], true);
	const program = new Map(
		addresses.filter(({ body }) => body).map(({ partId, program }) => [partId, program])
	);
	const drawables = projectHouse(object, 'silhouette').map((part) => {
		const address = program.get(part.id);
		return {
			...part,
			id: `${object.id}/${part.id}`,
			...(address && { useColor: houseUseColors[address.use] })
		};
	});
	const entry = required(
		object.anchors.find(({ name }) => name === 'entrance'),
		'supply house entrance'
	);
	const roofBeds = houseFaces(space, house, 'block', style, [], true)
		.filter(({ place }) => place === 'roof')
		.flatMap((face) => plantRoof(object.id, face));
	return {
		id: object.id,
		frontage: serviceFrontage(space, house, entry.position[0]),
		drawables,
		roofBeds
	};
}

export const houses = parcels.map(buildHouse);

export function houseDrawing(transparent: boolean): Drawable[] {
	return houses.flatMap(({ drawables }) =>
		drawables.map((part) => {
			if (!transparent) return paintHouseUse(part);
			if (!part.useColor) return { ...part, visible: false };
			return { ...part, stroke: { color: '--stock-line', width: 0.75, opacity: 0.52 } };
		})
	);
}

export function grove(id: string, outline: readonly Vec2[], lawnZ: number, seed: number) {
	const asset = buildAsset(
		'park/grove',
		{
			kind: 'parcel',
			parcel: { id, outline },
			groundAt: () => lawnZ - groveLawnLiftM
		},
		{ density: 5, height: 9 },
		seed
	);
	return projectGrove(asset).map((part) => ({ ...part, id: `${id}/${part.id}` }));
}

// Match all states to the corners of the same model plinth and building envelope.
const angles = { bearing: 0.46, elevation: 0.82 };
const corners: Vec3[] = rectangle(-45, -28, 45, 29).map(([x, y]) => [x, y, -3.4]);
const top: Vec3[] = rectangle(-35, 5, 26, 26).map(([x, y]) => [x, y, 12]);

export const districtFit: ViewFit = {
	...angles,
	fill: 0.88,
	subject: projectFocus('iso', angles, [...corners, ...top])
};
