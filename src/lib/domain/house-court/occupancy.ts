import { distance, type Vec2 } from '../../core/geometry';
import { createBlockInputs, resolveParams } from '../../core/params';
import { Random } from '../../core/random';
import {
	cellCenter,
	fineCellWidth,
	minimumStripWidthM,
	readStoreyElevation,
	type CellSpace,
	type FineCell
} from '../cell-space';
import {
	boundaryDepth,
	entranceSide,
	frontageCentre,
	frontageDistance,
	frontageSegments,
	fronting,
	hops
} from './graph';
import { defaults } from '../../../config/house-court';
import { cellRoles, type CellRole } from './roles';
import { hasCourtAccess, type HouseScale } from './scale';
import { houseStyles, type HouseStyle } from './styles';

const blockInputs = createBlockInputs();

const { eavesToleranceStoreys, cornerRiseStoreys, largeStoreys, entranceStepRiseM } = defaults;

/** Shared block inputs in meters and the unitless complexity, plus a uint32 seed. */
export type HouseInputs = Readonly<{
	height?: number;
	width?: number;
	complexity?: number;
	seed: number;
}>;

/** What the site tells the house: the rise in meters from the lane at the frontage to the cell
 * space's base, whether the parcel holds a block corner, and the lowest ground elevation under the
 * parcel, down to which ground plates reach as a plinth. Defaults: no rise, no corner, plates of
 * plot thickness. `groundAtEntrance` takes precedence over a fixed rise and samples the selected
 * frontage midpoint. Scale defaults to regular. */
export type HouseSite = Readonly<{
	entranceRiseM?: number;
	groundAtEntrance?: (point: Vec2) => number;
	corner?: boolean;
	groundZ?: number;
	scale?: HouseScale;
}>;

/** Occupancy of one fine cell: built storeys are `fromStorey` up to, not including, `toStorey`. */
export type HouseCell = Readonly<{
	id: string;
	role: CellRole;
	fromStorey: number;
	toStorey: number;
}>;

/** The occupancy of a cell space, in cell order, with the resolved inputs it came from. */
export type HouseOccupancy = Readonly<{
	spaceId: string;
	cellIds: readonly string[];
	styleId: string;
	inputs: Readonly<{ height: number; width: number; complexity: number; seed: number }>;
	storeys: number;
	cells: readonly HouseCell[];
	entrances: readonly (readonly string[])[];
	scale: HouseScale;
	courtAccess: boolean;
	unbuildable?: 'no-frontage-route' | 'no-built-cells' | 'entrance-below-lane';
	site: Readonly<{
		entranceRiseM: number;
		corner: boolean;
		groundZ: number | null;
		laneZ?: number;
	}>;
}>;

type Plan = Map<string, { role: CellRole; storeys: number }>;

type Occupancy = HouseStyle['occupancy'];

/** Storeys of a calm frontage cell: the house's eaves line, risen at a block corner. */
// Exact arithmetic: one storey is the smallest built run.
function eaves(top: number, cap: number, random: Random, corner: boolean): number {
	const drop = Math.floor(random.derive('eaves').number() * (eavesToleranceStoreys + 1));
	return Math.max(1, Math.min(cap, top - drop + (corner ? cornerRiseStoreys : 0)));
}

// Exact arithmetic: one storey is the smallest built run.
function cellStoreys(
	cell: FineCell,
	top: number,
	rear: number,
	faceCourt: boolean,
	random: Random,
	complexity: number,
	rule: Occupancy
) {
	let storeys = top - Math.round(complexity * rule.rearDropRatio * rear * (top - 1));
	if (faceCourt && complexity >= rule.courtStepComplexityRatio) storeys -= rule.courtStepStoreys;
	if (complexity >= rule.jitterComplexityRatio) {
		const stream = random.derive(cell.id);
		const draw = stream.number();
		const step = 1 + Math.floor(stream.number() * rule.jitterStoreys);
		const share = complexity * rule.jitterShareRatio;
		if (draw < share) storeys += (draw < share / 2 ? -1 : 1) * step;
	}
	return Math.max(1, Math.min(top, storeys));
}

