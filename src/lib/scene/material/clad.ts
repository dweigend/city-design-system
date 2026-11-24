import { PlaceableObject, type Part } from '../../core/object';
import { buildSurface, type SurfaceLevel, type SurfaceMesh, type SurfaceOptions } from './build';
import type { Family } from './families';
import type { Patch } from './patch';

/** One family laid on one patch under a role name, such as wall or plate-2, with an optional
 * level and a module scale that multiplies the shared one. */
export type Cladding = Readonly<{
	role: string;
	family: Family;
	patch: Patch;
	level?: SurfaceLevel;
	moduleScale?: number;
}>;

/** An object whose slots are `role/slot` pairs, plus plain parts in slot `stand`. Materials and
 * drawn levels are keyed by role; lines are the pencil joint lines of a role. */
export type CladObject = Readonly<{
	object: PlaceableObject;
	materials: Readonly<Record<string, Family>>;
	levels: Readonly<Record<string, SurfaceLevel>>;
	lines: Readonly<Record<string, readonly number[]>>;
	surfaces: readonly SurfaceMesh[];
	triangles: number;
}>;

type Merged = { positions: number[]; indices: number[] };

function merge(merged: Map<string, Merged>, role: string, surface: SurfaceMesh) {
	for (const [slot, { positions, indices }] of surface.meshes) {
		const target = merged.get(`${role}/${slot}`) ?? { positions: [], indices: [] };
		merged.set(`${role}/${slot}`, target);
		const offset = target.positions.length / 3;
		for (const value of positions) target.positions.push(value);
		for (const index of indices) target.indices.push(index + offset);
	}
}

/** Builds every cladding, merges meshes of the same role and slot into one part, and wraps
 * the result in the object contract. */
// Exact arithmetic: a module scale of one keeps the shared scale; the object has no footprint.
export function createClad(
	id: string,
	claddings: readonly Cladding[],
	options: SurfaceOptions,
	plain: readonly Part[] = []
): CladObject {
	const merged = new Map<string, Merged>();
	const materials: Record<string, Family> = {};
	const levels: Record<string, SurfaceLevel> = {};
	const lines: Record<string, number[]> = {};
	const surfaces: SurfaceMesh[] = [];
	for (const cladding of claddings) {
		const { role, family, patch, level, moduleScale = 1 } = cladding;
		const surface = buildSurface(family, patch, {
			...options,
			level: level ?? options.level,
			moduleScale: (options.moduleScale ?? 1) * moduleScale
		});
		surfaces.push(surface);
		materials[role] = family;
		levels[role] = surface.level;
		(lines[role] ??= []).push(...surface.lines);
		merge(merged, role, surface);
	}
	const parts: Part[] = [...merged].map(([slot, shape]) => ({
		id: slot,
		slot,
		shape: { kind: 'mesh', ...shape }
	}));
	const object = PlaceableObject.create({
		id,
		slots: [...merged.keys(), ...(plain.length ? ['stand'] : [])],
		parts: [...parts, ...plain],
		footprint: { width: 0, depth: 0 },
		anchors: []
	});
	const triangles = surfaces.reduce((total, { triangles }) => total + triangles, 0);
	return { object, materials, levels, lines, surfaces, triangles };
}
