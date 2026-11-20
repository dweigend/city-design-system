import type { Vec3 } from '../parametrik/types';
import type { Membrane } from './cloth';
import { deadLoadPerArea, hemTensionFactor, balanceNet } from './force-density';
import { patchGrid, type PatchGrips } from './patch-grid';

type Fabric = Pick<Membrane, 'pressure' | 'tension'>;
type Patch = { positions: Vec3[]; faces: number[]; edges: number[][] };
type Yarn = { a: number; b: number; area: number; faces: number };

function faceLoad(a: Vec3, b: Vec3, c: Vec3, pressure: number) {
	const ux = b[0] - a[0],
		uy = b[1] - a[1],
		uz = b[2] - a[2];
	const vx = c[0] - a[0],
		vy = c[1] - a[1],
		vz = c[2] - a[2];
	const nx = uy * vz - uz * vy,
		ny = uz * vx - ux * vz,
		nz = ux * vy - uy * vx;
	const area = Math.hypot(nx, ny, nz) / 2;
	const areaTolerance = Number.EPSILON * Math.hypot(ux, uy, uz) * Math.hypot(vx, vy, vz);
	if (!Number.isFinite(area) || area <= areaTolerance)
		throw RangeError('A fabric patch requires finite non-degenerate rest faces');
	// Each of the three nodes receives a third of the reference triangle's distributed load.
	const load: Vec3 = [
		(nx * pressure) / 6,
		(ny * pressure) / 6,
		(nz * pressure) / 6 - (area * deadLoadPerArea) / 3
	];
	return { area, load };
}

function collectYarn(yarns: Map<number, Yarn>, i: number, j: number, count: number, area: number) {
	const a = Math.min(i, j),
		b = Math.max(i, j);
	const key = a * count + b;
	const yarn = yarns.get(key);
	if (yarn) {
		yarn.area += area;
		yarn.faces++;
	} else yarns.set(key, { a, b, area, faces: 1 });
}

function loadedYarns(patch: Patch, pressure: number) {
	const { positions, faces } = patch;
	const loads = positions.map((): Vec3 => [0, 0, 0]);
	const yarns = new Map<number, Yarn>();
	for (let i = 0; i < faces.length; i += 3) {
		const nodes = faces.slice(i, i + 3);
		const { area, load } = faceLoad(
			positions[nodes[0]],
			positions[nodes[1]],
			positions[nodes[2]],
			pressure
		);
		for (const [corner, node] of nodes.entries()) {
			for (let axis = 0; axis < 3; axis++) loads[node][axis] += load[axis];
			collectYarn(yarns, node, nodes[(corner + 1) % 3], positions.length, area);
		}
	}
	return { loads, yarns };
}

function yarnLinks(positions: Vec3[], yarns: Map<number, Yarn>, tension: number, hemRatio: number) {
	const links = positions.map((): number[][] => []);
	for (const { a, b, area, faces } of yarns.values()) {
		const p = positions[a],
			q = positions[b];
		const lengthSquared = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
		// Tributary width/span converts the specified sheet tension to a positive yarn force density.
		const density = ((tension * area) / lengthSquared) * (faces === 1 ? hemRatio : 1);
		links[a].push([b, density]);
		links[b].push([a, density]);
	}
	return links;
}

/**
 * Finds a fabric patch between three or four cyclic grips in world metres (Z up).
 * Non-negative pressure in kPa acts along the right-hand normals of the reference faces. Positive yarn tension is in kN/m.
 * The optional hem ratio sets the edge cable force density relative to the field.
 * `held[i]` keeps the edge from grip i to the next one straight, as a seam on a rod or a neighbour; other edges hang free between their grips.
 * Returns a detached indexed triangle mesh with ordered hem paths, including both end grips.
 * Invalid loads, degenerate rest faces and singular systems throw RangeError. Inputs are preserved.
 */
export function tensionPatch(
	grips: PatchGrips,
	fabric: Fabric,
	hemRatio = hemTensionFactor,
	held: readonly boolean[] = []
): Patch {
	if (
		!Number.isFinite(fabric.tension) ||
		fabric.tension <= 0 ||
		!Number.isFinite(fabric.pressure) ||
		fabric.pressure < 0
	)
		throw RangeError('Invalid fabric tension or pressure');
	if (!Number.isFinite(hemRatio) || hemRatio <= 0) throw RangeError('Invalid hem tension ratio');
	const patch = patchGrid(grips);
	for (const [i, edge] of patch.edges.entries())
		if (held[i]) for (const node of edge) patch.pinned[node] = true;
	const { loads, yarns } = loadedYarns(patch, fabric.pressure);
	balanceNet(
		patch.positions,
		patch.pinned,
		yarnLinks(patch.positions, yarns, fabric.tension, hemRatio),
		loads
	);
	return { positions: patch.positions, faces: patch.faces, edges: patch.edges };
}
