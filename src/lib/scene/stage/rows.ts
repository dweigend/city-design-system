import { defaults } from '../../../config/stage';
import {
	DoubleSide,
	MeshBasicNodeMaterial,
	StorageBufferAttribute,
	type Color
} from 'three/webgpu';
import {
	attribute,
	mix,
	normalWorldGeometry,
	positionLocal,
	positionGeometry,
	storage,
	vec3,
	varying
} from 'three/tsl';
import { sectionMask, sectionPlane } from './dissection';
import { explicitStroke, type strokeMaterials } from './edges';
import { pencilFill } from './material';
import { levels, type drawingPalette } from './tone';
import type { Drawable } from '../surface';

// Six vec4s per part: fill RGBA, face tones and flat flag, Z transform and grain,
// stroke RGBA, hidden share, depth fade, hatch and visible width, then the section plane.
const vectorsPerPart = /* Exact arithmetic: six packed Vec4 fields per part. */ 6;
const components = /* Exact arithmetic: components per Vec4 field. */ 4;
const rowSize = vectorsPerPart * components;

export type PartLook = {
	color: Color;
	strokeColor: Color;
	opacity: number;
	strokeOpacity: number;
	hidden: number;
	recede: number;
	width: number;
	visible: boolean;
	veil: boolean;
	scale: number;
	offset: number;
};

export function createRows() {
	const buffer = storage(
		new StorageBufferAttribute(components, components),
		'vec4',
		/* Exact arithmetic: initial uniform offset. */ 0
	).toReadOnly();
	const free: number[] = [];
	let size = 0;
	const partIndex = attribute('aPartIndex', 'uint').mul(vectorsPerPart);
	const index = varying(partIndex, 'partRow').setInterpolation('flat');
	let start = Infinity;
	let end = 0;

	function mark(offset: number) {
		start = Math.min(start, offset);
		end = Math.max(end, offset + rowSize);
	}

	return {
		buffer,
		at: (row: number) => buffer.element(index.add(row)),
		inVertex: (row: number) => buffer.element(partIndex.add(row)),
		allocate() {
			const id = free.pop() ?? size++;
			const length = (id + 1) * rowSize;
			if (length > buffer.value.array.length) {
				const old = buffer.value;
				const array = new Float32Array(Math.max(length, old.array.length * 2));
				array.set(old.array);
				buffer.value = new StorageBufferAttribute(array, components);
				old.dispose();
			}
			return id;
		},
		release(id: number) {
			free.push(id);
		},
		write(id: number, part: Drawable, look: PartLook) {
			const base = id * rowSize;
			const { color, strokeColor, opacity, strokeOpacity, hidden, recede, scale, offset } = look;
			const { top, lit, shadow } = part.faces ?? levels;
			// The fields below follow the storage layout above.
			const array = buffer.value.array;
			let i = base;
			array[i++] = color.r;
			array[i++] = color.g;
			array[i++] = color.b;
			array[i++] = opacity;
			array[i++] = top;
			array[i++] = lit;
			array[i++] = shadow;
			array[i++] = Number(part.flat === true);
			array[i++] = scale;
			array[i++] = offset;
			array[i++] = part.grain?.amount ?? 0;
			array[i++] = part.grain?.cellM ?? 1;
			array[i++] = strokeColor.r;
			array[i++] = strokeColor.g;
			array[i++] = strokeColor.b;
			array[i++] = strokeOpacity;
			array[i++] = hidden;
			array[i++] = recede;
			array[i++] = part.hatch ?? 0;
			array[i++] = look.visible ? (part.strokeSegments ? look.width : 1) : 0;
			array.set(sectionPlane(part.section), i);
			mark(base);
		},
		flush() {
			if (end === 0) return;
			buffer.value.addUpdateRange(start, end - start);
			buffer.value.needsUpdate = true;
			start = Infinity;
			end = /* Exact arithmetic: empty storage starts at the first row. */ 0;
		},
		delete() {
			buffer.value.dispose();
		}
	};
}

