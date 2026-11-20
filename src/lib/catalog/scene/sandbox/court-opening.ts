import { Vector3 } from 'three/webgpu';
import { BLICK } from '../../data/leitstil';
import { STORY } from '../../data/grid';
import { bounds, union } from '../../logic/ansicht/geometrie';
import { composedProjection, type World } from '../../logic/sandbox';

function houseCorners(world: World, lots: Set<string>) {
	const points: Vector3[] = [];
	for (const house of composedProjection(world)) {
		if (house.span || !house.cells.some((id) => lots.has(id))) continue;
		const parts = house.parts();
		if (!parts.length) continue;
		const { min, max } = union(parts.map(bounds));
		for (const x of [min[0], max[0]])
			for (const y of [min[1], max[1]])
				for (const z of [min[2], max[2]]) points.push(new Vector3(x, z, -y));
	}
	return points;
}

/** Frames occupied lots around neighbouring courts. Empty expansion land adds no camera extent. */
export function courtOpening(world: World, portrait: boolean) {
	const { grid, state } = world;
	const districts = state.city?.centres
		.map((centre) =>
			(centre.ensembles ?? []).flatMap((group) => {
				const court = grid.cellsById.get(group.court);
				const lots = group.lots.filter((id) => state.stacks.has(id));
				return court && lots.length ? [{ court, lots }] : [];
			})
		)
		.filter((d) => d.length);
	if (!districts?.length) return;
	const count = (district: (typeof districts)[number]) =>
		district.reduce((sum, g) => sum + g.lots.length, 0);
	const district = districts.reduce((a, b) => (count(a) >= count(b) ? a : b));
	const courts = portrait
		? [district.reduce((a, b) => (a.lots.length >= b.lots.length ? a : b))]
		: district;
	const points = courts.flatMap(({ court, lots }) =>
		[court.id, ...lots].flatMap((id) => {
			const cell = grid.cellsById.get(id);
			if (!cell) return [];
			const roof = cell.pad + (state.stacks.get(id)?.length ?? 0) * STORY;
			return cell.corners.flatMap(([x, y, z]) => [new Vector3(x, z, -y), new Vector3(x, roof, -y)]);
		})
	);
	points.push(...houseCorners(world, new Set(courts.flatMap((c) => c.lots))));
	const first = courts[0].court.center;
	const last = courts[courts.length - 1].court.center;
	let heading = BLICK.azimutRad;
	if (first !== last) {
		heading = Math.atan2(last[1] - first[1], last[0] - first[0]);
		if (Math.cos(heading - BLICK.azimutRad) < 0) heading += Math.PI;
	}
	return { points, heading };
}
