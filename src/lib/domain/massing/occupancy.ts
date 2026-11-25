import { distance, type Vec2 } from '../../core/geometry';
import { createBlockInputs, resolveParams } from '../../core/params';
import { Random } from '../../core/random';
import {
	cellCenter,
	fineCellWidth,
	readStoreyElevation,
	readStoreyKey,
	type CellSpace,
	type FineCell
} from '../cell-space';
import {
	boundaryDepth,
	components,
	frontageCentre,
	frontageDistance,
	frontageSegments,
	fronting,
	hops,
	readEntranceMidpoint,
	readEntranceSide
} from './graph';
import { defaults } from '../../../config/massing';
import { cellRoles, type CellRole } from './roles';
import { hasCourtAccess, type HouseScale } from './scale';

const blockInputs = createBlockInputs();

const { eavesToleranceStoreys, cornerRiseStoreys, largeStoreys } = defaults;

/** Rise in meters above which the lane entrance takes steps. */
export const entranceStepRiseM = defaults.entranceStepRiseM;

/** Shared block inputs in meters and the unitless complexity, plus a uint32 seed. */
export type HouseInputs = Readonly<{
	height?: number;
	width?: number;
	complexity?: number;
	seed: number;
	/** Target occupied storey counts for existing columns, keyed by fine-cell ID. */
	cellOverrides?: Readonly<Record<string, number>>;
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
	storeyProgram?: (datumIndex: number, cellId: string) => StoreyProgram | undefined;
}>;

/** Construction phases and uses assigned to an occupied piece of the datum stack. */
export type StoreyProgram = Readonly<{
	phase: 'retained' | 'addition';
	use: 'public' | 'workshop' | 'office' | 'housing' | 'city-farm' | 'greenhouse';
}>;

/** One occupied storey with an explicit use and construction phase. */
export type HouseStorey = StoreyProgram &
	Readonly<{ key: string; cellId: string; storey: number; datumIndex: number }>;

/** Occupancy of one fine cell: built storeys are `fromStorey` up to, not including, `toStorey`. */
export type HouseCell = Readonly<{
	id: string;
	role: CellRole;
	fromStorey: number;
	toStorey: number;
	program?: readonly HouseStorey[];
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
	unbuildable?: 'no-frontage-route' | 'no-built-cells' | 'entrance-below-lane' | 'no-court-route';
	site: Readonly<{
		entranceRiseM: number;
		corner: boolean;
		groundZ: number | null;
		laneZ?: number;
	}>;
}>;

type Plan = Map<string, { role: CellRole; storeys: number }>;

/** Plain parameters for stepped heights, seeded jitter, and open ground storeys. */
export type HouseOccupancyTendencies = Readonly<{
	rearDropRatio: number;
	courtStepComplexityRatio: number;
	courtStepStoreys: number;
	jitterComplexityRatio: number;
	jitterShareRatio: number;
	jitterStoreys: number;
	groundOpenRatio: number;
}>;

