import {
	Box3,
	BufferGeometry,
	Float32BufferAttribute,
	InstancedBufferAttribute,
	Mesh,
	Sphere,
	Uint32BufferAttribute,
	type Group,
	type Object3D
} from 'three/webgpu';
import { LineSegments2 } from 'three/addons/lines/webgpu/LineSegments2.js';
import { defaults } from '../../../config/stage';
import { lineGeometry, type Edges } from './edges';
import { renderOrder, segmentData, type ProjectedPart, type StrokeSource } from './part';
import type { batchMaterials, PartLook } from './rows';

export type BatchedPart = ProjectedPart & {
	row: number;
	look?: Pick<
		PartLook,
		'opacity' | 'strokeOpacity' | 'hidden' | 'visible' | 'veil' | 'scale' | 'offset'
	>;
};
type Materials = ReturnType<typeof batchMaterials>;
type Range = { start: number; count: number };
type StrokeRange = {
	part: BatchedPart;
	source: StrokeSource;
	start: number;
	scale: number;
	offset: number;
};

export function chunkKey(part: ProjectedPart) {
	let { bounds } = part;
	if (bounds.isEmpty()) {
		bounds = new Box3();
		const scratch = new Box3();
		for (const { edges } of part.sources) bounds.union(scratch.setFromArray(edges.segments));
	}
	const { min, max } = bounds;
	const size = defaults.chunkSizeM;
	if (
		bounds.isEmpty() ||
		max.x - min.x > size ||
		max.y - min.y > size ||
		part.drawable.finish === 'terrain'
	)
		return 'background';
	return `${Math.floor((min.x + max.x) / (2 * size))}/${Math.floor((min.y + max.y) / (2 * size))}`;
}

export function displayedBounds(part: ProjectedPart, output: Box3, scale: number, offset: number) {
	output.copy(part.bounds);
	if (!output.isEmpty()) {
		const low = output.min.z * scale + offset;
		const high = output.max.z * scale + offset;
		output.min.z = Math.min(low, high);
		output.max.z = Math.max(low, high);
	}
	return output;
}

function fillBatch(
	parts: readonly BatchedPart[],
	materials: Materials,
	smooth: boolean,
	mesh?: Mesh<BufferGeometry, Materials['opaque']>
) {
	const positions: number[] = [];
	const indices: number[] = [];
	const owners: number[] = [];
	const ranges = new Map<BatchedPart, Range>();
	for (const part of parts) {
		const source = part.arrays;
		if (!source) continue;
		const start = indices.length;
		const offset = owners.length;
		if (smooth) {
			for (const value of source.positions) positions.push(value);
			for (let i = 0; i < source.positions.length; i += 3) owners.push(part.row);
			for (const index of source.indices) indices.push(offset + index);
		} else {
			// Keep flat faces of object studies. Vertices cannot be shared across a hard fold.
			for (const index of source.indices) {
				const i = index * 3;
				positions.push(source.positions[i], source.positions[i + 1], source.positions[i + 2]);
				indices.push(owners.length);
				owners.push(part.row);
			}
		}
		ranges.set(part, { start, count: indices.length - start });
	}
	if (!ranges.size) return;
	const geometry = new BufferGeometry()
		.setAttribute('position', new Float32BufferAttribute(positions, 3))
		.setAttribute('aPartIndex', new Uint32BufferAttribute(owners, 1))
		.setIndex(indices);
	geometry.computeVertexNormals();
	const opaque = mesh ?? new Mesh(geometry, materials.opaque);
	opaque.geometry = geometry;
	opaque.renderOrder = renderOrder(parts[0].drawable);
	const sphere = new Sphere();
	geometry.boundingSphere = sphere;
	return { opaque, geometry, ranges, sphere };
}

type StrokeMember = { part: BatchedPart; source: StrokeSource };
type StrokeKind = StrokeSource['kind'];

function strokeBatch(
	kind: StrokeKind,
	members: readonly StrokeMember[],
	materials: Materials,
	previous?: readonly LineSegments2[]
) {
	const edges: Edges = { segments: [], fronts: [], backs: [] };
	const rows: number[] = [];
	const ranges: StrokeRange[] = [];
	for (const { part, source } of members) {
		ranges.push({ part, source, start: edges.segments.length, scale: 1, offset: 0 });
		for (const channel of ['segments', 'fronts', 'backs'] as const)
			for (const value of source.edges[channel]) edges[channel].push(value);
		for (let i = 0; i < source.edges.segments.length; i += 6) rows.push(part.row);
	}
	const geometry = lineGeometry(edges);
	geometry.setAttribute('aPartIndex', new InstancedBufferAttribute(new Uint32Array(rows), 1));
	const painters = {
		explicit: [materials.front, materials.back],
		edge: [materials.crease, materials.outer],
		grid: [materials.grid],
		rim: [materials.rim]
	}[kind];
	const lines = painters.map((material, index) => {
		const line = previous?.[index] ?? new LineSegments2(geometry, material);
		line.geometry = geometry;
		line.renderOrder = kind === 'explicit' ? 5 : 2 + index;
		return line;
	});
	return { geometry, lines, ranges };
}

