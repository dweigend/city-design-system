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
import { explicitStroke, type strokeMaterials } from './edges';
import { pencilFill } from './material';
import { levels, type drawingPalette } from './tone';
import type { Drawable } from '../surface';

// Five vec4s per part: fill RGBA, face tones and flat flag, Z transform and grain,
// stroke RGBA, then hidden share, depth fade, hatch and visible width.
const vectorsPerPart = 5;
const components = 4;
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
		0
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
			buffer.value.array.set(
				[
					color.r,
					color.g,
					color.b,
					opacity,
					top,
					lit,
					shadow,
					Number(part.flat === true),
					scale,
					offset,
					part.grain?.amount ?? 0,
					part.grain?.cellM ?? 1,
					strokeColor.r,
					strokeColor.g,
					strokeColor.b,
					strokeOpacity,
					hidden,
					recede,
					part.hatch ?? 0,
					look.visible ? (part.strokeSegments ? look.width : 1) : 0
				],
				base
			);
			mark(base);
		},
		flush() {
			if (end === 0) return;
			buffer.value.addUpdateRange(start, end - start);
			buffer.value.needsUpdate = true;
			start = Infinity;
			end = 0;
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
	const [fill, faces, grain, ink, flags] = [0, 1, 2, 3, 4].map(rows.at);
	const transform = rows.inVertex(2);
	const position = vec3(positionLocal.xy, positionLocal.z.mul(transform.x).add(transform.y));
	const scale = grain.x.lessThan(0).select(grain.x.min(-1e-4), grain.x.max(1e-4));
	const normal = normalWorldGeometry.mul(vec3(1, 1, scale.reciprocal())).normalize();
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
			polygonOffsetFactor: 1,
			polygonOffsetUnits: 1
		});
		material.positionNode = position;
		material.colorNode = color;
		if (transparent) material.opacityNode = fill.a;
		else material.maskNode = fill.a.greaterThanEqual(1);
		return material;
	}

	const opaque = body(false, !landscape);
	const alpha = body(true, !landscape);
	const glass = landscape ? alpha : body(true, false);
	const veil = new MeshBasicNodeMaterial({ colorWrite: false });
	veil.positionNode = position;
	const outer = strokes.outer.clone();
	const crease = strokes.crease.clone();
	const grid = strokes.grid.clone();
	const rim = strokes.gridBoundary.clone();
	// Line2 can write RGB even at zero alpha. Discard hidden rows before they cover an alpha fill.
	const visible = flags.w.greaterThan(0);
	outer.maskNode = strokes.silhouette.and(visible);
	crease.maskNode = strokes.silhouette.not().and(visible);
	for (const pencil of [grid, rim]) {
		pencil.maskNode = visible;
		pencil.colorNode = ink.rgb;
	}
	const front = explicitStroke(strokes.depth, false, { color: ink.rgb, recede: flags.y }).material;
	const back = explicitStroke(strokes.depth, true, { color: ink.rgb, recede: flags.y }).material;
	front.opacityNode = ink.a;
	back.opacityNode = ink.a.mul(flags.x);
	// Line2 expands a one-pixel ribbon around each endpoint. In an orthographic stage,
	// scaling that offset preserves the CSS width, round caps and centerline depth.
	const endpoint = positionGeometry.y
		.lessThan(0.5)
		.select(attribute('instanceStart', 'vec3'), attribute('instanceEnd', 'vec3'));
	const width = rows.inVertex(4).w;
	front.positionNode = mix(endpoint, positionLocal, width);
	back.positionNode = mix(endpoint, positionLocal, width.mul(0.75));

	return {
		opaque,
		alpha,
		glass,
		veil,
		outer,
		crease,
		grid,
		rim,
		front,
		back,
		count: landscape ? 9 : 10,
		delete() {
			for (const material of new Set([
				opaque,
				alpha,
				glass,
				veil,
				outer,
				crease,
				grid,
				rim,
				front,
				back
			]))
				material.dispose();
		}
	};
}
