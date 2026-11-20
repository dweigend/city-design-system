import { Vector3 } from 'three/webgpu';
import { BLICK } from '../../data/leitstil';
import { STORY } from '../../data/grid';
import { bounds, union } from '../../logic/ansicht/geometrie';
import { composedProjection, type World } from '../../logic/sandbox';
import type { Vec3 } from '../../logic/parametrik/types';

function courtGroups(world: World) {
	return (world.state.city?.centres ?? []).flatMap((centre) =>
		(centre.ensembles ?? []).flatMap((group) => {
			const court = world.grid.cellsById.get(group.court);
			const lots = group.lots.filter((id) => world.state.stacks.has(id));
			return court && lots.length ? [{ court, lots }] : [];
		})
	);
}
type Court = ReturnType<typeof courtGroups>[number];
function distance(a: Vec3, b: Vec3) {
	return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function neighbourhood(groups: Court[], count: number) {
	// Prefer the smallest occupied neighbourhood that supplies the requested number of courts.
	return groups
		.map((anchor) => {
			const sorted = groups
				.toSorted(
					(a, b) =>
						distance(a.court.center, anchor.court.center) -
						distance(b.court.center, anchor.court.center)
				)
				.slice(0, count);
			const diameter = Math.max(
				...sorted.flatMap((a) => sorted.map((b) => distance(a.court.center, b.court.center)))
			);
			return { sorted, diameter };
		})
		.reduce((a, b) => (a.diameter <= b.diameter ? a : b)).sorted;
}

function lotCorners(world: World, group: Court) {
	return [group.court.id, ...group.lots].flatMap((id) => {
		const cell = world.grid.cellsById.get(id);
		if (!cell) return [];
		const roof = cell.pad + (world.state.stacks.get(id)?.length ?? 0) * STORY;
		return cell.corners.flatMap(([x, y, z]) => [new Vector3(x, z, -y), new Vector3(x, roof, -y)]);
	});
}

function occupiedBounds(world: World, groups: Court[]) {
	const points = groups.map((group) => lotCorners(world, group));
	for (const house of composedProjection(world)) {
		if (house.span) continue;
		const belongs = groups.flatMap((group, i) =>
			house.cells.some((id) => group.lots.includes(id)) ? [i] : []
		);
		if (!belongs.length) continue;
		const parts = house.parts();
		if (!parts.length) continue;
		const { min, max } = union(parts.map(bounds));
		const corners = [min[0], max[0]].flatMap((x) =>
			[min[1], max[1]].flatMap((y) => [min[2], max[2]].map((z) => new Vector3(x, z, -y)))
		);
		for (const i of belongs) points[i].push(...corners);
	}
	return points;
}

/** Builds the occupied court and house envelopes for fitting and checking the neighbouring groups. */
export function courtOpening(world: World, portrait: boolean) {
	const groups = courtGroups(world);
	if (!groups.length) return;
	const selected = neighbourhood(groups, portrait ? 2 : 4);
	const envelopes = occupiedBounds(world, groups);
	const first = selected[0].court.center,
		last = selected[selected.length - 1].court.center;
	const heading =
		first === last ? BLICK.azimutRad : Math.atan2(last[1] - first[1], last[0] - first[0]);
	return {
		points: selected.flatMap((c) => envelopes[groups.indexOf(c)]),
		others: envelopes.filter((_, i) => !selected.includes(groups[i])),
		heading
	};
}
