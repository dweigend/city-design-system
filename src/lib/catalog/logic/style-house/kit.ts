import type { ObjectGeometry } from '../assets';
import type { Vec3 } from '../parametrik/types';

/** One shaped member of a style house: a primitive shape in metres plus the slot that dresses it. */
export type Shape = ObjectGeometry;
type Draft = Shape extends infer S ? (S extends Shape ? Omit<S, 'id' | 'role'> : never) : never;

/** Collects slot-named shapes in draw order and numbers them when the house is finished. */
export function createKit() {
	const drafts: Draft[] = [];
	const add = (draft: Draft) => void drafts.push(draft);
	return {
		/** Box from its minimum corner. */
		box: (slot: string, position: Vec3, size: Vec3, rotation = 0) =>
			add({ kind: 'box', slot, position, size, rotation }),
		/** Upright drum on its base centre. */
		drum: (slot: string, position: Vec3, radius: number, height: number) =>
			add({ kind: 'cylinder', slot, position, radius, height }),
		cone: (slot: string, position: Vec3, radius: number, height: number) =>
			add({ kind: 'cone', slot, position, radius, height }),
		/** Box whose top falls along local x to `low` × height. */
		wedge: (slot: string, position: Vec3, size: Vec3, low: number, rotation = 0) =>
			add({ kind: 'wedge', slot, position, size, low, rotation }),
		/** Wall slab with a round opening, extruded along local y from its base centre. */
		arch: (
			slot: string,
			position: Vec3,
			[width, length, rise]: Vec3,
			thickness: number,
			rotation = 0
		) => add({ kind: 'arch', slot, position, width, length, rise, thickness, rotation }),
		vault: (slot: string, position: Vec3, [width, length, rise]: Vec3, rotation = 0) =>
			add({ kind: 'vault', slot, position, width, length, rise, rotation }),
		/** Ring or disc whose axis lies along local x. */
		ring: (
			slot: string,
			position: Vec3,
			[radius, innerRadius, depth]: Vec3,
			rotation = 0,
			tilt = 0
		) => add({ kind: 'ring', slot, position, radius, innerRadius, depth, rotation, tilt }),
		torus: (slot: string, position: Vec3, radius: number, tube: number, axis: 'z' | 'x' = 'z') =>
			add({ kind: 'torus', slot, position, radius, tube, axis }),
		helix: (
			slot: string,
			position: Vec3,
			[radius, innerRadius, height]: Vec3,
			turns: number,
			thickness: number
		) => add({ kind: 'helix', slot, position, radius, innerRadius, height, turns, thickness }),
		ball: (slot: string, position: Vec3, radius: number, squash = 1) =>
			add({ kind: 'sphere', slot, position, radius, squash }),
		dome: (slot: string, position: Vec3, radius: number, height = radius) =>
			add({ kind: 'dome', slot, position, radius, height }),
		capsule: (slot: string, from: Vec3, to: Vec3, radius: number) =>
			add({ kind: 'capsule', slot, from, to, radius }),
		pipe: (slot: string, points: Vec3[], radius: number, sampled = false) =>
			add({ kind: 'pipe', slot, points, radius, sampled }),
		/** Rectangular bar grid from its minimum corner. */
		lattice: (slot: string, position: Vec3, size: Vec3, cells: Vec3, bar: number, braced = false) =>
			add({ kind: 'frame', slot, position, size, cells, bar, braced }),
		/** Bars along explicit world axes. */
		bars: (slot: string, members: [Vec3, Vec3][], bar: number) =>
			add({
				kind: 'frame',
				slot,
				members,
				position: [0, 0, 0],
				size: [0, 0, 0],
				cells: [1, 1, 1],
				bar
			}),
		membrane: (slot: string, corners: [Vec3, Vec3, Vec3, Vec3], sag: number) =>
			add({ kind: 'membrane', slot, corners, sag }),
		mesh: (slot: string, points: Vec3[], triangles: number[]) =>
			add({ kind: 'mesh', slot, points, triangles, lines: [], edges: false }),
		/** Detached shapes with stable ids `<prefix>/<draw index>`. */
		finish: (prefix: string): Shape[] =>
			drafts.map((draft, index) => ({ ...draft, id: `${prefix}/${index}`, role: 'neu' }) as Shape)
	};
}

export type Kit = ReturnType<typeof createKit>;
