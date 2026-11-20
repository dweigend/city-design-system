import { guardRuns } from './guard-runs';
import { retainingHeight, retainingFoot } from './retaining-foot';
import { outline } from './level-runs';
import { walkingProfile, rampSurface, treadSeat, needsTreads } from './walking-profile';
import { contours, pathSupports, pathTube } from '../linear-path';
import { type Primitive, type Vec3 } from '../parametrik/types';
import { houseSurfaces } from '../composed-house';
import { spanSurvey, deckCorners } from '../walkway';
import { publicPaving } from './town-floor';
import type { TownSpan } from './town-stations';
import { townPath, type Band, type Junction } from './town-path';
import { fitWalkingFlights, type FlightReservation } from './flight-fit';
const { thickness, width, treadRise, railHeight, postSpacing } = walkingProfile;
const frame = { role: 'neu', material: 'metal', ...houseSurfaces.frame } as const;
const deck = {
	role: 'neu',
	material: 'acrylic',
	token: houseSurfaces.access.token,
	finish: 'kunststoff-formteil'
} as const;

type Ground = (x: number, y: number) => number;
function piers(id: string, path: Vec3[], ground: Ground): Primitive[] {
	return pathSupports(path, 12).flatMap(([x, y, z], i) => {
		const [a, b] = path;
		const top = needsTreads(a, b) ? (treadSeat(a, b, [x, y, z]) ?? z) : z;
		const base = ground(x, y),
			height = top - thickness - base;
		return height > 0
			? [
					{
						...frame,
						kind: 'cylinder',
						id: id + '/pier/' + i,
						position: [x, y, base],
						radius: 0.2,
						height
					}
				]
			: [];
	});
}
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
		{ ...frame, id, ...pathTube(top, 0.06) },
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
				radius: 0.06
			};
		})
	];
}
function strip(
	{ span: { a, b, id }, right, left }: Band,
	ground: Ground,
	marked: boolean
): Primitive[] {
	const supports = piers(id, [a, b], ground),
		surface = marked || supports.length ? deck : { ...deck, ...publicPaving };
	const ring = [right[0], left[0], left[left.length - 1], right[right.length - 1]] as [
		Vec3,
		Vec3,
		Vec3,
		Vec3
	];
	if (a[2] !== b[2] && !needsTreads(a, b))
		return [{ ...surface, id: id + '/ramp', ...rampSurface(right, left) }, ...supports];
	const faces =
		a[2] === b[2]
			? [
					{
						id,
						polygon: outline(left, right),
						z: a[2] - thickness,
						height: thickness
					}
				]
			: spanSurvey(ring, id, width, { thickness, treadRise }).treads;
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
		...bands.flatMap((b) => [b.right, b.left]),
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
	const [a, b, c, d] = deckCorners(span.a, span.b, width);
	const band = { span, right: [a, d], left: [b, c] };
	const stairs = needsTreads(span.a, span.b) ? [band.right, band.left] : [];
	return [
		...strip(band, ground, false),
		...(['right', 'left'] as const).flatMap((side) =>
			exposed(band[side], ground, stairs.length > 0, side === 'left' ? -1 : 1).flatMap((run, i) =>
				handrail(run, span.id + '/' + side + (i ? '/' + i : ''), stairs)
			)
		)
	];
}
