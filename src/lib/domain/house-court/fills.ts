import type { Vec2 } from '../../core/geometry';
import type { Random } from '../../core/random';
import { defaults } from '../../../config/house-court';
import type { FineCell } from '../cell-space';
import type { HouseCell } from './occupancy';
import type { Context } from './context';
import {
	chamfered,
	cone,
	dome,
	extrusion,
	inradius,
	inset,
	insetSides,
	rounded,
	wedge,
	type Faces
} from './solids';
import type { FillKind, HouseStyle, RoofKind } from './styles';

const { chamferShareRatio, insetLimitRatio } = defaults;

/** One closed solid inside one cell: its plan outline, its gap to the cell sides, its storey
 * range, whether its walls are flat between corners, and its role slot. */
export type CellSolid = Readonly<{
	cell: FineCell;
	slot: string;
	outline: readonly Vec2[];
	gapM: number;
	fromStorey: number;
	toStorey: number;
	flat: boolean;
	faces: Faces;
	key: string;
}>;

/** Picks one entry of a nonempty list with a keyed draw. */
export function pick<T>(random: Random, key: string, list: readonly T[]): T {
	return list[Math.floor(random.derive(key).number() * list.length)];
}

// Exact arithmetic: structural counts, switches, origins and unit axes, not tunables.
function outline(kind: FillKind, quad: readonly Vec2[], gap: number, style: HouseStyle): Vec2[] {
	const shape = shaped(kind, quad, gap, style);
	return shape.length < 3 ? [...quad] : shape;
}

/** A calm house's block outline: the cell inset by the gap only toward the frontage, a shared
 * court and open cells of the house. Sides on other parcel edges (party walls) and toward built
 * cells covering the whole run stay flush, so bodies join into one building and a row of houses
 * into one street front. */
function joined(ctx: Context, cell: FineCell, gap: number, from: number, to: number): Vec2[] {
	const g = Math.min(gap, inradius(cell.quad) * insetLimitRatio);
	const shape = insetSides(
		cell.quad,
		cell.sides.map(({ neighbour, frontage, court }) => {
			if (neighbour === null) return frontage || court ? g : 0;
			const other = ctx.occupancy.get(neighbour);
			return other && other.fromStorey <= from && other.toStorey >= to ? 0 : g;
		})
	);
	return shape.length < 3 ? [...cell.quad] : shape;
}

function shaped(kind: FillKind, quad: readonly Vec2[], gap: number, style: HouseStyle): Vec2[] {
	const limit = inradius(quad) * insetLimitRatio;
	const g = Math.min(gap, limit);
	const curve = style.fill.roundShareRatio * Math.max(0, inradius(quad) - g);
	switch (kind) {
		case 'round':
		case 'capsule':
			return rounded(quad, g, curve);
		case 'chamfer':
			return chamfered(quad, g, chamferShareRatio * inradius(quad));
		case 'block':
		case 'envelope':
			return inset(quad, g);
		default:
			return inset(quad, g);
	}
}

const level = ({ space }: Context, storey: number) => space.baseZ + storey * space.storeyHeightM;

function solid(
	ctx: Context,
	cell: FineCell,
	kind: FillKind,
	gap: number,
	slot: string,
	from: number,
	to: number,
	key: string
): CellSolid {
	const join = ctx.house.scale === 'calm' && kind === 'block';
	const points = join ? joined(ctx, cell, gap, from, to) : outline(kind, cell.quad, gap, ctx.style);
	return {
		cell,
		slot,
		outline: points,
		gapM: Math.min(gap, inradius(cell.quad) * insetLimitRatio),
		fromStorey: from,
		toStorey: to,
		flat: kind === 'block' || kind === 'chamfer',
		faces: extrusion(points, level(ctx, from), level(ctx, to)),
		key
	};
}

