import type { Vec2, Vec3 } from '../../core/geometry';
import { required } from '../../core/invariant';
import { bounds, PlaceableObject, type Footprint } from '../../core/object';
import {
	createCityTaper,
	type CityColumn,
	type CityLattice,
	type CityTaper,
	type DistrictKind
} from '../../domain/city-volume';
import { districtSurfaces, planningStudy, resolveSurfaces, type Drawable } from '../surface';
import { envelopeMeshes } from './envelope';
import { latticeMesh } from './lattice';
import { blockMeshes } from './blocks';
import { shadowBands, shadowMesh } from './shadow';

type Frame = Readonly<{ footprint: Footprint; toLocal: (x: number, y: number) => Vec2 }>;
/** Maps the camera framing to continuous detail and height presentation. */
export { cityElevation, cityProfile } from './profile';
/** Projects the terrain and the city plan in one frame. */
export { projectCityTerrain } from './terrain';
/** Styles terrain, envelope and lattice by focus as the camera moves. */
export { cityPresentation } from './presentation';

const slots = ['detached', 'block', 'center', 'shadow'] as const;

/** A drawable of the city volume with what the focus needs to style it: the district kind and
 * height of a body, its seeded pencil draw, and whether it is the body, its storey lines or one
 * of its two ground shades. */
export type CityDrawable = Drawable &
	Readonly<{
		kind: DistrictKind;
		levels: number;
		drawn: boolean;
		role: 'body' | 'storeys' | 'block' | 'block-storeys' | 'contact' | 'cast';
	}>;

/** Projects the city's outer roof and exposed walls, grouped by district kind, height and the
 * seeded pencil draw of stock, with their storey lines. Every envelope vertex carries its taper
 * offset. Each column also gets its simplest drawing, a plain box inset by a street, and each kind
 * two bands of ground shade under these boxes. An empty plan returns no drawables or focus. The
 * envelope follows the common level planes in true world meters. */
export function projectCityDistricts(
	columns: readonly CityColumn[],
	datumZ: number,
	frame: Frame,
	taper: CityTaper = createCityTaper(columns, datumZ),
	seed = 0
) {
	const patches = envelopeMeshes(columns, datumZ, frame.toLocal, taper, seed);
	const blocks = blockMeshes(columns, datumZ, frame.toLocal, seed);
	const shades = (['contact', 'cast'] as const).flatMap((role) =>
		slots.flatMap((kind) => {
			if (kind === 'shadow') return [];
			const footprints = [...blocks.values()]
				.filter((part) => part.kind === kind)
				.flatMap(({ footprints }) => footprints);
			if (!footprints.length) return [];
			const { shape, warp } = shadowMesh(footprints, shadowBands[role]);
			return [{ id: `${kind}/${role}`, kind, role, shape, warp }];
		})
	);
	const object = PlaceableObject.create({
		id: 'districts',
		slots,
		parts: [
			...slots.flatMap((slot) =>
				[...patches]
					.filter(([, patch]) => patch.kind === slot)
					.map(([id, { shape }]) => ({ id, slot, shape }))
			),
			...slots.flatMap((slot) =>
				[...blocks]
					.filter(([, part]) => part.kind === slot)
					.map(([id, { shape }]) => ({ id, slot, shape }))
			),
			...shades.map(({ id, shape }) => ({ id, slot: 'shadow', shape }))
		],
		footprint: frame.footprint,
		anchors: []
	});
	const parts = resolveSurfaces(object, districtSurfaces);
	const drawables: CityDrawable[] = parts.flatMap((part): CityDrawable[] => {
		const shade = shades.find(({ id }) => id === part.id);
		if (shade)
			return [
				{
					...part,
					kind: shade.kind,
					levels: 0,
					drawn: false,
					role: shade.role,
					warp: { fill: shade.warp, amount: 0 }
				}
			];
		const block = blocks.get(part.id);
		if (block) {
			const box: CityDrawable = {
				...part,
				kind: block.kind,
				levels: 0,
				drawn: block.drawn,
				role: 'block',
				strokeSegments: block.outline
			};
			return [
				box,
				{
					...box,
					id: `${part.id}/storeys`,
					role: 'block-storeys',
					shape: {
						kind: 'mesh',
						positions: block.shape.positions.slice(0, 9),
						indices: [0, 1, 2]
					},
					fillVisible: false,
					strokeSegments: block.storeys
				}
			];
		}
		const patch = required(patches.get(part.id), 'envelope patch');
		const { kind, levels, drawn, taper: offsets } = patch;
		const body: CityDrawable = {
			...part,
			kind,
			levels,
			drawn,
			role: 'body',
			strokeSegments: [...patch.outline.values()].flat(),
			warp: { fill: offsets.fill, stroke: offsets.outline, amount: 0 }
		};
		if (!patch.storeys.size) return [body];
		const { positions } = patch.shape;
		return [
			body,
			{
				...body,
				id: `${part.id}/storeys`,
				role: 'storeys',
				shape: { kind: 'mesh', positions: positions.slice(0, 9), indices: [0, 1, 2] },
				fillVisible: false,
				strokeSegments: [...patch.storeys.values()].flat(),
				warp: { fill: offsets.fill.slice(0, 6), stroke: offsets.storeys, amount: 0 }
			}
		];
	});
	const bodies = object.parts.filter(({ id }) => patches.has(id));
	function* points(): IterableIterator<Vec3> {
		for (const { shape } of bodies) {
			if (shape.kind !== 'mesh') continue;
			const { positions } = shape;
			for (let i = 0; i < positions.length; i += 3)
				yield [positions[i], positions[i + 1], positions[i + 2]];
		}
	}
	return {
		object,
		drawables,
		focus: bodies.length ? bounds({ ...object, parts: bodies }) : undefined,
		points
	};
}

/** Projects only the lattice's members and joints into the local terrain frame, members by rank,
 * with the taper offset of every joint and member end. */
export function projectCityLattice(
	lattice: CityLattice,
	frame: Frame,
	taper: CityTaper = () => [0, 0]
) {
	const { geometry, jointTaper, wires, offsets } = latticeMesh(lattice, frame.toLocal, taper);
	const object = PlaceableObject.create({
		id: 'lattice',
		slots: ['lattice'],
		parts: geometry.indices.length ? [{ id: 'lattice', slot: 'lattice', shape: geometry }] : [],
		footprint: frame.footprint,
		anchors: []
	});
	return {
		object,
		drawables: resolveSurfaces(object, planningStudy).flatMap((part): Drawable[] => {
			if (part.shape.kind !== 'mesh') throw new Error('Expected lattice joints');
			const shape = {
				kind: 'mesh' as const,
				positions: part.shape.positions.slice(0, 9),
				indices: [0, 1, 2]
			};
			const first = jointTaper.slice(0, 6);
			return [
				{
					...part,
					strokeSegments: wires.rims,
					warp: { fill: jointTaper, stroke: offsets.rims, amount: 0 }
				},
				{
					...part,
					id: 'uprights',
					shape,
					fillVisible: false,
					strokeSegments: wires.uprights,
					warp: { fill: first, stroke: offsets.uprights, amount: 0 }
				},
				{
					...part,
					id: 'detail',
					shape,
					fillVisible: false,
					strokeSegments: wires.detail,
					warp: { fill: first, stroke: offsets.detail, amount: 0 }
				}
			];
		})
	};
}
