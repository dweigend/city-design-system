import { defaults } from '../../../config/paths-projection';
import type { Vec3 } from '../../core/geometry';
import { required } from '../../core/invariant';
import {
	createMeshObject,
	createSweptTube,
	mesh,
	type Mesh,
	type MeshShape
} from '../../core/mesh';
import type { PlaceableObject } from '../../core/object';
import { resolveSurfaces, type Drawable, type MaterialDisplay, type Surface } from '../surface';

/** Optional endpoint roll directions and connection indices in the supplied local XYZ run. */
export type TubeAttachments = Readonly<{
	startTransverse?: Vec3;
	endTransverse?: Vec3;
	jointIndices?: readonly number[];
}>;

/** Functional palette roles available to a building service pipe. */
export type ServicePipeFlow = 'water' | 'energy' | 'material';

/** Frozen slot geometry and a fresh list of scene surfaces in part order. */
export type TubeProjection = Readonly<{ object: PlaceableObject; drawables: Drawable[] }>;

const serviceColors = {
	water: '--cat-health',
	energy: '--cat-mobility',
	material: '--cat-living'
} as const satisfies Record<ServicePipeFlow, Surface['color']>;

const pathSurface: Surface = {
	color: '--path',
	finish: 'matte',
	opacity: '--alpha-solid',
	preserveColor: true
};

const glazingSurface: Surface = {
	color: '--line',
	finish: 'glass',
	opacity: '--alpha-glass',
	preserveColor: true
};

function sweep(
	centerline: readonly Vec3[],
	{ startTransverse, endTransverse, jointIndices }: TubeAttachments,
	radiusM: number,
	widthM: number,
	ribSpacingM?: number
) {
	const depthM = radiusM * defaults.projectedTubeCollarDepthRatio;
	return createSweptTube(centerline, {
		radius: radiusM,
		radialSegments: defaults.projectedTubeRadialSegments,
		startTransverse,
		endTransverse,
		collars: {
			innerRadius: radiusM - depthM,
			outerRadius: radiusM + depthM,
			width: widthM,
			jointIndices,
			ribSpacing: ribSpacingM
		}
	});
}

function asLayer(shape: MeshShape): Mesh {
	const layer = mesh();
	layer.append(shape);
	return layer;
}

function horizontalDirection(from: Vec3, to: Vec3): readonly [number, number] {
	const dx = to[0] - from[0];
	const dy = to[1] - from[1];
	const span = Math.hypot(dx, dy);
	if (span === 0) throw new RangeError('Walkable tube requires horizontal run on every span');
	return [dx / span, dy / span];
}

function stationRight(centerline: readonly Vec3[], index: number): readonly [number, number] {
	const last = centerline.length - 1;
	const [fx, fy] =
		index === 0
			? horizontalDirection(centerline[0], centerline[1])
			: index === last
				? horizontalDirection(centerline[last - 1], centerline[last])
				: (() => {
						const [ax, ay] = horizontalDirection(centerline[index - 1], centerline[index]);
						const [bx, by] = horizontalDirection(centerline[index], centerline[index + 1]);
						const sx = ax + bx;
						const sy = ay + by;
						const mag = Math.hypot(sx, sy);
						if (mag === 0) throw new RangeError('Walkable tube cannot reverse horizontally');
						return [sx / mag, sy / mag] as const;
					})();
	return [fy, -fx];
}