function refreshStrokes({ geometry, lines, ranges }: ReturnType<typeof strokeBatch>) {
	const data = segmentData(geometry);
	let moved = false;
	let front = false;
	let back = false;
	for (const range of ranges) {
		const {
			part: { look },
			source,
			start
		} = range;
		if (!look) continue;
		if (look.visible && (source.kind !== 'explicit' || look.strokeOpacity > 0)) {
			front = true;
			back ||= source.kind !== 'explicit' || look.hidden > 0;
		}
		if (look.scale === range.scale && look.offset === range.offset) continue;
		range.scale = look.scale;
		range.offset = look.offset;
		const { segments } = source.edges;
		for (let i = 2; i < segments.length; i += 3)
			data.array[start + i] = segments[i] * look.scale + look.offset;
		data.addUpdateRange(start, segments.length);
		moved = true;
	}
	if (moved) {
		data.needsUpdate = true;
		geometry.computeBoundingBox();
		geometry.computeBoundingSphere();
	}
	lines[0].visible = front;
	if (lines[1]) lines[1].visible = back;
}

/** Each sortable range owns a geometry wrapper and borrows its buffers from the tile. */
function rangeGeometry(geometry: BufferGeometry, { start, count }: Range) {
	const view = new BufferGeometry();
	view.attributes = { ...geometry.attributes };
	view.setIndex(geometry.index);
	view.setDrawRange(start, count);
	return view;
}

const rangeOrder = new WeakMap<Object3D, number>();

type RenderItem = {
	groupOrder: number | null;
	renderOrder: number | null;
	z: number | null;
	id: number | null;
	object: Object3D | null;
};

function transparentTieOrder({ object, id }: RenderItem) {
	return (object ? rangeOrder.get(object) : undefined) ?? id ?? 0;
}

/** Preserve Three's group, pass and depth order, including the original tie order of a
 * translucent range when its mesh has been released and brought back. */
export function sortTranslucent(a: RenderItem, b: RenderItem) {
	return (
		(a.groupOrder ?? 0) - (b.groupOrder ?? 0) ||
		(a.renderOrder ?? 0) - (b.renderOrder ?? 0) ||
		(b.z ?? 0) - (a.z ?? 0) ||
		transparentTieOrder(a) - transparentTieOrder(b)
	);
}

type FillBatch = NonNullable<ReturnType<typeof fillBatch>>;
type AlphaRange = { body: Mesh; sphere: Sphere; veil?: Mesh };