function capsules(ctx: Context, cell: FineCell, house: HouseCell): CellSolid[] {
	const { fill, slots } = ctx.style;
	const result: CellSolid[] = [];
	for (let storey = house.fromStorey; storey < house.toStorey; storey += 1) {
		const key = `${cell.id}/capsule/${storey}`;
		if (ctx.random.derive(key).number() >= fill.capsuleShareRatio) continue;
		const points = outline('capsule', cell.quad, fill.insetM, ctx.style);
		const base = level(ctx, storey) + fill.capsuleGapM;
		const top = level(ctx, storey + 1) - fill.capsuleGapM;
		result.push({
			cell,
			slot: pick(ctx.random, `${key}/slot`, slots.capsule),
			outline: points,
			gapM: fill.insetM,
			fromStorey: storey,
			toStorey: storey + 1,
			flat: false,
			faces: extrusion(points, base, top),
			key
		});
	}
	return result;
}

function stacked(ctx: Context, cell: FineCell, house: HouseCell, kind: FillKind): CellSolid[] {
	const { fill, slots } = ctx.style;
	const stream = ctx.random.derive(`${cell.id}/stack`);
	const runs = house.toStorey - house.fromStorey;
	const split =
		runs > 1 && stream.number() < fill.stackShareRatio
			? house.fromStorey + 1 + Math.floor(stream.number() * (runs - 1))
			: house.toStorey;
	const lower = solid(
		ctx,
		cell,
		kind,
		fill.insetM,
		pick(ctx.random, `${cell.id}/body/0`, slots.body),
		house.fromStorey,
		split,
		`${cell.id}/body/0`
	);
	if (split === house.toStorey) return [lower];
	const upperKind = fill.kinds[(fill.kinds.indexOf(kind) + 1) % fill.kinds.length];
	const upper = solid(
		ctx,
		cell,
		upperKind,
		fill.insetM + fill.stackInsetM,
		pick(ctx.random, `${cell.id}/body/1`, slots.body),
		split,
		house.toStorey,
		`${cell.id}/body/1`
	);
	return [lower, upper];
}

/** The top of an envelope cell run, which a roof solid can stand on. */
function envelopeTop(ctx: Context, cell: FineCell, house: HouseCell): CellSolid {
	return {
		cell,
		slot: 'wall',
		outline: cell.quad,
		gapM: 0,
		fromStorey: house.fromStorey,
		toStorey: house.toStorey,
		flat: true,
		faces: [],
		key: `${cell.id}/envelope`
	};
}

const roofShapes = { wedge, cone, dome } as const;

function roof(ctx: Context, top: CellSolid): CellSolid[] {
	const { roof: rule, slots } = ctx.style;
	const kind: RoofKind = pick(ctx.random, `${top.cell.id}/roof`, rule.kinds);
	if (kind === 'flat' || top.toStorey >= ctx.space.storeyCount) return [];
	const slot = slots.roof.length
		? pick(ctx.random, `${top.cell.id}/roof/slot`, slots.roof)
		: top.slot;
	const faces = roofShapes[kind](
		top.outline,
		level(ctx, top.toStorey),
		rule.riseRatio * ctx.space.storeyHeightM
	);
	return [
		{
			...top,
			slot,
			fromStorey: top.toStorey,
			toStorey: top.toStorey + 1,
			flat: false,
			faces,
			key: `${top.cell.id}/roof`
		}
	];
}

/** The closed solids of every built cell: stacked bodies, or capsules per framed storey, then a
 * roof solid in the storey above the run, all inside the cell's own quad. Cells of an `envelope`
 * fill yield only their roof solid; a flat roof yields none. */
export function cellSolids(ctx: Context): CellSolid[] {
	return ctx.space.cells.flatMap((cell) => {
		const house = ctx.occupancy.get(cell.id);
		if (!house || house.toStorey <= house.fromStorey) return [];
		const kind = pick(ctx.random, `${cell.id}/fill`, ctx.style.fill.kinds);
		if (kind === 'envelope') return roof(ctx, envelopeTop(ctx, cell, house));
		if (kind === 'capsule') return capsules(ctx, cell, house);
		const bodies = stacked(ctx, cell, house, kind);
		return [...bodies, ...roof(ctx, bodies[bodies.length - 1])];
	});
}