/** Wing cells of two or more storeys stand on an open ground storey with the style's share. */
function raise(plan: Plan, random: Random, rule: Occupancy) {
	for (const [id, cell] of plan)
		if (
			cell.role === 'wing' &&
			cell.storeys > 1 &&
			random.derive(`${id}/ground`).number() < rule.groundOpenRatio
		)
			plan.set(id, { role: 'raised', storeys: cell.storeys });
}

/** The frontage cell nearest the frontage centre, the front door of a house without its own court. */
function frontDoor(space: CellSpace, plan: Plan): readonly string[] {
	const target = frontageCentre(frontageSegments(space));
	const candidates = space.cells.filter(fronting);
	const built = candidates.filter(({ id }) => (plan.get(id)?.storeys ?? 0) > 0);
	const reachable =
		space.kind === 'strip' && !built.length
			? hops(
					space,
					[...plan].filter(([, cell]) => cell.storeys > 0).map(([id]) => id)
				)
			: undefined;
	const connected = reachable ? candidates.filter(({ id }) => reachable.has(id)) : candidates;
	const [door] = (built.length ? built : connected.length ? connected : candidates).sort(
		(a, b) =>
			distance(cellCenter(a), target) - distance(cellCenter(b), target) || (a.id < b.id ? -1 : 1)
	);
	return door ? [door.id] : [];
}

function entrancePath(space: CellSpace, court: readonly string[]): readonly string[] {
	if (!court.length) return [];
	const fromCourt = hops(space, court);
	const target = frontageCentre(frontageSegments(space));
	const rank = (cell: FineCell) => [
		fromCourt.get(cell.id) ?? Infinity,
		distance(cellCenter(cell), target)
	];
	const [start] = space.cells.filter(fronting).sort((a, b) => {
		const [ha, da] = rank(a);
		const [hb, db] = rank(b);
		return ha - hb || da - db || (a.id < b.id ? -1 : 1);
	});
	const byId = new Map(space.cells.map((cell) => [cell.id, cell]));
	const path: string[] = [];
	if (!start || !fromCourt.has(start.id)) return path;
	let current = start;
	while ((fromCourt.get(current.id) ?? 0) > 0) {
		path.push(current.id);
		const step = (fromCourt.get(current.id) ?? 0) - 1;
		const next = current.sides
			.map(({ neighbour }) => neighbour)
			.filter((id): id is string => id !== null && fromCourt.get(id) === step)
			.sort()[0];
		current = byId.get(next) ?? current;
	}
	return path;
}

function shapeInputs({ height, width, complexity }: HouseInputs) {
	const entries = Object.entries({ height, width, complexity }).filter(
		([, value]) => value !== undefined
	);
	return Object.fromEntries(entries) as Partial<Record<'height' | 'width' | 'complexity', number>>;
}

function neighboursIn(space: Map<string, FineCell>, id: string, court: ReadonlySet<string>) {
	return (space.get(id)?.sides ?? []).flatMap(({ neighbour }) =>
		neighbour && court.has(neighbour) ? [neighbour] : []
	);
}

function components(space: CellSpace, court: ReadonlySet<string>): string[][] {
	const byId = new Map(space.cells.map((cell) => [cell.id, cell]));
	const seen = new Set<string>();
	const groups: string[][] = [];
	for (const { id } of space.cells) {
		if (!court.has(id) || seen.has(id)) continue;
		const group = [id];
		seen.add(id);
		for (let k = 0; k < group.length; k += 1)
			for (const neighbour of neighboursIn(byId, group[k], court))
				if (!seen.has(neighbour)) {
					seen.add(neighbour);
					group.push(neighbour);
				}
		groups.push(group);
	}
	return groups;
}