export function packChunk(materials: Materials, group: Group, smooth: boolean) {
	const fills: (FillBatch | undefined)[] = [];
	const strokes = new Map<StrokeKind, ReturnType<typeof strokeBatch>>();
	const sorted = new Map<BatchedPart, AlphaRange>();
	const order = new WeakMap<BatchedPart, number>();
	const box = new Box3();
	const scratch = new Box3();

	function releaseVeil(veil: Mesh) {
		veil.removeFromParent();
		veil.dispose();
	}

	function releaseRangeGeometry(geometry: BufferGeometry) {
		// The range borrows buffers. Only the tile's own geometry releases them.
		geometry.attributes = {};
		geometry.setIndex(null);
		geometry.dispose();
	}

	function releaseAlpha(part: BatchedPart, { body, veil }: AlphaRange) {
		if (veil) releaseVeil(veil);
		body.removeFromParent();
		body.dispose();
		releaseRangeGeometry(body.geometry);
		sorted.delete(part);
	}

	function replaceRanges(previous: FillBatch, fill: FillBatch) {
		for (const part of previous.ranges.keys()) {
			const alpha = sorted.get(part);
			if (!alpha) continue;
			const range = fill.ranges.get(part);
			if (!range) {
				releaseAlpha(part, alpha);
				continue;
			}
			const oldView = alpha.body.geometry;
			const view = rangeGeometry(fill.geometry, range);
			view.boundingSphere = alpha.sphere;
			alpha.body.geometry = view;
			if (alpha.veil) alpha.veil.geometry = view;
			releaseRangeGeometry(oldView);
		}
		previous.geometry.dispose();
	}

	function releaseFill({ opaque, geometry, ranges }: FillBatch) {
		for (const part of ranges.keys()) {
			const alpha = sorted.get(part);
			if (alpha) releaseAlpha(part, alpha);
		}
		opaque.removeFromParent();
		opaque.dispose();
		geometry.dispose();
	}

	function releaseStroke({ geometry, lines }: ReturnType<typeof strokeBatch>) {
		group.remove(...lines);
		for (const line of lines) line.dispose();
		geometry.dispose();
	}

	function repackFills(layers: readonly BatchedPart[][]) {
		for (const [index, layer] of layers.entries()) {
			const previous = fills[index];
			const retained = previous && [...previous.ranges.keys()];
			if (retained?.length === layer.length && layer.every((part, i) => part === retained[i]))
				continue;
			const fill = fillBatch(layer, materials, smooth, previous?.opaque);
			fills[index] = fill;
			if (previous && fill) replaceRanges(previous, fill);
			else if (previous) releaseFill(previous);
			else if (fill) group.add(fill.opaque);
		}
	}

	function repackStrokes(members: Map<StrokeKind, StrokeMember[]>) {
		for (const [kind, previous] of strokes) {
			if (members.has(kind)) continue;
			releaseStroke(previous);
			strokes.delete(kind);
		}
		for (const [kind, parts] of members) {
			const previous = strokes.get(kind);
			if (
				previous?.ranges.length === parts.length &&
				parts.every(({ source }, i) => source === previous.ranges[i].source)
			)
				continue;
			const stroke = strokeBatch(kind, parts, materials, previous?.lines);
			strokes.set(kind, stroke);
			if (previous) previous.geometry.dispose();
			else group.add(...stroke.lines);
		}
	}

	function refreshAlpha(
		{ opaque, geometry }: FillBatch,
		part: BatchedPart,
		range: Range,
		look: NonNullable<BatchedPart['look']>
	) {
		let alpha = sorted.get(part);
		if (look.opacity <= 0 || look.opacity >= 1) {
			if (alpha) releaseAlpha(part, alpha);
			return;
		}
		if (!alpha) {
			const view = rangeGeometry(geometry, range);
			const body = new Mesh(view, materials.alpha);
			body.renderOrder = opaque.renderOrder;
			const firstOrder = order.get(part) ?? body.id;
			order.set(part, firstOrder);
			rangeOrder.set(body, firstOrder);
			alpha = { body, sphere: new Sphere() };
			view.boundingSphere = alpha.sphere;
			group.add(body);
			sorted.set(part, alpha);
		}
		alpha.body.visible = true;
		alpha.body.material = part.drawable.finish === 'glass' ? materials.glass : materials.alpha;
		scratch.getBoundingSphere(alpha.sphere);
		if (look.veil && !alpha.veil) {
			alpha.veil = new Mesh(alpha.body.geometry, materials.veil);
			alpha.veil.renderOrder = 6;
			group.add(alpha.veil);
		} else if (!look.veil && alpha.veil) {
			releaseVeil(alpha.veil);
			alpha.veil = undefined;
		}
	}

	return {
		/** Only batches whose source membership changed need new GPU buffers. */
		repack(parts: Set<BatchedPart>) {
			const layers: BatchedPart[][] = [[], []];
			const members = new Map<StrokeKind, StrokeMember[]>();
			for (const part of parts) {
				if (part.arrays?.indices.length && part.drawable.finish !== 'line')
					layers[part.drawable.strokeSegments ? 1 : 0].push(part);
				for (const source of part.sources) {
					const group = members.get(source.kind) ?? [];
					group.push({ part, source });
					members.set(source.kind, group);
				}
			}
			repackFills(layers);
			repackStrokes(members);
		},
		refresh() {
			for (const fill of fills) {
				if (!fill) continue;
				const { opaque, ranges, sphere } = fill;
				box.makeEmpty();
				for (const [part, range] of ranges) {
					const look = part.look;
					if (!look) continue;
					displayedBounds(part, scratch, look.scale, look.offset);
					if (look.opacity >= 1) box.union(scratch);
					refreshAlpha(fill, part, range, look);
				}
				opaque.visible = !box.isEmpty();
				box.getBoundingSphere(sphere);
			}
			for (const stroke of strokes.values()) refreshStrokes(stroke);
		},
		delete() {
			for (const fill of fills) if (fill) releaseFill(fill);
			for (const stroke of strokes.values()) releaseStroke(stroke);
		}
	};
}
