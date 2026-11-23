import { laneSettings as settings } from '../../../config/lanes';
import type { Vec2 } from '../../core/geometry';
import { required } from '../../core/invariant';
import type { LaneInput } from '../../domain/parcels';
import type { DryPlanEdge, PlanEdge, TerrainGrid } from '../../domain/terrain-grid';
import type { MainLanePath } from './main-lanes';
import type { CityTerrainSampler } from './sampling';

/** Measures maximum longitudinal grade on the edge in fixed, equal horizontal intervals. */
export function laneGrades(grid: TerrainGrid, sample: CityTerrainSampler) {
	const nodes = new Map(grid.vertices.map(({ id, position }) => [id, position]));
	const grades = new Map<string, number>();
	return ({ id, nodeIds: [from, to], lengthM }: PlanEdge) => {
		const cached = grades.get(id);
		if (cached !== undefined) return cached;
		const [ax, ay, az] = required(nodes.get(from), 'lane start');
		const [bx, by, bz] = required(nodes.get(to), 'lane end');
		const steps = Math.ceil(lengthM / settings.gradeProbeStepM);
		let previous = az;
		let grade = 0;
		for (let i = 1; i <= steps; i++) {
			const t = i / steps;
			const height = i === steps ? bz : sample(ax + (bx - ax) * t, ay + (by - ay) * t).height;
			grade = Math.max(grade, Math.abs(height - previous) / (lengthM / steps));
			previous = height;
		}
		grades.set(id, grade);
		return grade;
	};
}

export function laneReservations(
	edges: readonly DryPlanEdge[],
	mainLanes: readonly MainLanePath[],
	headIds: ReadonlySet<string>,
	grade: (edge: PlanEdge) => number,
	promenadeDetours: ReadonlySet<string>
): LaneInput[] {
	const mainIds = new Set(mainLanes.flatMap(({ edges }) => edges.map(({ id }) => id)));
	return edges.map((edge): LaneInput => {
		const main = mainIds.has(edge.id);
		const promenade = edge.bank || promenadeDetours.has(edge.id);
		const stairs = grade(edge) > settings.stairGradeRatio;
		const hierarchy = [...(promenade ? ['promenade'] : []), ...(main ? ['main'] : [])];
		return {
			edge,
			hierarchy: hierarchy.length ? hierarchy : ['local'],
			widthM: promenade
				? settings.promenadeWidthM
				: main
					? settings.mainWidthM
					: stairs
						? settings.localStairWidthM
						: settings.localWidthM,
			surface: stairs ? 'stairs' : 'walk',
			oneSided: edge.bank,
			protectedFromMerge: hierarchy.length > 0 || edge.nodeIds.some((id) => headIds.has(id))
		};
	});
}

export function frontageDistance(point: Vec2, [a, b]: readonly [Vec2, Vec2]) {
	const dx = b[0] - a[0];
	const dy = b[1] - a[1];
	const t = Math.max(
		0,
		Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy))
	);
	return Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dy);
}
