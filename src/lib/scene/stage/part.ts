import {
	Box3,
	BufferGeometry,
	CustomBlending,
	Float32BufferAttribute,
	Mesh,
	MinEquation,
	NormalBlending,
	OneFactor
} from 'three/webgpu';
import { LineSegments2 } from 'three/addons/lines/webgpu/LineSegments2.js';
import type { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import type { Drawable } from '../surface';
import {
	boundaries,
	creases,
	explicitStroke,
	lineGeometry,
	type Edges,
	type strokeMaterials
} from './edges';
import { shapeArrays } from './geometry';
import { fillMaterial } from './material';
import type { PartLook } from './rows';
import { levels, type drawingPalette } from './tone';

export type StrokeSource =
	{ kind: 'edge' | 'grid' | 'rim'; edges: Edges } | { kind: 'explicit'; edges: Edges };

export function renderOrder(drawable: Drawable) {
	if (drawable.finish === 'shadow') return 1;
	return drawable.strokeSegments ? 4 : 0;
}

function partsEdges(drawable: Drawable, { positions, indices }: ReturnType<typeof shapeArrays>) {
	const vertices = drawable.warp ? [] : undefined;
	if (!drawable.creaseGroups) return creases(positions, indices, drawable.creaseAngleRad, vertices);
	const merged: Edges = { segments: [], fronts: [], backs: [], vertices };
	let start = 0;
	for (const end of drawable.creaseGroups) {
		const own = creases(positions, indices.slice(start, end), drawable.creaseAngleRad, vertices);
		for (const key of ['segments', 'fronts', 'backs'] as const)
			for (const value of own[key]) merged[key].push(value);
		start = end;
	}
	return merged;
}

function strokeSources(
	drawable: Drawable,
	arrays: ReturnType<typeof shapeArrays>,
	landscape: boolean
): StrokeSource[] {
	const { positions, indices } = arrays;
	if (drawable.strokeSegments)
		return [
			{
				kind: 'explicit',
				edges: { segments: [...drawable.strokeSegments], fronts: [], backs: [] }
			}
		];
	if (landscape && drawable.finish === 'line')
		return [
			{ kind: 'grid', edges: boundaries(positions, indices, true, drawable.warp ? [] : undefined) },
			{ kind: 'rim', edges: boundaries(positions, indices, false, drawable.warp ? [] : undefined) }
		];
	const fold = drawable.creaseAngleRad !== undefined;
	const edges =
		!landscape || fold
			? partsEdges(drawable, arrays)
			: boundaries(
					positions,
					drawable.boundaryStroke ? indices : [],
					false,
					drawable.warp ? [] : undefined
				);
	return [{ kind: 'edge', edges }];
}

type WarpTarget = {
	array: Float32Array;
	base: Float32Array;
	offsets: readonly number[];
};

/** The interleaved XYZ endpoints owned by r187 LineSegmentsGeometry. */
export function segmentData(geometry: LineSegmentsGeometry) {
	const attribute = geometry.getAttribute('instanceStart');
	if ('data' in attribute) return attribute.data;
	throw new Error('Expected interleaved line endpoints');
}

function plainGeometry(arrays: ReturnType<typeof shapeArrays>, smooth: boolean) {
	const indexed = new BufferGeometry()
		.setAttribute('position', new Float32BufferAttribute(arrays.positions, 3))
		.setIndex([...arrays.indices]);
	const fill = smooth ? indexed : indexed.toNonIndexed();
	fill.computeVertexNormals();
	fill.computeBoundingBox();
	return fill;
}

function separateFill(
	drawable: Drawable,
	arrays: ReturnType<typeof shapeArrays>,
	palette: ReturnType<typeof drawingPalette>,
	landscape: boolean
) {
	const fill = plainGeometry(arrays, landscape);
	const drawing = fillMaterial(palette, drawable.terrainField);
	const mesh = new Mesh(fill, drawing.material);
	mesh.renderOrder = renderOrder(drawable);
	const warp = drawable.warp;
	const warpTargets: WarpTarget[] = [];
	if (warp) {
		const array = fill.attributes.position.array as Float32Array;
		const offsets = landscape
			? warp.fill
			: arrays.indices.flatMap((i) => [warp.fill[2 * i], warp.fill[2 * i + 1]]);
		warpTargets.push({ array, base: array.slice(), offsets });
	}
	return { mesh, drawing, warpTargets, warpAmount: 0, veil: undefined as Mesh | undefined };
}

function separateStrokes(
	sources: StrokeSource[],
	strokes: ReturnType<typeof strokeMaterials>,
	warp: NonNullable<Drawable['warp']>,
	targets: WarpTarget[]
) {
	return sources.flatMap(({ kind, edges }) => {
		const geometry = lineGeometry(edges);
		const explicit = kind === 'explicit';
		const offsets = explicit
			? warp.stroke
			: edges.vertices?.flatMap((i) => [warp.fill[2 * i], warp.fill[2 * i + 1]]);
		if (offsets) {
			const array = segmentData(geometry).array as Float32Array;
			targets.push({ array, base: array.slice(), offsets });
		}
		const painters = explicit
			? [explicitStroke(strokes.depth), explicitStroke(strokes.depth, true)]
			: (kind === 'edge'
					? [strokes.crease, strokes.outer]
					: [kind === 'grid' ? strokes.grid : strokes.gridBoundary]
				).map((material) => ({ material, recede: undefined }));
		return painters.map(({ material, recede }, index) => {
			const line = new LineSegments2(geometry, material);
			line.renderOrder = explicit ? 5 : 2 + index;
			return { line, recede, hidden: explicit && index === 1 };
		});
	});
}

export function projectPart(
	drawable: Drawable,
	strokes: ReturnType<typeof strokeMaterials>,
	palette: ReturnType<typeof drawingPalette>,
	landscape: boolean
) {
	const arrays = shapeArrays(drawable.shape);
	const bounds = new Box3().setFromArray(arrays.positions);
	const sources = strokeSources(drawable, arrays, landscape).filter(
		({ edges }) => edges.segments.length > 0
	);
	const standalone =
		drawable.finish === 'terrain' ||
		drawable.finish === 'shadow' ||
		drawable.warp !== undefined ||
		drawable.terrainField !== undefined;
	const fill = standalone ? separateFill(drawable, arrays, palette, landscape) : undefined;
	const individual =
		fill && drawable.warp ? separateStrokes(sources, strokes, drawable.warp, fill.warpTargets) : [];
	return {
		drawable,
		bounds,
		fill,
		individual,
		arrays: fill ? undefined : arrays,
		sources: individual.length ? [] : sources
	};
}

export type ProjectedPart = ReturnType<typeof projectPart>;

export function warpPart({ fill, drawable, bounds, individual }: ProjectedPart) {
	const amount = drawable.warp?.amount ?? 0;
	if (!fill || !fill.warpTargets.length || amount === fill.warpAmount) return;
	fill.warpAmount = amount;
	for (const { array, base, offsets } of fill.warpTargets) {
		for (let point = 0; point < offsets.length / 2; point++) {
			const i = point * 3;
			array[i] = base[i] + amount * offsets[2 * point];
			array[i + 1] = base[i + 1] + amount * offsets[2 * point + 1];
		}
	}
	const geometry = fill.mesh.geometry;
	geometry.attributes.position.needsUpdate = true;
	geometry.computeVertexNormals();
	geometry.computeBoundingBox();
	geometry.computeBoundingSphere();
	if (geometry.boundingBox) bounds.copy(geometry.boundingBox);
	for (const geometry of new Set(individual.map(({ line }) => line.geometry))) {
		segmentData(geometry).needsUpdate = true;
		geometry.computeBoundingBox();
		geometry.computeBoundingSphere();
	}
}

export function styleIndividual(
	part: ProjectedPart,
	look: PartLook,
	veilMaterial: Mesh['material'],
	landscape: boolean
) {
	const { fill, individual, drawable } = part;
	if (fill) {
		const { mesh, drawing } = fill;
		const shade = drawable.finish === 'shadow';
		const transparent = look.opacity < 1;
		const polygonOffset = !landscape && drawable.finish !== 'glass';
		const blending = shade ? CustomBlending : NormalBlending;
		const material = drawing.material;
		if (
			material.transparent !== transparent ||
			material.polygonOffset !== polygonOffset ||
			material.blending !== blending
		)
			material.needsUpdate = true;
		Object.assign(material, {
			opacity: look.opacity,
			transparent,
			polygonOffset,
			blending,
			blendEquation: MinEquation,
			blendSrc: OneFactor,
			blendDst: OneFactor,
			depthTest: !shade,
			depthWrite: !transparent && !shade
		});
		material.color.copy(look.color);
		drawing.terrain.value = Number(drawable.finish === 'terrain');
		drawing.flat.value = Number(drawable.flat === true || shade);
		drawing.heightScale.value = drawable.heightScale ?? 1;
		drawing.hatch.value = drawable.hatch ?? 0;
		drawing.grain.amount.value = drawable.grain?.amount ?? 0;
		drawing.grain.cell.value = drawable.grain?.cellM ?? 1;
		const { top, lit, shadow } = drawable.faces ?? levels;
		drawing.faces.value.set(top, lit, shadow);
		mesh.visible = look.opacity > 0;
		mesh.scale.z = look.scale;
		mesh.position.z = look.offset;
		if (look.veil && !fill.veil) {
			fill.veil = new Mesh(mesh.geometry, veilMaterial);
			fill.veil.renderOrder = 6;
			mesh.add(fill.veil);
		} else if (!look.veil && fill.veil) {
			mesh.remove(fill.veil);
			fill.veil.dispose();
			fill.veil = undefined;
		}
	}
	for (const { line, hidden, recede } of individual) {
		if (recede) {
			line.material.color.copy(look.strokeColor);
			line.material.opacity = look.strokeOpacity * (hidden ? look.hidden : 1);
			line.material.linewidth = look.width * (hidden ? 0.75 : 1);
			recede.value = look.recede;
		}
		line.visible = look.visible && line.material.opacity > 0;
		line.scale.z = look.scale;
		line.position.z = look.offset;
		line.frustumCulled = !drawable.vertical && !drawable.warp;
	}
}
