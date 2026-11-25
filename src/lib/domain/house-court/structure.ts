import type { Vec3 } from '../../core/geometry';
import { groundStorey, lazyFaceParts, type HousePart, type StoreyRun } from './part-refs';
import { encodePair, type Key } from '../../core/ref';
import { defaults } from '../../../config/house-court';
import { readStoreyElevation, readStoreyHeight, cellCenter, type FineCell } from '../cell-space';
import { side } from './boxes';
import { builtAt, envelopeRing, type Context } from './context';
import { bar, extrusion, inset, rounded, type Faces } from './solids';

const { archigramBarM, archigramTubeRadiusM, frameDeckThicknessM, mastBarM } = defaults;

const level = ({ space }: Context, storey: number) => readStoreyElevation(space, storey);

function eachBuilt(ctx: Context, visit: (cell: FineCell, from: number, to: number) => void) {
	for (const cell of ctx.space.cells) {
		const house = ctx.occupancy.get(cell.id);
		if (house && house.toStorey > house.fromStorey) visit(cell, house.fromStorey, house.toStorey);
	}
}

/** The exposed frame on the cell edges (FORM-6): posts from the ground to the top of each built
 * run, beams on every storey line, and diagonals on a share of the exposed bays. Shared members
 * are emitted once. */
type FaceBuilder = () => Faces;

function frame(ctx: Context, runs: StoreyRun[]): FaceBuilder[] {
	const members = new Map<string, FaceBuilder>();
	type Joint = Readonly<{ key: Key; position: Vec3 }>;
	const add = (a: Joint, b: Joint) => {
		const id = encodePair(a.key, b.key);
		if (!members.has(id)) members.set(id, () => bar(a.position, b.position, archigramBarM));
	};
	const brace = ctx.style.parts.braceShareRatio * ctx.complexity;
	eachBuilt(ctx, (cell, from, to) => {
		runs.push([cell.id, groundStorey, to]);
		const at = (corner: number, storey: number): Joint => {
			const [x, y] = cell.quad[corner];
			return { key: [cell.cornerIds[corner], storey], position: [x, y, level(ctx, storey)] };
		};
		cell.quad.forEach((_, i) => {
			const next = (i + 1) % cell.quad.length;
			add(at(i, groundStorey), at(i, to));
			for (let storey = from; storey <= to; storey += 1) add(at(i, storey), at(next, storey));
			for (let storey = from; storey < to; storey += 1)
				if (
					!builtAt(ctx, cell.sides[i].neighbour, storey) &&
					ctx.random.derive(`${cell.id}/brace/${i}/${ctx.space.datumIndex + storey}`).number() <
						brace
				)
					add(at(i, storey), at(next, storey + 1));
		});
	});
	return [...members.values()];
}

/** A thin deck under every framed storey of every built cell. */
function decks(ctx: Context, runs: StoreyRun[]): FaceBuilder[] {
	const faces: FaceBuilder[] = [];
	eachBuilt(ctx, (cell, from, to) => {
		const plate = inset(cell.quad, archigramBarM / 2);
		const first = Math.max(1, from);
		for (let storey = first; storey <= to; storey += 1)
			faces.push(() =>
				extrusion(plate, level(ctx, storey) - frameDeckThicknessM, level(ctx, storey))
			);
		runs.push([cell.id, first - 1, to]);
	});
	return faces;
}

/** Service tubes at a share of the outer cell corners, inside their cells, rising past the top. */
function tubes(ctx: Context, runs: StoreyRun[]): FaceBuilder[] {
	const share = ctx.style.parts.tubeShareRatio * ctx.complexity;
	const faces: FaceBuilder[] = [];
	eachBuilt(ctx, (cell, _, to) => {
		cell.sides.forEach(({ neighbour }, i) => {
			if (neighbour !== null || ctx.random.derive(`${cell.id}/tube/${i}`).number() >= share) return;
			const wall = side(cell.quad, i);
			const [x, y] = wall.at(1 / 2, -(archigramTubeRadiusM + archigramBarM));
			const ring = rounded(
				[
					[x - archigramTubeRadiusM, y - archigramTubeRadiusM],
					[x + archigramTubeRadiusM, y - archigramTubeRadiusM],
					[x + archigramTubeRadiusM, y + archigramTubeRadiusM],
					[x - archigramTubeRadiusM, y + archigramTubeRadiusM]
				],
				/* Exact arithmetic: round the original ring without an inset. */ 0,
				archigramTubeRadiusM * (1 - defaults.tubeCornerInsetRatio)
			);
			runs.push([cell.id, groundStorey, Math.min(to + 1, ctx.space.storeyCount)]);
			faces.push(() =>
				extrusion(
					ring,
					ctx.space.baseZ,
					level(ctx, to) +
						readStoreyHeight(ctx.space, Math.min(to, ctx.space.storeyCount - 1)) /
							defaults.tubeRoofRiseStoreyDivisor
				)
			);
		});
	});
	return faces;
}

