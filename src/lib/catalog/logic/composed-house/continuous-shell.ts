import type { HouseComposition } from '../house-typology';
import type { Vec3 } from '../parametrik/types';
import { houseObject, type HousePart } from './house-object';
import type { Surface } from './surfaces';

type Shell = NonNullable<HouseComposition['exterior']>;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
function panel(shell: Shell, index: number, source: Extract<HousePart, { kind: 'mesh' }>) {
	const next = (index + 1) % shell.ring.length;
	const a = shell.ring[index],
		b = shell.ring[next],
		c = shell.inner[index],
		d = shell.inner[next];
	const length = Math.hypot(a[0] - b[0], a[1] - b[1]);
	const bays = Math.max(1, Math.round(length / 5));
	const points: Vec3[] = [],
		triangles: number[] = [];
	for (let i = 0; i < bays; i++) {
		const base = points.length;
		for (const [relief, y, z] of source.points) {
			const u = (i + clamp(y / 3 + 0.5)) / bays,
				t = clamp(z / 9);
			const iProfile = Math.min(
				shell.profile.length - 2,
				Math.floor(t * (shell.profile.length - 1))
			);
			const uProfile = t * (shell.profile.length - 1) - iProfile;
			const depth = clamp(
				(shell.profile[iProfile] * (1 - uProfile) + shell.profile[iProfile + 1] * uProfile) * 0.45 +
					relief * 0.13 * Math.sin(Math.PI * clamp(y / 3 + 0.5))
			);
			const at = (k: number) =>
				(1 - u) * (a[k] + depth * (c[k] - a[k])) + u * (b[k] + depth * (d[k] - b[k]));
			points.push([at(0), at(1), shell.bottom + t * (shell.top - shell.bottom)]);
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
