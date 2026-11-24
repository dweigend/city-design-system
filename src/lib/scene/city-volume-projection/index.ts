/** Module: Projects city terrain, building stock and lattice members with focus policies. */
import type { Vec2, Vec3 } from '../../core/geometry';
import { required } from '../../core/invariant';
import { bounds, PlaceableObject, type Footprint } from '../../core/object';
import {
	columnRoof,
	createCityTaper,
	levelHeight,
	type CityColumn,
	type CityLattice,
	type CityTaper,
	type DistrictKind
} from '../../domain/city-volume';
import { districtSurfaces, planningStudy, resolveSurfaces, type Drawable } from '../surface';
import { envelopeMeshes } from './envelope';
import { latticeMesh } from './lattice';
import { blockMeshes } from './blocks';
import type { CityDrawable } from './drawable';
import { shadowBands, shadowMesh } from './shadow';

type Frame = Readonly<{ footprint: Footprint; toLocal: (x: number, y: number) => Vec2 }>;
/** Maps the camera framing to continuous detail and height presentation. */
export {
	cityCameraHeightPreset,
	cityElevation,
	cityProfile,
	type CityCameraHeightPreset
} from './profile';
/** Camera bearing and frame fill of the city picture. */
export {
	cityCameraBearingRad,
	cityCameraMinimumWidthM,
	cityFrameFillFlat,
	cityFrameFillPerRelief
} from './constants';
/** Projects the terrain and the city plan in one frame. */
export { projectCityTerrain } from './terrain';
/** Resolves the focus choices a city picture offers and the one in effect. */
export { cityFocus, type CityContent, type FocusChoice, type Subsystem } from './focus';
/** The city page vocabulary and display levels. */
export { cityFocusPreset } from './focus-policy';
/** Styles terrain, envelope and lattice by focus as the camera moves. */
export { cityPresentation } from './presentation';

/** Ordered district kinds of the default city projection. */
export const cityDistrictKinds = Object.freeze(['detached', 'block', 'center'] as const);

/** A drawable of the city volume with its focus metadata. */
export type { CityDrawable } from './drawable';

/** Projects the city's outer roof and exposed walls, grouped by district kind, height and the
 * seeded pencil draw of stock, with their storey lines. Every envelope vertex carries its taper
 * offset. Each column also gets its simplest drawing, a plain box inset by a street, and each kind
 * two bands of ground shade under these boxes. An empty plan returns no drawables or focus. The
 * envelope follows the common level planes in true world meters. The kinds select and order
 * the stock, using the city preset when omitted. */
export function projectCityDistricts(
	columns: readonly CityColumn[],
	datumZ: number,
	frame: Frame,
	taper?: CityTaper,
	seed = 0,
	kinds: readonly DistrictKind[] = cityDistrictKinds,
	levelHeightM = levelHeight
) {
	const selected = new Set(kinds);
	if (selected.size !== kinds.length) throw new RangeError('Duplicate district kind');
	const slots = [...kinds, 'shadow'] as const;
	const surfaces = {
		...Object.fromEntries(kinds.map((kind) => [kind, districtSurfaces[kind]])),
		shadow: districtSurfaces.shadow
	};
	const visibleColumns =
		kinds === cityDistrictKinds ? columns : columns.filter(({ kind }) => selected.has(kind));
	const patches = envelopeMeshes(
		columns,
		datumZ,
		frame.toLocal,
		taper ?? createCityTaper(columns, datumZ, levelHeightM),
		seed,
		kinds === cityDistrictKinds ? undefined : selected,
		levelHeightM
	);
	const blocks = blockMeshes(visibleColumns, datumZ, frame.toLocal, seed, levelHeightM);
	const cells = visibleColumns.map((column) => ({
		kind: column.kind,
		ring: column.corners.map(({ position: [x, y, z] }): Vec3 => [...frame.toLocal(x, y), z]),
		top: columnRoof(column, datumZ, levelHeightM)
	}));
	const shades = (['contact', 'cast'] as const).flatMap((role) =>
		[true, false].flatMap((boxShade) =>
			kinds.flatMap((kind) => {
				const footprints = boxShade
					? [...blocks.values()]
							.filter((part) => part.kind === kind)
							.flatMap(({ footprints }) => footprints)
					: cells.filter((cell) => cell.kind === kind);
				if (!footprints.length) return [];
				const { shape, warp } = shadowMesh(footprints, shadowBands[role]);
				const id = `${kind}/${boxShade ? 'block' : 'envelope'}/${role}`;
				return [{ id, kind, role, boxShade, shape, warp }];
			})
		)
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
	const parts = resolveSurfaces(object, surfaces);
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
					boxShade: shade.boxShade,
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
				strokeSegments: block.walls
			};
			return [
				box,
				strokeSibling(box, 'block-roof', block.roof),
				strokeSibling(box, 'block-storeys', block.storeys)
			];
		}
		const patch = required(patches.get(part.id), 'envelope patch');
		const { kind, levels, drawn, taper: offsets, wires } = patch;
		const body: CityDrawable = {
			...part,
			kind,
			levels,
			drawn,
			role: 'body',
			strokeSegments: [...wires.walls.values()].flat(),
			warp: { fill: offsets.fill, stroke: offsets.walls, amount: 0 }
		};
		const siblings = (['roof', 'storeys', 'joints'] as const)
			.filter((set) => wires[set].size)
			.map((set) =>
				strokeSibling(body, set, [...wires[set].values()].flat(), {
					fill: offsets.fill.slice(0, 6),
					stroke: offsets[set],
					amount: 0
				})
			);
		return [body, ...siblings];
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

/** A stroke-only drawable beside a body: the body's first triangle as an unseen fill, and its own
 * segments and stroke offsets. */
function strokeSibling(
	body: CityDrawable,
	role: CityDrawable['role'],
	strokeSegments: readonly number[],
	warp?: CityDrawable['warp']
): CityDrawable {
	const positions = body.shape.kind === 'mesh' ? body.shape.positions.slice(0, 9) : [];
	return {
		...body,
		id: `${body.id}/${role}`,
		role,
		shape: { kind: 'mesh', positions, indices: [0, 1, 2] },
		fillVisible: false,
		strokeSegments,
		...(warp ? { warp } : {})
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
