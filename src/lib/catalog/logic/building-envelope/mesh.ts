import type { Manifold, Vec3 } from 'manifold-3d';
import type { EnvelopeMesh } from './contract';
import type { Solids } from './solids';
import { epsilon, localResolution } from './precision';

// Local metres. One Float32 spacing at the largest coordinate is a lower bound on resolution.
function extractionTolerance(body: Manifold) {
	const bounds = body.boundingBox();
	const extent = Math.max(...[...bounds.min, ...bounds.max].map(Math.abs));
	return localResolution(extent);
}
function triangleArea(p: Float32Array, a: number, b: number, c: number) {
	const ux = p[3 * b] - p[3 * a],
		uy = p[3 * b + 1] - p[3 * a + 1],
		uz = p[3 * b + 2] - p[3 * a + 2];
	const vx = p[3 * c] - p[3 * a],
		vy = p[3 * c + 1] - p[3 * a + 1],
		vz = p[3 * c + 2] - p[3 * a + 2];
	return Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
}
function validateShell(p: Float32Array, indices: Uint32Array) {
	if (!p.every(Number.isFinite)) throw new RangeError('Non-finite envelope vertex');
	const vertices = new Set<string>();
	for (let i = 0; i < p.length; i += 3) vertices.add(p.subarray(i, i + 3).join(','));
	if (vertices.size !== p.length / 3)
		throw new RangeError('Coincident vertices within envelope shell');
	const edges = new Map<string, { count: number; balance: number }>();
	for (let i = 0; i < indices.length; i += 3) {
		const [a, b, c] = indices.subarray(i, i + 3);
		if (triangleArea(p, a, b, c) <= epsilon ** 2)
			throw new RangeError('Degenerate envelope triangle');
		for (const [from, to] of [
			[a, b],
			[b, c],
			[c, a]
		]) {
			const key = Math.min(from, to) + ',' + Math.max(from, to);
			const edge = edges.get(key) ?? { count: 0, balance: 0 };
			edge.count++;
			edge.balance += Math.sign(to - from);
			edges.set(key, edge);
		}
	}
	if ([...edges.values()].some((e) => e.count !== 2 || e.balance !== 0))
		throw new RangeError('Open envelope shell');
}
/** Serializes separately owned shell ranges. Edge and point contacts retain independent vertices. */
export function extractEnvelope(s: Solids, body: Manifold, origin: Vec3): EnvelopeMesh {
	if (body.status() !== 'NoError')
		throw new RangeError('Building envelope failed: ' + body.status());
	const positions: number[] = [],
		indices: number[] = [],
		shellIndexEnds: number[] = [];
	for (const part of body.decompose().map(s.keep)) {
		const solid = s.keep(s.keep(part.asOriginal()).simplify(extractionTolerance(part)));
		const mesh = solid.getMesh();
		if (!mesh.triVerts.length)
			throw new RangeError('Shell collapsed at local extraction precision');
		validateShell(mesh.vertProperties, mesh.triVerts);
		const offset = positions.length / 3;
		for (const value of mesh.vertProperties) positions.push(value);
		for (const id of mesh.triVerts) indices.push(id + offset);
		shellIndexEnds.push(indices.length);
	}
	return {
		origin,
		positions: Float32Array.from(positions),
		indices: Uint32Array.from(indices),
		shellIndexEnds
	};
}
