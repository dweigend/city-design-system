import { column, ribbonProfile } from './ribbon-column';
import { guardRuns } from './guard-runs';
import { retainingHeight, retainingFoot } from './retaining-foot';
import { walkingProfile, rampSurface, treadSeat, needsTreads } from './walking-profile';
import { contours, pathSupports, pathTube } from '../linear-path';
import { type Primitive, type Vec3 } from '../parametrik/types';
import { pathSurfaces } from './town-palette';
import { spanSurvey, deckCorners } from '../walkway';
import { publicPaving } from './town-floor';
import type { TownSpan } from './town-stations';
import { townPath, type Band, type Junction } from './town-path';
import { fitWalkingFlights, type FlightReservation } from './flight-fit';
const { thickness, width, treadRise, railHeight, postSpacing } = walkingProfile;
const { structure: frame, walking: deck } = pathSurfaces;

type Ground = (x: number, y: number) => number;
function exposed(
	edge: Vec3[],
	ground: (x: number, y: number, z: number) => number,
	stepped: boolean,
	outward: 1 | -1
) {
	return guardRuns(
		edge,
		ground,
		(p) => (stepped ? treadSeat(edge[0], edge[edge.length - 1], p) : undefined) ?? p[2],
		outward
	);
}
function handrail(path: Vec3[], id: string, stairs: Vec3[][]): Primitive[] {
	const top = path.map(([x, y, z]): Vec3 => [x, y, z + railHeight]);
	return [
		{ ...frame, id, ...pathTube(top, ribbonProfile.railRadius) },
		...pathSupports(path, postSpacing).map((p, i): Primitive => {
			const foot =
				stairs
					.map((edge) => treadSeat(edge[0], edge[edge.length - 1], p))
					.find((z) => z !== undefined) ?? p[2];
			return {
				...frame,
				kind: 'cylinder',
				id: id + '/post/' + i,
				position: [p[0], p[1], foot],
				height: p[2] + railHeight - foot,
				radius: ribbonProfile.postRadius
			};
		})
	];
}
function strip(
	{ span: { a, b, id, inside }, right, left }: Band,
	ground: Ground,
	marked: boolean,
	stepWidth: number = width,
	stepped = needsTreads(a, b)
): Primitive[] {
	const supports = inside
		? []
		: pathSupports([a, b], ribbonProfile.bay).flatMap((p, i) => {
				const z = stepped ? (treadSeat(a, b, p) ?? p[2]) : p[2];
				return column(id + '/pier/' + i, [p[0], p[1], z], ground, thickness);
			});
	const surface = marked || supports.length ? deck : { ...deck, ...publicPaving };
	const ring = [right[0], left[0], left[left.length - 1], right[right.length - 1]] as [
		Vec3,
		Vec3,
		Vec3,
		Vec3
	];
	if (a[2] !== b[2] && !stepped)
		return [{ ...surface, id: id + '/ramp', ...rampSurface(right, left) }, ...supports];
	const faces =
		a[2] === b[2]
			? [
					{
						id,
						polygon: [...left, ...right.toReversed()].map(([x, y]): [number, number] => [x, y]),
						z: a[2] - thickness,
						height: thickness
					}
				]
			: spanSurvey(ring, id, stepWidth, { thickness, treadRise }).treads;
	if (inside) return faces.map((p) => ({ ...deck, ...p, kind: 'prism' }));
	return seated(
		faces.map((p) => ({ ...deck, ...p, kind: 'prism' })),
		supports,
		ground,
		marked
	);
}
function seated(
	plates: Extract<Primitive, { kind: 'prism' }>[],
	supports: Primitive[],
	ground: Ground,
	marked: boolean
): Primitive[] {
	if (
		supports.length &&
		!plates.every((p) => p.polygon.every(([x, y]) => p.z - ground(x, y) <= retainingHeight))
	)
		return [...plates, ...supports];
	return plates.flatMap((p) => [marked ? p : { ...p, ...publicPaving }, retainingFoot(p, ground)]);
}
function fork({ id, position, rim }: Junction, ground: Ground, marked: boolean): Primitive[] {
	const [x, y, z] = position,
		base = ground(x, y),
		height = z - thickness - base;
	const polygon = rim.flat().map(([x, y]): [number, number] => [x, y]);
	const support: Primitive[] =
		height > 0
			? [
					{
						...frame,
						id: id + '/pier/0',
						kind: 'cylinder',
						position: [x, y, base],
						height,
						radius: 0.2
					}
				]
			: [];
	return seated(
		[
			{
				...deck,
				id,
				kind: 'prism',
				polygon,
				z: z - thickness,
				height: thickness
			}
		],
		support,
		ground,
		marked
	);
}
/** Projects the swept deck and its continuous exposed edges, including fork fillets. */
export function pathDeck(
	bands: Band[],
	junctions: Junction[],
	ground: Ground,
	{
		railId = 'town-walk/rail',
		marked = true,
		guardGround = ground
	}: {
		railId?: string;
		marked?: boolean;
		guardGround?: (x: number, y: number, z: number) => number;
	} = {}
) {
	const leftEdges = new Set(bands.map((b) => b.left));
	const edges = [
		...bands.filter((b) => !b.span.inside).flatMap((b) => [b.right, b.left]),
		...junctions.flatMap((j) => j.rim.filter((edge) => edge.length > 1))
	];
	const stairs = bands
		.filter((b) => needsTreads(b.span.a, b.span.b))
		.flatMap((b) => [b.left, b.right]);
	return [
		...bands.flatMap((b) => strip(b, ground, marked)),
		...junctions.flatMap((j) => fork(j, ground, marked)),
		...contours(
			edges.flatMap((edge) =>
				exposed(edge, guardGround, stairs.includes(edge), leftEdges.has(edge) ? -1 : 1)
			)
		).flatMap((path, i) => handrail(path, railId + '/' + i, stairs))
	];
}
/** Projects a standalone public flight from the same profile as the town walk. */
export function publicFlight(span: TownSpan, ground: Ground, reservation?: FlightReservation) {
	const { spans } = fitWalkingFlights(
		[span],
		reservation ? new Map([[span.id, reservation]]) : new Map()
	);
	if (spans.length !== 1) {
		const path = townPath(spans, new Map());
		return pathDeck(path.bands, path.junctions, ground, {
			railId: span.id + '/rail',
			marked: false
		});
	}
	return flightBand(span, width, ground, needsTreads(span.a, span.b));
}
/** Projects already resolved stair legs, using their edge width and ordered landings. */
export function stairEdge(
	id: string,
	path: readonly (readonly [number, number, number])[],
	stepWidth: number,
	ground: Ground
) {
	return path
		.slice(1)
		.flatMap((p, i) =>
			flightBand(
				{ id: path.length === 2 ? id : id + '/' + i, a: [...path[i]], b: [...p] },
				stepWidth,
				ground,
				true
			)
		);
}
function flightBand(span: TownSpan, stepWidth: number, ground: Ground, stepped: boolean) {
	const [a, b, c, d] = deckCorners(span.a, span.b, stepWidth);
	const band = { span, right: [a, d], left: [b, c] };
	const stairs = stepped ? [band.right, band.left] : [];
	return [
		...strip(band, ground, false, stepWidth, stepped),
		...(['right', 'left'] as const).flatMap((side) =>
			exposed(band[side], ground, stairs.length > 0, side === 'left' ? -1 : 1).flatMap((run, i) =>
				handrail(run, span.id + '/' + side + (i ? '/' + i : ''), stairs)
			)
		)
	];
}