export function batchMaterials(
	rows: ReturnType<typeof createRows>,
	palette: ReturnType<typeof drawingPalette>,
	strokes: ReturnType<typeof strokeMaterials>,
	landscape: boolean
) {
	const [fill, faces, grain, ink, flags, plane] =
		/* Exact arithmetic: offsets of the six packed row fields. */ [0, 1, 2, 3, 4, 5].map(rows.at);
	const inside = sectionMask(plane);
	const transform = rows.inVertex(/* Exact arithmetic: transform column offset. */ 2);
	const position = vec3(positionLocal.xy, positionLocal.z.mul(transform.x).add(transform.y));
	const scale = grain.x
		.lessThan(/* Exact arithmetic: test vertical scale sign. */ 0)
		.select(
			grain.x.min(-defaults.stageBatchNormalScaleFloor),
			grain.x.max(defaults.stageBatchNormalScaleFloor)
		);
	const normal = normalWorldGeometry
		.mul(
			vec3(
				/* Exact arithmetic: X normals keep unit scale. */ 1,
				/* Exact arithmetic: Y normals keep unit scale. */ 1,
				scale.reciprocal()
			)
		)
		.normalize();
	const color = mix(
		pencilFill(palette, fill.rgb, normal, faces.xyz, grain.z, grain.w, flags.z),
		fill.rgb,
		faces.w
	);

	function body(transparent: boolean, polygonOffset: boolean) {
		const material = new MeshBasicNodeMaterial({
			side: DoubleSide,
			forceSinglePass: true,
			transparent,
			depthWrite: !transparent,
			polygonOffset,
			polygonOffsetFactor: defaults.stageFillDepthFactor,
			polygonOffsetUnits: defaults.stageFillDepthBias
		});
		material.positionNode = position;
		material.colorNode = color;
		material.maskNode = inside;
		if (transparent) material.opacityNode = fill.a;
		else
			material.maskNode = inside.and(
				fill.a.greaterThanEqual(/* Exact arithmetic: unit opacity is opaque. */ 1)
			);
		return material;
	}

	const opaque = body(false, !landscape);
	const alpha = body(true, !landscape);
	const glass = landscape ? alpha : body(true, false);
	const veil = new MeshBasicNodeMaterial({ colorWrite: false });
	veil.positionNode = position;
	veil.maskNode = inside;
	const outer = strokes.outer.clone();
	const crease = strokes.crease.clone();
	const grid = strokes.grid.clone();
	const rim = strokes.gridBoundary.clone();
	// Line2 can write RGB even at zero alpha. Discard hidden rows before they cover an alpha fill.
	const visible = inside.and(flags.w.greaterThan(/* Exact arithmetic: zero means hidden. */ 0));
	outer.maskNode = strokes.silhouette.and(visible);
	crease.maskNode = strokes.silhouette.not().and(visible);
	for (const pencil of [grid, rim]) {
		pencil.maskNode = visible;
		pencil.colorNode = ink.rgb;
	}
	// The screen-space ribbon has already been expanded from scaled endpoints.
	// Translating it here keeps its CSS width and avoids changing any endpoint buffer.
	const unchanged = /* Exact arithmetic: translation leaves X and Y untouched. */ 0;
	const translation = vec3(unchanged, unchanged, transform.y);
	for (const pencil of [outer, crease, grid, rim])
		pencil.positionNode = positionLocal.add(translation);
	const front = explicitStroke(strokes.depth, false, { color: ink.rgb, recede: flags.y }).material;
	const back = explicitStroke(strokes.depth, true, { color: ink.rgb, recede: flags.y }).material;
	front.opacityNode = ink.a;
	back.opacityNode = ink.a.mul(flags.x);
	front.maskNode = visible;
	back.maskNode = visible;
	// Line2 expands a one-pixel ribbon around each endpoint. In an orthographic stage,
	// scaling that offset preserves the CSS width, round caps and centerline depth.
	const endpoint = positionGeometry.y
		.lessThan(/* Exact arithmetic: split the normalized line at its midpoint. */ 0.5)
		.select(attribute('instanceStart', 'vec3'), attribute('instanceEnd', 'vec3'));
	const width = rows.inVertex(/* Exact arithmetic: flags column offset. */ 4).w;
	front.positionNode = mix(endpoint, positionLocal, width).add(translation);
	back.positionNode = mix(
		endpoint,
		positionLocal,
		width.mul(defaults.stageHiddenStrokeWidthRatio)
	).add(translation);

	const materials = { opaque, alpha, glass, veil, outer, crease, grid, rim, front, back };
	const unique = new Set(Object.values(materials));
	return {
		...materials,
		count: unique.size,
		delete() {
			for (const material of unique) material.dispose();
		}
	};
}
