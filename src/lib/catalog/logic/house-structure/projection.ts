import { skinPanels } from './skin-panels';
import { spiralSteps } from './spiral';
import { houseStair } from '../../data/house-stair';
import { skinFrame, type SkinFrame } from './graph';
import type { BuildingSurface, Vec3 } from '../parametrik/types';
import type { HouseStructure, Platform, SkinPatch, XY } from './contract';

/** Indexed triangles in world metres. */
export type SkinMesh = { points: Vec3[]; triangles: number[] };

/**
 * Tensions one cloth over its resolved grips. A solver owns the cloth physics; the contract
 * only fixes its input and output. The mesh keeps every boundary point.
 */
export type SkinSolver = (frame: SkinFrame, patch: SkinPatch) => SkinMesh;

/** One element of a house with its colour-agnostic role, ready for any renderer. */
export type StructurePart = {
	id: string;
	element: 'strut' | 'tie' | 'platform' | 'room' | 'skin' | 'access';
	/** Colour-agnostic role slot. A palette assigns the surface when the house is drawn. */
	surface: BuildingSurface;
} & (
	| { kind: 'rod'; from: Vec3; to: Vec3; radius: number }
	| { kind: 'plate'; polygon: XY[]; holes: XY[][]; z: number; height: number }
	| ({ kind: 'mesh' } & SkinMesh)
);

/** Section radius of an access run drawn as one line, metres. */
const ACCESS_RADIUS = 0.06;

/**
 * Straight cloth: a fan from the frame's peak to every boundary edge.
 * It stands in until a tension solver is passed; it has no sag, pressure or seams.
 */
function fanSkin(frame: SkinFrame): SkinMesh {
	if (frame.batten) {
		const points: Vec3[] = [],
			triangles: number[] = [];
		for (const { grips } of skinPanels(frame)) {
			const base = points.length;
			points.push(...grips);
			for (let i = 2; i < grips.length; i++) triangles.push(base, base + i - 1, base + i);
		}
		return { points, triangles };
	}
	const count = frame.boundary.length;
	return {
		points: [...frame.boundary, frame.peak],
		triangles: frame.boundary.flatMap((_, i) => [i, (i + 1) % count, count])
	};
}

function platformParts(s: HouseStructure, platform: Platform): StructurePart[] {
	const use = platform.programme[0] ?? s.use;
	const shape = { polygon: platform.outline, holes: platform.holes ?? [] };
	const founded = platform.datum - platform.thickness <= s.ground;
	const plate: StructurePart = {
		id: platform.id,
		element: 'platform',
		surface: { use, ensemble: s.ensemble, slot: founded ? 'base' : 'deck' },
		kind: 'plate',
		...shape,
		z: platform.datum - platform.thickness,
		height: platform.thickness
	};
	if (!platform.room) return [plate];
	const room: StructurePart = {
		id: platform.id + '/room',
		element: 'room',
		surface: { use, ensemble: s.ensemble, slot: 'shell' },
		kind: 'plate',
		...shape,
		z: platform.datum,
		height: platform.room.height
	};
	return [plate, room];
}

/**
 * Projects a checked house to renderer-neutral parts in a stable order: rods, platforms with
 * their rooms, skins, access. Struts take the `frame` slot, ties and access `fitting`, plates
 * `deck` or `base` on the ground, rooms `shell`, skins their own slot. No colour is assigned.
 * `solve` defaults to the straight fan. Throws on references `checkHouseStructure` reports.
 * The result is detached.
 */
export function structureParts(
	structure: HouseStructure,
	solve: SkinSolver = fanSkin
): StructurePart[] {
	const { ensemble, use } = structure;
	const position = new Map(structure.nodes.map((node) => [node.id, node.position]));
	const end = (id: string): Vec3 => {
		const p = position.get(id);
		if (!p) throw new Error('Unknown node ' + id);
		return [...p];
	};
	return [
		...structure.rods.map((rod): StructurePart => ({
			id: rod.id,
			element: rod.action,
			surface: { use, ensemble, slot: rod.action === 'strut' ? 'frame' : 'fitting' },
			kind: 'rod',
			from: end(rod.from),
			to: end(rod.to),
			radius: rod.radius
		})),
		...structure.platforms.flatMap((platform) => platformParts(structure, platform)),
		...structure.skins.map((skin): StructurePart => ({
			id: skin.id,
			element: 'skin',
			surface: { use: skin.use, ensemble, slot: skin.slot },
			kind: 'mesh',
			...solve(skinFrame(structure, skin.id), skin)
		})),
		...structureAccessParts(structure)
	];
}

/** Projects the declared runs to tread sectors or centreline rods, in ascending run order. */
export function structureAccessParts(structure: HouseStructure): StructurePart[] {
	const { ensemble, use } = structure;
	return structure.access.flatMap((way): StructurePart[] =>
		way.spiral
			? spiralSteps(way).map((step): StructurePart => {
					const common = {
						id: step.id,
						element: 'access' as const,
						surface: { use, ensemble, slot: 'fitting' as const }
					};
					if (step.kind === 'ramp') {
						const points = step.polygon.map(([x, y], i): Vec3 => [
							x,
							y,
							i < 2 ? step.from[2] : step.to[2]
						]);
						return { ...common, kind: 'mesh', points, triangles: [0, 1, 2, 0, 2, 3] };
					}
					return {
						...common,
						kind: 'plate',
						polygon: step.polygon,
						holes: [],
						z: step.to[2] - houseStair.thickness,
						height: houseStair.thickness
					};
				})
			: [
					{
						id: way.id,
						element: 'access',
						surface: { use, ensemble, slot: 'fitting' },
						kind: 'rod',
						from: [...way.foot],
						to: [...way.head],
						radius: ACCESS_RADIUS
					}
				]
	);
}
