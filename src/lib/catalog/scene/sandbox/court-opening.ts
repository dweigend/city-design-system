import { Vector3 } from 'three/webgpu';
import { BLICK } from '../../data/leitstil';
import { STORY } from '../../data/grid';
import type { Vec3 } from '../../logic/parametrik/types';
import type { World } from '../../logic/sandbox';

/** Frames occupied lots around neighbouring courts. Empty expansion land adds no camera extent. */
export function courtOpening(world: World, portrait: boolean, landmark?: Vec3) {
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
	const distance = (p: Vec3) => (landmark ? Math.hypot(p[0] - landmark[0], p[1] - landmark[1]) : 0);
	const rank = (d: (typeof districts)[number]) =>
		landmark
			? Math.min(...d.map((g) => distance(g.court.center)))
			: -d.reduce((n, g) => n + g.lots.length, 0);
	const district = districts.reduce((a, b) => (rank(a) <= rank(b) ? a : b));
	const courts = portrait
		? [district.reduce((a, b) => (distance(a.court.center) <= distance(b.court.center) ? a : b))]
		: district;
	const points = courts.flatMap(({ court, lots }) =>
		[court.id, ...lots].flatMap((id) => {
			const cell = grid.cellsById.get(id);
			if (!cell) return [];
			const roof = cell.pad + (state.stacks.get(id)?.length ?? 0) * STORY;
			return cell.corners.flatMap(([x, y, z]) => [new Vector3(x, z, -y), new Vector3(x, roof, -y)]);
		})
	);
	const first = courts[0].court.center;
	const last = courts[courts.length - 1].court.center;
	let heading = BLICK.azimutRad;
	if (first !== last) {
		heading = Math.atan2(last[1] - first[1], last[0] - first[0]);
		if (Math.cos(heading - BLICK.azimutRad) < 0) heading += Math.PI;
	}
	return { points, heading };
}
