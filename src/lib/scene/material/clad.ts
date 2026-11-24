import { PlaceableObject, type Part } from '../../core/object';
import { buildSurface, type SurfaceLevel, type SurfaceMesh, type SurfaceOptions } from './build';
import type { Family, FamilySlot } from './families';
import type { Patch } from './patch';

/** One family laid on one patch under a role name, such as wall or roof, with an optional
 * level and a module scale that multiplies the shared one. */
export type Cladding = Readonly<{
	role: string;
	family: Family;
	patch: Patch;
	level?: SurfaceLevel;
	moduleScale?: number;
}>;

/** Object identity, footprint, anchors and any plain parts with their declared slots. */
export type CladInput = Omit<PlaceableObject, 'parts' | 'slots'> &
	Partial<Pick<PlaceableObject, 'parts' | 'slots'>>;

type PaintGroup = Readonly<{
	id: string;
	family: Family;
	level: SurfaceLevel;
	slots: ReadonlyMap<string, FamilySlot>;
	lines: readonly number[];
}>;

/** A placeable object with paint groups for compatible meshes and results for each input patch. */
export type CladObject = Readonly<{
	object: PlaceableObject;
	groups: readonly PaintGroup[];
	surfaces: readonly SurfaceMesh[];
	triangles: number;
}>;

type Merged = { positions: number[]; indices: number[] };
type Group = {
	id: string;
	family: Family;
	level: SurfaceLevel;
	meshes: Map<FamilySlot, Merged>;
	lines: number[];
};

// Exact arithmetic: positions are XYZ triples.
function merge(group: Group, surface: SurfaceMesh) {
	for (const [slot, { positions, indices }] of surface.meshes) {
		const target = group.meshes.get(slot) ?? { positions: [], indices: [] };
		group.meshes.set(slot, target);
		const offset = target.positions.length / 3;
		for (const value of positions) target.positions.push(value);
		for (const index of indices) target.indices.push(index + offset);
	}
	for (const value of surface.lines) group.lines.push(value);
}

function createGroup(surface: SurfaceMesh, role: string, count: number): Group {
	const id = count === 0 ? encodeURIComponent(role) : `${encodeURIComponent(role)}/${count}`;
	return { id, family: surface.family, level: surface.level, meshes: new Map(), lines: [] };
}

/** Builds claddings and merges parts that share a role, family, drawn level and family slot.
 * The first group of each role uses `role/slot` IDs and later groups add an ordinal. */
// Exact arithmetic: a module scale of one keeps the shared scale.
export function createClad(
	{ slots = [], parts = [], ...input }: CladInput,
	claddings: readonly Cladding[],
	options: SurfaceOptions = {}
): CladObject {
	const byRole = new Map<string, Group[]>();
	const groups: Group[] = [];
	const surfaces = claddings.map(({ role, family, patch, level, moduleScale = 1 }) => {
		const surface = buildSurface(family, patch, {
			...options,
			level: level ?? options.level,
			moduleScale: (options.moduleScale ?? 1) * moduleScale
		});
		if (!surface.meshes.size) return surface;
		const compatible = byRole.get(role) ?? [];
		let group = compatible.find(
			({ family, level }) => family === surface.family && level === surface.level
		);
		if (!group) {
			group = createGroup(surface, role, compatible.length);
			compatible.push(group);
			byRole.set(role, compatible);
			groups.push(group);
		}
		merge(group, surface);
		return surface;
	});
	const declared = new Set(slots);
	const cladParts: Part[] = [];
	const paintGroups = groups.map(({ id, family, level, meshes, lines }): PaintGroup => {
		const familySlots = new Map<string, FamilySlot>();
		for (const [familySlot, shape] of meshes) {
			const slot = `${id}/${familySlot}`;
			if (declared.has(slot)) throw new RangeError(`Duplicate clad slot "${slot}"`);
			declared.add(slot);
			familySlots.set(slot, familySlot);
			cladParts.push({ id: slot, slot, shape: { kind: 'mesh', ...shape } });
		}
		return { id, family, level, slots: familySlots, lines };
	});
	const object = PlaceableObject.create({
		...input,
		slots: [...cladParts.map(({ slot }) => slot), ...slots],
		parts: [...cladParts, ...parts]
	});
	const triangles = surfaces.reduce((total, { triangles }) => total + triangles, 0);
	return { object, groups: paintGroups, surfaces, triangles };
}
