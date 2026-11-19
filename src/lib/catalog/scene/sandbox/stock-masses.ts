import type { Primitive } from '../../logic/parametrik/types';
import { convexHull } from '../../logic/parzelle';

type Plate = Extract<Primitive, { kind: 'prism' }>;
type Parcel = { plate: Plate; x: number; y: number };

function partition(parcels: Parcel[], count: number): Parcel[][] {
	if (count === 1 || parcels.length <= 1) return [parcels];
	const xs = parcels.map((p) => p.x);
	const ys = parcels.map((p) => p.y);
	const axis = Math.max(...xs) - Math.min(...xs) >= Math.max(...ys) - Math.min(...ys) ? 'x' : 'y';
	parcels.sort((a, b) => a[axis] - b[axis] || a.plate.id.localeCompare(b.plate.id));
	const half = Math.floor(count / 2);
	const cut = Math.max(1, Math.round((parcels.length * half) / count));
	return [
		...partition(parcels.slice(0, cut), half),
		...partition(parcels.slice(cut), count - half)
	];
}

/** Clusters surveyed stock footprints into six paper terraces. Loose details never seed a mass. */
export function stockMasses(parts: Iterable<Primitive>): Primitive[] {
	const parcels: Parcel[] = [];
	for (const p of parts) {
		if (p.role !== 'bestand' || p.kind !== 'prism' || p.detail || !p.polygon.length) continue;
		const [x, y] = p.polygon.reduce(([x, y], q) => [x + q[0], y + q[1]], [0, 0]);
		parcels.push({ plate: p, x: x / p.polygon.length, y: y / p.polygon.length });
	}
	return partition(parcels, 6)
		.filter((group) => group.length)
		.map((group, index) => {
			const hull = convexHull(group.flatMap(({ plate }) => plate.polygon));
			const x = group.reduce((sum, p) => sum + p.x, 0) / group.length;
			const y = group.reduce((sum, p) => sum + p.y, 0) / group.length;
			const z = Math.min(...group.map(({ plate }) => plate.z));
			const tops = group.map(({ plate }) => plate.z + plate.height).sort((a, b) => a - b);
			return {
				kind: 'prism',
				role: 'bestand',
				material: 'paper',
				// The shared depth edge supplies the single 42% silhouette at town scale.
				edges: false,
				token: '--paper',
				id: 'stock-mass:' + index,
				z,
				height: tops[Math.floor(tops.length / 2)] - z,
				polygon: hull.map(([a, b]) => [x + (a - x) * 0.93, y + (b - y) * 0.93])
			};
		});
}
