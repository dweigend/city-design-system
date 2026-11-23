import { distance } from '../../core/geometry';
import { blockInputs, resolveParams } from '../../core/params';
import { Random } from '../../core/random';
import { defaults } from '../../../config/house-court';
import { cellCentre, type CellSpace, type FineCell } from '../cell-space';
import {
	boundaryDepth,
	frontageCentre,
	frontageDistance,
	frontageSegments,
	fronting,
	hops
} from './graph';
import type { CellRole } from './roles';

const {
	rearDropRatio,
	courtStepComplexityRatio,
	courtStepStoreys,
	jitterComplexityRatio,
	jitterShareRatio
} = defaults;

/** Shared block inputs in meters and the unitless complexity, plus a uint32 seed. */
export type HouseInputs = Readonly<{
	height?: number;
	width?: number;
	complexity?: number;
	seed: number;
}>;

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
	inputs: Readonly<{ height: number; width: number; complexity: number; seed: number }>;
	storeys: number;
	cells: readonly HouseCell[];
	entrances: readonly (readonly string[])[];
}>;

type Plan = Map<string, { role: CellRole; storeys: number }>;

function cellStoreys(
	cell: FineCell,
	top: number,
	rear: number,
	faceCourt: boolean,
	random: Random,
	complexity: number
) {
	let storeys = top - Math.round(complexity * rearDropRatio * rear * (top - 1));
	if (faceCourt && complexity >= courtStepComplexityRatio) storeys -= courtStepStoreys;
	if (complexity >= jitterComplexityRatio) {
		const draw = random.derive(cell.id).number();
		const share = complexity * jitterShareRatio;
		if (draw < share) storeys += draw < share / 2 ? -1 : 1;
	}
	return Math.max(1, Math.min(top, storeys));
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

function components(space: CellSpace, court: ReadonlySet<string>): string[][] {
	const byId = new Map(space.cells.map((cell) => [cell.id, cell]));
	const seen = new Set<string>();
	const groups: string[][] = [];
	for (const { id } of space.cells) {
		if (!court.has(id) || seen.has(id)) continue;
		const group = [id];
		seen.add(id);
		for (let k = 0; k < group.length; k += 1)
			for (const { neighbour } of byId.get(group[k])?.sides ?? [])
				if (neighbour && court.has(neighbour) && !seen.has(neighbour)) {
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
		if (!cell || cell.role !== 'wing') continue;
		plan.set(
			id,
			cell.storeys > 1 ? { role: 'gate', storeys: cell.storeys } : { role: 'passage', storeys: 0 }
		);
	}
}

/** Fills a cell space with one house around a court (FORM-1). The deepest hop layer from the parcel
 * boundary is the court, void to the sky. Other cells are built when they touch the frontage or
 * their centre lies within `width` meters of it; the rest stay garden. Storeys are
 * round(height / storey height), clamped to the space; complexity lowers cells toward the rear,
 * steps court-facing cells down and lets seeded cells rise or fall one storey. The shortest path
 * from the frontage to each connected part of the court opens a ground-storey gate. Built cells grow monotonically with
 * width and every cell's storeys with height. Deterministic for equal inputs. */
export function createHouseCourt(space: CellSpace, inputs: HouseInputs): HouseCourt {
	const random = Random.create({ seed: inputs.seed });
	const { height, width, complexity } = resolveParams(blockInputs, {
		...(inputs.height === undefined ? {} : { height: inputs.height }),
		...(inputs.width === undefined ? {} : { width: inputs.width }),
		...(inputs.complexity === undefined ? {} : { complexity: inputs.complexity })
	});
	const segments = frontageSegments(space);
	if (!segments.length) throw new RangeError('A house needs at least one frontage side');
	const depth = boundaryDepth(space);
	const deepest = Math.max(...depth.values());
	const courtIds = new Set(
		space.cells.filter(({ id }) => deepest > 0 && depth.get(id) === deepest).map(({ id }) => id)
	);
	const distances = new Map(space.cells.map((cell) => [cell.id, frontageDistance(cell, segments)]));
	const farthest = Math.max(...distances.values());
	const top = Math.max(1, Math.min(space.storeyCount, Math.round(height / space.storeyHeightM)));
	const plan: Plan = new Map();
	for (const cell of space.cells) {
		const span = distances.get(cell.id) ?? 0;
		if (courtIds.has(cell.id)) plan.set(cell.id, { role: 'court', storeys: 0 });
		else if (!fronting(cell) && span > width) plan.set(cell.id, { role: 'garden', storeys: 0 });
		else {
			const faceCourt = cell.sides.some(
				({ neighbour }) => neighbour !== null && courtIds.has(neighbour)
			);
			const rear = farthest > 0 ? span / farthest : 0;
			plan.set(cell.id, {
				role: 'wing',
				storeys: cellStoreys(cell, top, rear, faceCourt, random, complexity)
			});
		}
	}
	const entrances = components(space, courtIds).map((court) => entrancePath(space, court));
	for (const path of entrances) carve(plan, path);
	return Object.freeze({
		spaceId: space.id,
		inputs: Object.freeze({ height, width, complexity, seed: random.seed }),
		storeys: top,
		entrances: Object.freeze(entrances.map((path) => Object.freeze(path))),
		cells: Object.freeze(
			space.cells.map(({ id }) => {
				const { role, storeys } = plan.get(id) ?? { role: 'garden', storeys: 0 };
				return Object.freeze({ id, role, fromStorey: role === 'gate' ? 1 : 0, toStorey: storeys });
			})
		)
	});
}