function carve(plan: Plan, path: readonly string[]) {
	for (const id of path) {
		const cell = plan.get(id);
		if (!cell || !cellRoles[cell.role].built || cellRoles[cell.role].fromStorey > 0) continue;
		plan.set(
			id,
			cell.storeys > 1
				? { role: 'gate', storeys: cell.storeys }
				: /* Exact arithmetic: open passage has no built stories. */ { role: 'passage', storeys: 0 }
		);
	}
}

function buildFailure(space: CellSpace, entry: string | undefined, built: string[], rise: number) {
	if (!built.length) return 'no-built-cells';
	if (!entry || (space.kind === 'strip' && !hops(space, built).has(entry)))
		return 'no-frontage-route';
	if (rise < -entranceStepRiseM) return 'entrance-below-lane';
}

/** Rounds a requested height to the nearest storey boundary, with ties rounding up. */
function storeysAtHeight(space: CellSpace, height: number): number {
	if (space.storeyHeightM !== undefined) return Math.round(height / space.storeyHeightM);
	const target = space.baseZ + height;
	for (let index = 1; index <= space.storeyCount; index += 1) {
		const bottom = readStoreyElevation(space, index - 1);
		const top = readStoreyElevation(space, index);
		if (target < bottom + (top - bottom) / 2) return index - 1;
	}
	return space.storeyCount;
}

/** Fills a cell space with one house around a court (FORM-1). The deepest hop layer from the parcel
 * boundary is the court, void to the sky, unless the space opens onto a shared court (a cell side
 * with `court`), the house is large and its style row keeps no court, or no inner cell exists.
 * Other cells are built when they touch the frontage or their centre lies within `width` meters of
 * it (a large house builds them all). Strip cells must meet the strip minimum width; the rest stay
 * garden. Requested height rounds to the nearest storey boundary, clamped to the space; a large house stands evenly at the large storey count, leaving a
 * storey for its roof figure when its row's large roof is not flat. Complexity
 * lowers cells toward the rear, steps court-facing cells down and lets seeded cells rise or fall,
 * all by the style's occupancy row. A calm house keeps its frontage cells on one eaves line: the
 * height less a seeded drop up to the eaves tolerance, raised at a block corner. The shortest path
 * from the frontage to each connected part of an own court opens a ground-storey gate; a house
 * without one has its front door in the frontage cell nearest the frontage centre, opened at the
 * ground storey when the site's entrance rise needs steps. The style may then raise further wing
 * cells on an open ground storey. Roles fix the storey runs (`cellRoles`). Built cells grow
 * monotonically with width and every cell's storeys with height. If the entrance or built volume
 * cannot fit, the result names the reason and leaves the plot as garden. Deterministic for equal inputs. */