/** A mast on the tallest built cell, inside its storey span above the roof. */
function mast(ctx: Context, runs: StoreyRun[]): FaceBuilder[] {
	const storeys = ctx.style.parts.mastStoreys;
	if (!storeys) return [];
	let best: { cell: FineCell; to: number } | undefined;
	eachBuilt(ctx, (cell, _, to) => {
		if (!best || to > best.to) best = { cell, to };
	});
	if (!best || best.to + storeys > ctx.space.storeyCount) return [];
	runs.push([best.cell.id, best.to, best.to + storeys]);
	const [x, y] = cellCenter(best.cell);
	const base = level(ctx, best.to);
	const top = level(ctx, best.to + storeys);
	const arm =
		side(best.cell.quad, /* Exact arithmetic: first edge of the mast cell. */ 0).length *
		defaults.mastArmReachRatio;
	const upper = top - mastBarM * defaults.mastUpperBarOffsetRatio;
	const lower = top - mastBarM * defaults.mastLowerBarOffsetRatio;
	return [
		() => bar([x, y, base], [x, y, top], mastBarM * defaults.mastPoleGaugeRatio),
		() => bar([x - arm, y, upper], [x + arm, y, upper], mastBarM),
		() => bar([x, y - arm, lower], [x, y + arm, lower], mastBarM)
	];
}

/** Structure and services of a framed style: frame, decks, tubes and mast, one mesh per kind. */
export function structure(ctx: Context): HousePart[] {
	if (!ctx.style.parts.frame) return [];
	const part = (
		id: string,
		slot: string,
		build: (ctx: Context, runs: StoreyRun[]) => FaceBuilder[]
	) => {
		const runs: StoreyRun[] = [];
		const faces = build(ctx, runs);
		return lazyFaceParts(`${ctx.space.id}/${id}`, slot, runs, () =>
			faces.flatMap((make) => make())
		);
	};
	return [
		...part('frame', 'frame', frame),
		...part('decks', 'deck', decks),
		...part('tubes', 'tube', tubes),
		...part('mast', 'mast', mast)
	];
}

/** Edge posts and head beams on the exposed frontage and court sides of added storeys. */
export function additionFrames(ctx: Context): HousePart[] {
	const layers = Map.groupBy(
		ctx.space.cells.flatMap((cell) =>
			(ctx.occupancy.get(cell.id)?.program ?? []).flatMap(({ phase, storey }) =>
				phase === 'addition' ? [{ cell, storey }] : []
			)
		),
		({ storey }) => storey
	);
	return [...layers].flatMap(([storey, cells]) => {
		const members = new Map<string, FaceBuilder>();
		const runs: StoreyRun[] = [];
		const bottom = level(ctx, storey);
		const top = level(ctx, storey + 1);
		for (const { cell } of cells) {
			let exposed = false;
			cell.sides.forEach(({ frontage, court }, i) => {
				if (!frontage && !court) return;
				exposed = true;
				const ring = ctx.style.fill.kinds.includes('envelope')
					? envelopeRing(ctx, cell, storey)
					: cell.quad;
				const wall = side(ring, i);
				const a = ring === cell.quad ? cell.cornerIds[i] : `${cell.id}/inset/${i}`;
				const next = (i + 1) % cell.quad.length;
				const b = ring === cell.quad ? cell.cornerIds[next] : `${cell.id}/inset/${next}`;
				const beam = encodePair(a, b);
				if (!members.has(beam))
					members.set(beam, () => bar([...wall.a, top], [...wall.b, top], archigramBarM));
				if (!members.has(a))
					members.set(a, () => bar([...wall.a, bottom], [...wall.a, top], archigramBarM));
				if (!members.has(b))
					members.set(b, () => bar([...wall.b, bottom], [...wall.b, top], archigramBarM));
			});
			if (exposed) runs.push([cell.id, storey, storey + 1]);
		}
		const id = `${ctx.space.id}/addition-frame/${ctx.space.datumIndex + storey}`;
		return lazyFaceParts(id, 'frame', runs, () => [...members.values()].flatMap((make) => make()));
	});
}
