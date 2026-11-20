import type { HouseComposition } from '../house-typology';
import type { Vec3 } from '../parametrik/types';
import { houseObject, type HousePart } from './house-object';
import type { Surface } from './surfaces';

type Shell = NonNullable<HouseComposition['exterior']>;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
function stationAt(shell: Shell, height: number, corner: number, depth: number) {
	const upper = shell.stations.findIndex((s) => s.z >= height);
	const index = upper < 0 ? shell.stations.length - 1 : Math.max(1, upper);
	const lo = shell.stations[index - 1],
		hi = shell.stations[index];
	const t = clamp((height - lo.z) / (hi.z - lo.z));
	const at = (k: number) => {
		const inner = (1 - t) * lo.ring[corner][k] + t * hi.ring[corner][k];
		return shell.ring[corner][k] + depth * (inner - shell.ring[corner][k]);
	};
	return [at(0), at(1)];
}
function panel(shell: Shell, index: number, source: Extract<HousePart, { kind: 'mesh' }>) {
	const next = (index + 1) % shell.ring.length;
	const a = shell.ring[index],
		b = shell.ring[next];
	const length = Math.hypot(a[0] - b[0], a[1] - b[1]);
	const bays = Math.max(1, Math.round(length / 5));
	const points: Vec3[] = [],
		triangles: number[] = [];
	for (let i = 0; i < bays; i++) {
		const base = points.length;
		for (const [relief, y, z] of source.points) {
			const u = (i + clamp(y / 3 + 0.5)) / bays,
				t = clamp(z / 9);
			const height = shell.bottom + t * (shell.top - shell.bottom);
			const depth = clamp(0.52 + relief * 0.26 * Math.sin(Math.PI * clamp(y / 3 + 0.5)));
			const left = stationAt(shell, height, index, depth),
				right = stationAt(shell, height, next, depth);
			points.push([(1 - u) * left[0] + u * right[0], (1 - u) * left[1] + u * right[1], height]);
		}
		triangles.push(...source.triangles.map((j) => j + base));
	}
	return { ...source, id: source.id + '/' + index, points, triangles };
}
/** Maps a full-height fabric, frame or service run between corresponding surveyed wall corners. */
export function continuousShell(h: HouseComposition, seed: number, surface: Surface): HousePart[] {
	const shell = h.exterior;
	if (!shell) return [];
	const stock = houseObject('full-height-shell', shell.system, seed, {
		instanceId: h.id + '/exterior',
		slots: { body: { ...surface, finish: shell.finish } }
	}).parts[0];
	if (stock.kind !== 'mesh') throw Error('Expected a continuous shell mesh');
	const source = { ...stock, structuralRole: 'bearing' as const };
	return shell.ring.flatMap((_, i) => (shell.faces[i] ? [panel(shell, i, source)] : []));
}
