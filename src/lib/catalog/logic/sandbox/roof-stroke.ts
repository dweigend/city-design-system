import { required } from '../required';
import { STORY } from '../../data/grid';
import { buildRoofFrame } from '../megastructure';
import type { QuadCell } from '../quad-grid';
import type { Vec3 } from '../parametrik/types';
import { rejected, type Anchor, type Proposal } from './installation-parts';
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
	const plan = buildRoofFrame(roofs, { clearance: 4 }, 'leitstil');
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
	const anchor = (joint: { roofId: string; p: Vec3 }) =>
		wallAnchor(
			required(world.grid.cellsById.get(joint.roofId), 'surveyed cell'),
			required(levels.get(joint.roofId), 'roof stories').length,
			joint.p
		);
	return {
		parts: plan.frame.rods.map((r) => ({
			kind: 'segment',
			recipe: r.main ? 'chord' : 'brace',
			anchor: anchor(r.a),
			end: anchor(r.b)
		}))
	};
}