export function createHouseOccupancy(
	space: CellSpace,
	inputs: HouseInputs,
	style: HouseStyle = houseStyles.neutral,
	site: HouseSite = {}
): HouseOccupancy {
	const random = Random.create({ seed: inputs.seed });
	const { height, width, complexity } = resolveParams(blockInputs, shapeInputs(inputs));
	const segments = frontageSegments(space);
	if (!segments.length) throw new RangeError('A house needs at least one frontage side');
	const scale = site.scale ?? 'regular';
	const courtAccess = hasCourtAccess(space);
	const ownCourt = !courtAccess && (scale !== 'large' || style.large.court);
	const depth = boundaryDepth(space);
	const deepest = Math.max(...depth.values());
	const courtIds = new Set(
		space.cells
			.filter(({ id }) => ownCourt && deepest > 0 && depth.get(id) === deepest)
			.map(({ id }) => id)
	);
	const distances = new Map(space.cells.map((cell) => [cell.id, frontageDistance(cell, segments)]));
	const farthest = Math.max(...distances.values());
	const reach = scale === 'large' ? Infinity : width;
	const roofRoom = style.large.roof.some((kind) => kind !== 'flat') ? 1 : 0;
	const cap =
		scale === 'large'
			? Math.max(1, Math.min(largeStoreys, space.storeyCount - roofRoom))
			: space.storeyCount;
	const top = Math.max(1, Math.min(space.storeyCount, cap, storeysAtHeight(space, height)));
	const front = scale === 'calm' ? eaves(top, cap, random, site.corner ?? false) : top;
	const plan: Plan = new Map();
	for (const cell of space.cells) {
		const span = distances.get(cell.id) ?? 0;
		if (courtIds.has(cell.id))
			plan.set(
				cell.id,
				/* Exact arithmetic: open court has no built stories. */ { role: 'court', storeys: 0 }
			);
		else if (
			(!fronting(cell) && span > reach) ||
			(space.kind === 'strip' && fineCellWidth(cell) < minimumStripWidthM)
		)
			plan.set(
				cell.id,
				/* Exact arithmetic: open garden has no built stories. */ { role: 'garden', storeys: 0 }
			);
		else if ((scale === 'calm' && fronting(cell)) || scale === 'large')
			plan.set(cell.id, { role: 'wing', storeys: front });
		else {
			const faceCourt = cell.sides.some(
				({ neighbour }) => neighbour !== null && courtIds.has(neighbour)
			);
			const rear = farthest > 0 ? span / farthest : 0;
			plan.set(cell.id, {
				role: 'wing',
				storeys: Math.min(
					front,
					cellStoreys(cell, top, rear, faceCourt, random, complexity, style.occupancy)
				)
			});
		}
	}
	const courts = components(space, courtIds);
	const paths = courts.map((court) => entrancePath(space, court)).filter((path) => path.length);
	const entrances = paths.length ? paths : [frontDoor(space, plan)];
	const entry = entranceSide(space, entrances);
	const laneZ = entry && site.groundAtEntrance?.(entry.wall.at(1 / 2, 0));
	const rise = laneZ === undefined ? (site.entranceRiseM ?? 0) : space.baseZ - laneZ;
	const entranceRiseM = Math.max(0, rise);
	for (const path of paths) carve(plan, path);
	if (!paths.length && entranceRiseM > entranceStepRiseM) carve(plan, entrances[0]);
	raise(plan, random, style.occupancy);
	const built = [...plan].filter(([, { storeys }]) => storeys > 0).map(([id]) => id);
	const unbuildable = buildFailure(space, entry?.cell.id, built, rise);
	if (unbuildable)
		for (const id of plan.keys())
			plan.set(
				id,
				/* Exact arithmetic: open garden has no built stories. */ { role: 'garden', storeys: 0 }
			);
	return Object.freeze({
		spaceId: space.id,
		cellIds: Object.freeze(space.cells.map(({ id }) => id)),
		styleId: style.id,
		inputs: Object.freeze({ height, width, complexity, seed: random.seed }),
		storeys: unbuildable ? 0 : Math.max(top, front),
		entrances: Object.freeze((unbuildable ? [] : entrances).map((path) => Object.freeze(path))),
		scale,
		courtAccess,
		...(unbuildable ? { unbuildable } : {}),
		site: Object.freeze({
			entranceRiseM,
			...(laneZ === undefined ? {} : { laneZ }),
			corner: site.corner ?? false,
			groundZ: site.groundZ === undefined ? null : Math.min(site.groundZ, laneZ ?? Infinity)
		}),
		cells: Object.freeze(
			space.cells.map(({ id }) => {
				const { role, storeys } = plan.get(
					id
				) ?? /* Exact arithmetic: open garden has no built stories. */ {
					role: 'garden',
					storeys: 0
				};
				const { built, fromStorey } = cellRoles[role];
				return Object.freeze({ id, role, fromStorey, toStorey: built ? storeys : 0 });
			})
		)
	});
}
