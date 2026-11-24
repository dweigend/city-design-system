import {
	Box3,
	BufferGeometry,
	Float32BufferAttribute,
	InstancedBufferAttribute,
	Mesh,
	Sphere,
	Uint32BufferAttribute,
	type Group
} from 'three/webgpu';
import { LineSegments2 } from 'three/addons/lines/webgpu/LineSegments2.js';
import { defaults } from '../../../config/stage';
import { lineGeometry, type Edges } from './edges';
import { renderOrder, segmentData, type ProjectedPart, type StrokeSource } from './part';
import type { batchMaterials, PartLook } from './rows';

export type BatchedPart = ProjectedPart & { row: number; look?: PartLook };
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
	const {
		bounds: { min, max },
		sources
	} = part;
	const size = defaults.chunkSizeM;
	if (max.x - min.x > size || max.y - min.y > size || part.drawable.finish === 'terrain')
		return 'background';
	if (!Number.isFinite(min.x)) {
		const points = sources[0]?.edges.segments;
		if (!points) return 'background';
		return `${Math.floor(points[0] / size)}/${Math.floor(points[1] / size)}`;
	}
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

function fillBatch(parts: BatchedPart[], materials: Materials, smooth: boolean) {
	const positions: number[] = [];
	const indices: number[] = [];
	const owners: number[] = [];
	const ranges = new Map<BatchedPart, Range>();
	for (const part of parts) {
		const source = part.arrays;
		if (!source?.indices.length || part.drawable.finish === 'line') continue;
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
	const opaque = new Mesh(geometry, materials.opaque);
	opaque.renderOrder = renderOrder(parts[0].drawable);
	const sphere = new Sphere();
	geometry.boundingSphere = sphere;
	return { opaque, geometry, ranges, sphere };
}

function strokeBatches(parts: Iterable<BatchedPart>, materials: Materials) {
	const groups = new Map<
		StrokeSource['kind'],
		{ edges: Edges; rows: number[]; ranges: StrokeRange[] }
	>();
	for (const part of parts) {
		for (const source of part.sources) {
			const group = groups.get(source.kind) ?? {
				edges: { segments: [], fronts: [], backs: [] },
				rows: [],
				ranges: []
			};
			group.ranges.push({ part, source, start: group.edges.segments.length, scale: 1, offset: 0 });
			for (const channel of ['segments', 'fronts', 'backs'] as const)
				for (const value of source.edges[channel]) group.edges[channel].push(value);
			for (let i = 0; i < source.edges.segments.length; i += 6) group.rows.push(part.row);
			groups.set(source.kind, group);
		}
	}
	return Array.from(groups, ([kind, { edges, rows, ranges }]) => {
		const geometry = lineGeometry(edges);
		geometry.setAttribute('aPartIndex', new InstancedBufferAttribute(new Uint32Array(rows), 1));
		const painters = {
			explicit: [materials.front, materials.back],
			edge: [materials.crease, materials.outer],
			grid: [materials.grid],
			rim: [materials.rim]
		}[kind];
		const lines = painters.map((material, index) => {
			const line = new LineSegments2(geometry, material);
			line.renderOrder = kind === 'explicit' ? 5 : 2 + index;
			return line;
		});
		return { geometry, lines, ranges };
	});
}

function refreshStrokes({ geometry, lines, ranges }: ReturnType<typeof strokeBatches>[number]) {
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

/** Sortable ranges borrow GPU attributes from the chunk. The chunk alone disposes the buffers. */
function rangeGeometry(geometry: BufferGeometry, { start, count }: Range) {
	const view = new BufferGeometry();
	view.attributes = { ...geometry.attributes };
	view.setIndex(geometry.index);
	view.setDrawRange(start, count);
	return view;
}

export function packChunk(
	parts: Set<BatchedPart>,
	materials: Materials,
	group: Group,
	smooth: boolean
) {
	const layers: BatchedPart[][] = [[], []];
	for (const part of parts) layers[part.drawable.strokeSegments ? 1 : 0].push(part);
	const fills = layers.flatMap((parts) => fillBatch(parts, materials, smooth) ?? []);
	const strokes = strokeBatches(parts, materials);
	const sorted = new Map<BatchedPart, { body: Mesh; sphere: Sphere; veil?: Mesh }>();
	const box = new Box3();
	const scratch = new Box3();
	for (const { opaque } of fills) group.add(opaque);
	for (const { lines } of strokes) group.add(...lines);

	return {
		refresh() {
			for (const { opaque, geometry, ranges, sphere } of fills) {
				box.makeEmpty();
				for (const [part, range] of ranges) {
					const look = part.look;
					if (!look) continue;
					displayedBounds(part, scratch, look.scale, look.offset);
					if (look.opacity >= 1) box.union(scratch);
					let alpha = sorted.get(part);
					const translucent = look.opacity > 0 && look.opacity < 1;
					if (translucent && !alpha) {
						const view = rangeGeometry(geometry, range);
						const body = new Mesh(view, materials.alpha);
						body.renderOrder = opaque.renderOrder;
						alpha = { body, sphere: new Sphere() };
						view.boundingSphere = alpha.sphere;
						group.add(body);
						sorted.set(part, alpha);
					}
					if (!alpha) continue;
					alpha.body.visible = translucent;
					alpha.body.material =
						part.drawable.finish === 'glass' ? materials.glass : materials.alpha;
					scratch.getBoundingSphere(alpha.sphere);
					if (look.veil && !alpha.veil) {
						alpha.veil = new Mesh(alpha.body.geometry, materials.veil);
						alpha.veil.renderOrder = 6;
						group.add(alpha.veil);
					} else if (!look.veil && alpha.veil) {
						group.remove(alpha.veil);
						alpha.veil = undefined;
					}
				}
				opaque.visible = !box.isEmpty();
				box.getBoundingSphere(sphere);
			}
			for (const stroke of strokes) refreshStrokes(stroke);
		},
		delete() {
			for (const { body } of sorted.values()) {
				body.geometry.attributes = {};
				body.geometry.setIndex(null);
				body.geometry.dispose();
			}
			for (const { geometry } of fills) geometry.dispose();
			for (const { geometry } of strokes) geometry.dispose();
		}
	};
}
