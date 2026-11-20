import { cutPartyWall } from './party-wall-cut';
import type { HouseComposition } from '../house-typology';
import type { Vec3 } from '../parametrik/types';
import { houseObject, type HousePart } from './house-object';
import type { Surface } from './surfaces';

type Shell = NonNullable<HouseComposition['exterior']>;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
function stationAt(shell: Shell, height: number, corner: number, depth: number, tuck: number) {
	const upper = shell.stations.findIndex((s) => s.z >= height);
	const index = upper < 0 ? shell.stations.length - 1 : Math.max(1, upper);
	const lo = shell.stations[index - 1],
		hi = shell.stations[index];
	const t = clamp((height - lo.z) / (hi.z - lo.z));
	const at = (k: number) => {
		const base = shell.ring[corner][k];
		const atStation = (station: typeof lo) =>
			station.atBoundary
				? base + tuck * (shell.reveal[corner][k] - base)
				: base + depth * (station.ring[corner][k] - base);
		return (1 - t) * atStation(lo) + t * atStation(hi);
	};
	return [at(0), at(1)];
}
const broadSheets: ReadonlySet<Shell['system']> = new Set([
	'tensile-sail',
	'seed-pod',
	'ramp-fold',
	'lapped-sails',
	'branching-frame',
	'arch-ribs'
]);

// The clerestory climbs across the entire surveyed plan, meeting at the same height on both sides of a corner.
function ribbonHeight(shell: Shell, a: number[], b: number[]) {
	const along = (p: number[]) => p[0] + 0.5 * p[1];
	const bounds = shell.ring.map(along);
	const low = Math.min(...bounds),
		span = Math.max(...bounds) - low;
	const left = (along(a) - low) / span,
		right = (along(b) - low) / span;
	return (u: number, bayU: number, t: number) => {
		const ridge = 0.16 + 0.52 * ((1 - u) * left + u * right);
		const local = 0.16 + 0.52 * bayU;
		return t < local ? (ridge * t) / local : ridge + ((1 - ridge) * (t - local)) / (1 - local);
	};
}
type StockMesh = Extract<HousePart, { kind: 'mesh' }>;
function panel(shell: Shell, index: number, source: StockMesh, start: number, end: number) {
	const next = (index + 1) % shell.ring.length;
	const a = shell.ring[index],
		b = shell.ring[next];
	const ribbon = shell.system === 'ramp-fold' ? ribbonHeight(shell, a, b) : undefined;
	const length = Math.hypot(a[0] - b[0], a[1] - b[1]);
	const width = broadSheets.has(shell.system) ? Math.max(5, (shell.top - shell.bottom) * 0.65) : 5;
	const bays = Math.max(1, Math.round(((end - start) * length) / width));
	const points: Vec3[] = [],
		triangles: number[] = [];
	for (let i = 0; i < bays; i++) {
		const base = points.length;
		for (const [relief, y, z] of source.points) {
			const bayU = clamp(y / 3 + 0.5),
				u = start + ((end - start) * (i + bayU)) / bays,
				rise = clamp(z / 9);
			const t = ribbon?.(u, bayU, rise) ?? rise;
			const height = shell.bottom + t * (shell.top - shell.bottom);
			// Fold into the surveyed roof edge over the last part of the elevation.
			const fold = relief * Math.sin(Math.PI * bayU);
			const faceDepth = 0.62 + fold * 0.4;
			const depth = clamp(faceDepth + (1 - faceDepth) * clamp((t - 0.82) / 0.18));
			const tuck = clamp(0.45 + fold * 0.52) * Math.sin(Math.PI * t);
			const left = stationAt(shell, height, index, depth, tuck),
				right = stationAt(shell, height, next, depth, tuck);
			points.push([(1 - u) * left[0] + u * right[0], (1 - u) * left[1] + u * right[1], height]);
		}
		triangles.push(...source.triangles.map((j) => j + base));
	}
	return { points, triangles };
}
function exposedPanel(shell: Shell, index: number, source: StockMesh) {
	const points: Vec3[] = [],
		triangles: number[] = [];
	for (const { start, end, hidden } of shell.seams[index]) {
		if (hidden && hidden[0] <= shell.bottom && hidden[1] >= shell.top) continue;
		const span = panel(shell, index, source, start, end);
		const visible = hidden ? cutPartyWall(span, hidden) : span;
		const base = points.length;
		for (const p of visible.points) points.push(p);
		for (const i of visible.triangles) triangles.push(base + i);
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
	const source = {
		...stock,
		colourRole: 'ensemble-ground' as const,
		structuralRole: 'bearing' as const
	};
	return shell.ring.flatMap((_, i) => (shell.faces[i] ? [exposedPanel(shell, i, source)] : []));
}