/** Resolved occupancy parameters supplied by the caller's style row. */
export type HouseOccupancyParameters = Readonly<{
	styleId: string;
	tendencies: HouseOccupancyTendencies;
	largeCourt: boolean;
	largeRoofHasFigure: boolean;
}>;

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
	rule: HouseOccupancyTendencies
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
function raise(plan: Plan, random: Random, rule: HouseOccupancyTendencies) {
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
		space.houseRules?.requireConnectedEntrance && !built.length
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

function carve(plan: Plan, path: readonly string[]) {
	for (const id of path) {
		const cell = plan.get(id);
		if (!cell || !cellRoles[cell.role].built || cellRoles[cell.role].fromStorey > 0) continue;
		plan.set(
			id,
			cell.storeys > 1
				? { role: 'gate', storeys: cell.storeys }
				: { role: 'passage', storeys: /* Exact arithmetic: open passage has no built stories. */ 0 }
		);
	}
}

function buildFailure(space: CellSpace, entry: string | undefined, built: string[], rise: number) {
	if (!built.length) return 'no-built-cells';
	if (!entry || (space.houseRules?.requireConnectedEntrance && !hops(space, built).has(entry)))
		return 'no-frontage-route';
	if (rise < -entranceStepRiseM) return 'entrance-below-lane';
}

function applyCellOverrides(
	plan: Plan,
	overrides: NonNullable<HouseInputs['cellOverrides']>,
	cap: number
) {
	for (const [id, count] of Object.entries(overrides)) {
		const cell = plan.get(id);
		if (!cell || !cellRoles[cell.role].built)
			throw new RangeError('No built column at fine cell: ' + id);
		if (!Number.isSafeInteger(count) || count < 0)
			throw new RangeError('Invalid occupied storey count at fine cell: ' + id);
		const { fromStorey } = cellRoles[cell.role];
		if (count > 0)
			plan.set(id, { ...cell, storeys: fromStorey + Math.min(cap - fromStorey, count) });
		else
			plan.set(id, {
				role: cell.role === 'gate' ? 'passage' : 'garden',
				storeys: /* Exact arithmetic: a cleared column has no occupied storeys. */ 0
			});
	}
}

function hasBuiltCourtSide(space: CellSpace, plan: Plan) {
	return space.cells.some(
		({ id, sides }) => (plan.get(id)?.storeys ?? 0) > 0 && sides.some(({ court }) => court)
	);
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

function readCellProgram(
	space: CellSpace,
	cellId: string,
	fromStorey: number,
	toStorey: number,
	program: NonNullable<HouseSite['storeyProgram']>
): readonly HouseStorey[] {
	const result: HouseStorey[] = [];
	for (let storey = fromStorey; storey < toStorey; storey++) {
		const datumIndex = space.datumIndex + storey;
		const use = program(datumIndex, cellId);
		if (use)
			result.push(
				Object.freeze({
					...use,
					key: readStoreyKey(space.id, cellId, datumIndex),
					cellId,
					storey,
					datumIndex
				})
			);
	}
	return Object.freeze(result);
}

/** Fills a cell space with one house around a court (FORM-1). The deepest hop layer from the parcel
 * boundary is the court, void to the sky, unless the space opens onto a shared court (a cell side
 * with `court`), the house is large and its style row keeps no court, or no inner cell exists.
 * Other cells are built when they touch the frontage or their centre lies within `width` meters of
 * it (a large house builds them all). Cells must meet any subdivision minimum width; the rest stay
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
	{ styleId, tendencies, largeCourt, largeRoofHasFigure }: HouseOccupancyParameters,
	site: HouseSite = {}
): HouseOccupancy {
	const random = Random.create({ seed: inputs.seed });
	const { height, width, complexity } = resolveParams(blockInputs, shapeInputs(inputs));
	const segments = frontageSegments(space);
	if (!segments.length) throw new RangeError('A house needs at least one frontage side');
	const scale = site.scale ?? 'regular';
	const courtAccess = hasCourtAccess(space);
	const ownCourt = !courtAccess && (scale !== 'large' || largeCourt);
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
	const roofRoom = largeRoofHasFigure ? 1 : 0;
	const cap =
		scale === 'large'
			? Math.max(1, Math.min(largeStoreys, space.storeyCount - roofRoom))
			: space.storeyCount;
	const top = Math.max(1, Math.min(space.storeyCount, cap, storeysAtHeight(space, height)));
	const front = scale === 'calm' ? eaves(top, cap, random, site.corner ?? false) : top;
	const plan: Plan = new Map();
	const minimumWidthM = space.houseRules?.minimumWidthM ?? 0;
	for (const cell of space.cells) {
		const span = distances.get(cell.id) ?? 0;
		if (courtIds.has(cell.id))
			plan.set(cell.id, {
				role: 'court',
				storeys: /* Exact arithmetic: open court has no built stories. */ 0
			});
		else if (
			(!fronting(cell) && span > reach) ||
			(minimumWidthM > 0 && fineCellWidth(cell) < minimumWidthM)
		)
			plan.set(cell.id, {
				role: 'garden',
				storeys: /* Exact arithmetic: open garden has no built stories. */ 0
			});
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
					cellStoreys(cell, top, rear, faceCourt, random, complexity, tendencies)
				)
			});
		}
	}
	const courts = components(space, courtIds);
	const paths = courts.map((court) => entrancePath(space, court)).filter((path) => path.length);
	const entrances = paths.length ? paths : [frontDoor(space, plan)];
	const entry = readEntranceSide(space, entrances);
	const laneZ = entry && site.groundAtEntrance?.(readEntranceMidpoint(entry.cell, entry.index));
	const rise = laneZ === undefined ? (site.entranceRiseM ?? 0) : space.baseZ - laneZ;
	const entranceRiseM = Math.max(0, rise);
	for (const path of paths) carve(plan, path);
	if (!paths.length && entranceRiseM > entranceStepRiseM) carve(plan, entrances[0]);
	raise(plan, random, tendencies);
	// Overrides keep the base and passage roles, so the carved paths to own courts stay open.
	const overrides = inputs.cellOverrides;
	const hasOverrides = overrides !== undefined && Object.keys(overrides).length > 0;
	const hasCourtSide = hasOverrides && courtAccess && hasBuiltCourtSide(space, plan);
	const entryId = entry?.cell.id;
	const entranceWasBuilt = entryId !== undefined && (plan.get(entryId)?.storeys ?? 0) > 0;
	if (hasOverrides) applyCellOverrides(plan, overrides, cap);
	const built = [...plan].filter(([, { storeys }]) => storeys > 0).map(([id]) => id);
	const entranceCleared =
		hasOverrides &&
		entranceWasBuilt &&
		entryId !== undefined &&
		plan.get(entryId)?.role === 'garden';
	const unbuildable =
		buildFailure(space, entryId, built, rise) ??
		(entranceCleared
			? 'no-frontage-route'
			: hasCourtSide && !hasBuiltCourtSide(space, plan)
				? 'no-court-route'
				: undefined);
	if (unbuildable)
		for (const id of plan.keys())
			plan.set(id, {
				role: 'garden',
				storeys: /* Exact arithmetic: open garden has no built stories. */ 0
			});
	return Object.freeze({
		spaceId: space.id,
		cellIds: Object.freeze(space.cells.map(({ id }) => id)),
		styleId,
		inputs: Object.freeze({ height, width, complexity, seed: random.seed }),
		storeys: unbuildable
			? 0
			: hasOverrides
				? Math.max(...[...plan.values()].map(({ storeys }) => storeys))
				: Math.max(top, front),
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
				const { role, storeys } = plan.get(id) ?? {
					role: 'garden',
					storeys: /* Exact arithmetic: open garden has no built stories. */ 0
				};
				const { built, fromStorey } = cellRoles[role];
				const toStorey = built ? storeys : 0;
				const program =
					site.storeyProgram &&
					readCellProgram(space, id, fromStorey, toStorey, site.storeyProgram);
				return Object.freeze({ id, role, fromStorey, toStorey, ...(program ? { program } : {}) });
			})
		)
	});
}
