import { distance } from '../../core/geometry';
import { blockInputs, resolveParams } from '../../core/params';
import { Random } from '../../core/random';
import {
	cellCentre,
	fineCellWidth,
	minimumStripWidthM,
	type CellSpace,
	type FineCell
} from '../cell-space';
import {
	boundaryDepth,
	frontageCentre,
	frontageDistance,
	frontageSegments,
	fronting,
	hops
} from './graph';
import { defaults } from '../../../config/house-court';
import { cellRoles, type CellRole } from './roles';
import { hasCourtAccess, houseScale, type HouseScale } from './scale';
import { houseStyles, type HouseStyle } from './styles';

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
 * plot thickness. */
export type HouseSite = Readonly<{ entranceRiseM?: number; corner?: boolean; groundZ?: number }>;

/** Occupancy of one fine cell: built storeys are `fromStorey` up to, not including, `toStorey`. */
export type HouseCell = Readonly<{
	id: string;
	role: CellRole;
	fromStorey: number;
	toStorey: number;
}>;

/** The occupancy of a cell space, in cell order, with the resolved inputs it came from. */
export type HouseCourt = Readonly<{
	spaceId: string;
	cellIds: readonly string[];
	styleId: string;
	inputs: Readonly<{ height: number; width: number; complexity: number; seed: number }>;
	storeys: number;
	cells: readonly HouseCell[];
	entrances: readonly (readonly string[])[];
	scale: HouseScale;
	courtAccess: boolean;
	site: Readonly<{ entranceRiseM: number; corner: boolean; groundZ: number | null }>;
}>;

type Plan = Map<string, { role: CellRole; storeys: number }>;

type Occupancy = HouseStyle['occupancy'];

/** Storeys of a calm frontage cell: the house's eaves line, risen at a block corner. */
// Exact arithmetic: one storey is the smallest built run.
function eaves(top: number, random: Random, corner: boolean): number {
	const drop = Math.floor(random.derive('eaves').number() * (eavesToleranceStoreys + 1));
	return Math.max(1, top - drop + (corner ? cornerRiseStoreys : 0));
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
function frontDoor(space: CellSpace): readonly string[] {
	const target = frontageCentre(frontageSegments(space));
	const [door] = space.cells
		.filter(fronting)
		.sort(
			(a, b) =>
				distance(cellCentre(a), target) - distance(cellCentre(b), target) || (a.id < b.id ? -1 : 1)
		);
	return door ? [door.id] : [];
}

function entrancePath(space: CellSpace, court: readonly string[]): readonly string[] {
	if (!court.length) return [];
	const fromCourt = hops(space, court);
	const target = frontageCentre(frontageSegments(space));
	const rank = (cell: FineCell) => [
		fromCourt.get(cell.id) ?? Infinity,
		distance(cellCentre(cell), target)
	];
	const [start] = space.cells.filter(fronting).sort((a, b) => {
		const [ha, da] = rank(a);
		const [hb, db] = rank(b);
		return ha - hb || da - db || (a.id < b.id ? -1 : 1);
	});
	const byId = new Map(space.cells.map((cell) => [cell.id, cell]));
	const path: string[] = [];
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

// Exact arithmetic: structural counts, origins and unit axes, not tunables.
function carve(plan: Plan, path: readonly string[]) {
	for (const id of path) {
		const cell = plan.get(id);
		if (!cell || !cellRoles[cell.role].built || cellRoles[cell.role].fromStorey > 0) continue;
		plan.set(
			id,
			cell.storeys > 1 ? { role: 'gate', storeys: cell.storeys } : { role: 'passage', storeys: 0 }
		);
	}
}

/** Fills a cell space with one house around a court (FORM-1). The deepest hop layer from the parcel
 * boundary is the court, void to the sky, unless the space opens onto a shared court (a cell side
 * with `court`), the house is large and its style row keeps no court, or no inner cell exists.
 * Other cells are built when they touch the frontage or their centre lies within `width` meters of
 * it (a large house builds them all) and are at least the strip minimum width; the rest stay
 * garden. Storeys are round(height / storey
 * height), clamped to the space; a large house stands evenly at the large storey count, leaving a
 * storey for its roof figure when its row's large roof is not flat. Complexity
 * lowers cells toward the rear, steps court-facing cells down and lets seeded cells rise or fall,
 * all by the style's occupancy row. A calm house keeps its frontage cells on one eaves line: the
 * height less a seeded drop up to the eaves tolerance, raised at a block corner. The shortest path
 * from the frontage to each connected part of an own court opens a ground-storey gate; a house
 * without one has its front door in the frontage cell nearest the frontage centre, opened at the
 * ground storey when the site's entrance rise needs steps. The style may then raise further wing
 * cells on an open ground storey. Roles fix the storey runs (`cellRoles`). Built cells grow
 * monotonically with width and every cell's storeys with height. Deterministic for equal inputs. */
// Exact arithmetic: structural counts, origins and unit axes, not tunables.
export function createHouseCourt(
	space: CellSpace,
	inputs: HouseInputs,
	style: HouseStyle = houseStyles.neutral,
	site: HouseSite = {}
): HouseCourt {
	const random = Random.create({ seed: inputs.seed });
	const { height, width, complexity } = resolveParams(blockInputs, shapeInputs(inputs));
	const segments = frontageSegments(space);
	if (!segments.length) throw new RangeError('A house needs at least one frontage side');
	const scale = houseScale(space);
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
	const top = Math.max(
		1,
		Math.min(space.storeyCount, cap, Math.round(height / space.storeyHeightM))
	);
	const front = scale === 'calm' ? eaves(top, random, site.corner ?? false) : top;
	const plan: Plan = new Map();
	for (const cell of space.cells) {
		const span = distances.get(cell.id) ?? 0;
		if (courtIds.has(cell.id)) plan.set(cell.id, { role: 'court', storeys: 0 });
		else if ((!fronting(cell) && span > reach) || fineCellWidth(cell) < minimumStripWidthM)
			plan.set(cell.id, { role: 'garden', storeys: 0 });
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
	const entranceRiseM = Math.max(0, site.entranceRiseM ?? 0);
	const courts = components(space, courtIds);
	const entrances = courts.length
		? courts.map((court) => entrancePath(space, court))
		: [frontDoor(space)];
	for (const path of courts.length ? entrances : []) carve(plan, path);
	if (!courts.length && entranceRiseM > entranceStepRiseM) carve(plan, entrances[0]);
	raise(plan, random, style.occupancy);
	return Object.freeze({
		spaceId: space.id,
		cellIds: Object.freeze(space.cells.map(({ id }) => id)),
		styleId: style.id,
		inputs: Object.freeze({ height, width, complexity, seed: random.seed }),
		storeys: Math.max(top, front),
		entrances: Object.freeze(entrances.map((path) => Object.freeze(path))),
		scale,
		courtAccess,
		site: Object.freeze({
			entranceRiseM,
			corner: site.corner ?? false,
			groundZ: site.groundZ ?? null
		}),
		cells: Object.freeze(
			space.cells.map(({ id }) => {
				const { role, storeys } = plan.get(id) ?? { role: 'garden', storeys: 0 };
				const { built, fromStorey } = cellRoles[role];
				return Object.freeze({ id, role, fromStorey, toStorey: built ? storeys : 0 });
			})
		)
	});
}