function drawTubeDeck(centerline: readonly Vec3[]): Mesh {
	const halfWidth =
		defaults.walkableTubeDeckWidthM / /* Exact arithmetic: half the deck width. */ 2;
	const topDrop = defaults.walkableTubeDeckDropM;
	const bottomDrop = topDrop + defaults.walkableTubeDeckThicknessM;
	const positions: number[] = [];
	const indices: number[] = [];
	const sections = centerline.map((point, index) => {
		const [rx, ry] = stationRight(centerline, index);
		const [x, y, z] = point;
		const base = positions.length / /* Exact arithmetic: three coordinates per vertex. */ 3;
		positions.push(
			x - rx * halfWidth,
			y - ry * halfWidth,
			z - topDrop,
			x + rx * halfWidth,
			y + ry * halfWidth,
			z - topDrop,
			x + rx * halfWidth,
			y + ry * halfWidth,
			z - bottomDrop,
			x - rx * halfWidth,
			y - ry * halfWidth,
			z - bottomDrop
		);
		return base;
	});
	const sides = /* Exact arithmetic: four cross-section corners around the deck slab. */ 4;
	const [c1, c2, c3] = /* Exact arithmetic: quad corner index offsets. */ [1, 2, 3];
	for (let i = 1; i < sections.length; i++) {
		const a = sections[i - 1];
		const b = sections[i];
		for (let corner = 0; corner < sides; corner++) {
			const next = (corner + 1) % sides;
			indices.push(a + corner, b + corner, b + next, a + corner, b + next, a + next);
		}
	}
	const first = sections[0];
	const last = sections[sections.length - 1];
	indices.push(
		first,
		first + c1,
		first + c2,
		first,
		first + c2,
		first + c3,
		last,
		last + c2,
		last + c1,
		last,
		last + c3,
		last + c2
	);
	return asLayer({ kind: 'mesh', positions, indices });
}

/** Projects a graded elevated centerline in local XYZ meters into an open glazed shell, an
 * opaque path deck and matching ribs. Inputs are read only. Throws RangeError for invalid sweep
 * data or a span without horizontal run. The caller supplies the walking grade and curvature. */
export function projectWalkableTube(
	id: string,
	centerline: readonly Vec3[],
	attachments: TubeAttachments = {}
): TubeProjection {
	const tube = sweep(
		centerline,
		attachments,
		defaults.walkableTubeRadiusM,
		defaults.walkableTubeRibWidthM,
		defaults.walkableTubeRibSpacingM
	);
	const object = createMeshObject(
		id,
		{
			'tube-deck': drawTubeDeck(centerline),
			'tube-glazing': asLayer(tube.body),
			'tube-ribs': asLayer(required(tube.collars, 'walkable tube ribs'))
		},
		tube.anchors
	);
	return {
		object,
		drawables: resolveSurfaces(object, {
			'tube-deck': pathSurface,
			'tube-glazing': glazingSurface,
			'tube-ribs': pathSurface
		})
	};
}

/** Projects a compact utility run and fittings in local XYZ meters for the transparency display.
 * Inputs are read only. Throws RangeError for invalid sweep data or flow. */
export function projectServicePipe(
	id: string,
	centerline: readonly Vec3[],
	flow: ServicePipeFlow,
	attachments: TubeAttachments = {}
): TubeProjection {
	if (!Object.hasOwn(serviceColors, flow)) throw new RangeError('Unknown service pipe flow');
	const tube = sweep(
		centerline,
		attachments,
		defaults.servicePipeRadiusM,
		defaults.servicePipeCollarWidthM
	);
	const object = createMeshObject(
		id,
		{
			'service-pipe': asLayer(tube.body),
			'service-collars': asLayer(required(tube.collars, 'service pipe collars'))
		},
		tube.anchors
	);
	const serviceSurface = { ...pathSurface, color: serviceColors[flow] };
	const drawables = resolveSurfaces(object, {
		'service-pipe': { ...serviceSurface, flat: true },
		'service-collars': { ...serviceSurface, finish: 'gloss' }
	}).map((drawable) => ({
		...drawable,
		strokeSegments: [],
		visible: false
	}));
	return { object, drawables };
}

/** Returns a fresh display selection for a projected service pipe, sharing its geometry. */
export function paintServicePipe(projection: TubeProjection, display: MaterialDisplay): Drawable[] {
	if (display !== 'normal' && display !== 'transparency')
		throw new RangeError('Unknown service pipe display mode');
	return projection.drawables.map((drawable) => ({
		...drawable,
		visible: display === 'transparency'
	}));
}
