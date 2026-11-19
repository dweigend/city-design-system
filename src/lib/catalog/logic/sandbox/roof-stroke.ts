import { carrierProbe } from './carrier-probe';
import { buildingPlots } from './building-plots';
import { roofWalls } from '../house-brush';
import { required } from '../required';
import { STORY } from '../../data/grid';
import { buildRoofFrame, MAX_FRAME_SPAN_M } from '../megastructure';
import type { QuadCell, QuadGrid } from '../quad-grid';
import type { Vec3 } from '../parametrik/types';
import {
	position,
	rejected,
	type Installation,
	type Anchor,
	type Proposal
} from './installation-parts';
import type { World } from './world';

function wallAnchor(cell: QuadCell, level: number, p: Vec3): Anchor {
	const distances = cell.corners.map(([x, y], i) => {
		const q = cell.corners[(i + 1) % 4];
		return Math.hypot((x + q[0]) / 2 - p[0], (y + q[1]) / 2 - p[1]);
	});
	return {
		cellId: cell.id,
		level,
		face: distances.indexOf(Math.min(...distances)),
		lift: p[2] - cell.pad - level * STORY
	};
}

function gap(components: string[][], centers: Map<string, Vec3>): Vec3[][] {
	return components.slice(1).map((group, i) => {
		const pairs = components
			.slice(0, i + 1)
			.flat()
			.flatMap((a) =>
				group.map((b) => [
					required(centers.get(a), 'roof center'),
					required(centers.get(b), 'roof center')
				])
			);
		const length = ([a, b]: Vec3[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
		return pairs.reduce((best, p) => (length(p) < length(best) ? p : best));
	});
}

/** Surveys each painted roof separately, retaining the K2 wall seats in the installation record. */
export function roofStroke(world: World, cells: QuadCell[]): Proposal {
	const grid = buildingPlots(world.grid);
	cells = cells.map((c) => required(grid.cellsById.get(c.id), 'building plot'));
	const levels = world.state.stacks;
	const roofs = cells.flatMap((c) => {
		const level = levels.get(c.id)?.length;
		return level
			? [
					{
						id: c.id,
						height: c.pad + level * STORY,
						polygon: c.corners.map(([x, y]): [number, number] => [x, y])
					}
				]
			: [];
	});
	if (
		[...world.state.parts.values()].some(
			(p) => p.recipe === 'chord' && roofs.some((r) => r.id === p.anchor.cellId)
		)
	)
		return rejected('occupied-roof', cells);
	let plan: ReturnType<typeof buildRoofFrame>;
	try {
		plan = buildRoofFrame(roofs, { clearance: 6 }, 'leitstil');
	} catch (error) {
		if (error instanceof RangeError) return rejected('invalid-roof', cells);
		throw error;
	}
	if (plan.status === 'span-disconnected') {
		const centers = new Map(
			cells.map((c) => [
				c.id,
				[c.center[0], c.center[1], c.pad + (levels.get(c.id)?.length ?? 0) * STORY] satisfies Vec3
			])
		);
		return { failure: { reason: plan.status, marks: gap(plan.components, centers) } };
	}
	if (plan.status === 'no-local-bay')
		return {
			failure: {
				reason: plan.status,
				marks: roofs
					.filter((r) => plan.roofIds.includes(r.id))
					.map((r) => r.polygon.map(([x, y]): Vec3 => [x, y, r.height]))
			}
		};
	if (plan.status !== 'assembled') return rejected(plan.status, cells);
	if (plan.frame.analysis.status !== 'ok') return rejected(plan.frame.analysis.status, cells);
	const walls = roofs.map((roof) => {
		const cell = required(grid.cellsById.get(roof.id), 'building plot');
		const level = required(levels.get(roof.id), 'roof stories').length;
		const wall = roofWalls(grid, levels, cell, world.seed);
		const feet = plan.frame.rods
			.filter(
				(r) => r.main && r.a.roofId === roof.id && r.a.p[0] === r.b.p[0] && r.a.p[1] === r.b.p[1]
			)
			.map((r) => ({ ...wallAnchor(cell, level, r.b.p), inset: wall.inset }))
			.filter((a) => wall.exposed[a.face ?? 0]);
		// Prefer one consistent frontage along the stroke; never seat a post on an internal seam.
		feet.sort((a, b) => (a.face ?? 0) - (b.face ?? 0));
		return { feet, sides: wall.exposed.flatMap((exposed, face) => (exposed ? [face] : [])) };
	});
	const seats = walls.flatMap((w) => w.feet.slice(0, roofs.length === 1 ? 2 : 1));
	if (seats.length < 2 || seats.length < roofs.length) return rejected('no-local-bay', cells);
	const crown = Math.max(...roofs.map((r) => r.height)) + 6;
	const layout = assembleSeats(grid, seats, crown);
	if ('failure' in layout) return layout;
	braceWalls(
		grid,
		seats,
		walls.map((w) => w.sides),
		layout.parts
	);
	return carrierProbe(grid, layout.parts, cells);
}

function braceWalls(
	grid: QuadGrid,
	seats: Anchor[],
	sidesByRoof: number[][],
	parts: Installation[]
) {
	// Restrain out-of-plane motion with ties back to other exposed wall faces.
	for (const [i, foot] of seats.entries()) {
		const sides = sidesByRoof[sidesByRoof.length === 1 ? 0 : i];
		const post = parts.find(
			(p) => p.kind === 'segment' && p.anchor === foot && p.recipe === 'chord'
		);
		if (post?.kind !== 'segment') continue;
		const toe = transverseSeat(grid, foot, seats[i === 0 ? 1 : i - 1], sides);
		if (!toe) continue;
		if (
			!parts.some(
				(p) =>
					p.recipe === 'bearing' && p.anchor.cellId === toe.cellId && p.anchor.face === toe.face
			)
		)
			parts.push({ kind: 'pillar', recipe: 'bearing', anchor: toe });
		parts.push({ kind: 'segment', recipe: 'brace', anchor: toe, end: post.end });
	}
}

// The most transverse available wall gives the tie its largest lever arm.
function transverseSeat(grid: QuadGrid, foot: Anchor, neighbor: Anchor, sides: number[]) {
	const [x, y] = position(grid, foot),
		[nx, ny] = position(grid, neighbor);
	const score = (anchor: Anchor) => {
		const [ax, ay] = position(grid, anchor);
		return Math.abs((nx - x) * (ay - y) - (ny - y) * (ax - x));
	};
	return sides
		.filter((face) => face !== foot.face)
		.map((face) => ({ ...foot, face }))
		.sort((a, b) => score(b) - score(a))[0];
}

function assembleSeats(grid: QuadGrid, seats: Anchor[], crown: number): Proposal {
	const parts: Installation[] = [];
	const top = (a: Anchor) => ({
		...a,
		lift: crown - required(grid.cellsById.get(a.cellId), 'plot').pad - a.level * STORY
	});
	for (const [i, foot] of seats.entries()) {
		parts.push(
			{ kind: 'pillar', recipe: 'bearing', anchor: foot },
			{ kind: 'segment', recipe: 'chord', anchor: foot, end: top(foot) }
		);
		if (i) {
			const prev = seats[i - 1];
			const a = position(grid, prev),
				b = position(grid, foot);
			if (Math.hypot(a[0] - b[0], a[1] - b[1]) > MAX_FRAME_SPAN_M)
				return { failure: { reason: 'span-disconnected', marks: [[a, b]] } };
			parts.push(
				{ kind: 'segment', recipe: 'chord', anchor: top(prev), end: top(foot) },
				{ kind: 'segment', recipe: 'brace', anchor: prev, end: top(foot) }
			);
		}
	}
	return { parts };
}
