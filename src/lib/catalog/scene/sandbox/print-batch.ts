import { Float32BufferAttribute, type Color } from 'three/webgpu';
import type { Primitive } from '../../logic/parametrik/types';
import { isPathInk } from '../../logic/farbe/overprint';
import { batch, geometryOf, type Batch } from '../batch';
import { castOffset } from './printed-finish';

type Faces = Batch['neu'];
type Range = { start: number; part: Primitive };
const kinds = ['neu', 'blatt', 'glas'] as const;
const attributes = new WeakMap<Faces, { screen: number[]; offset: number[]; outline: number }>();

function shadowDistance(part: Primitive, positions: number[], start: number, end: number) {
	if (part.overprint || !part.envelope || part.token === '--ink' || isPathInk(part.token)) return 0;
	let low = Infinity,
		high = -Infinity;
	for (let i = start * 3 + 1; i < end * 3; i += 3) {
		low = Math.min(low, positions[i]);
		high = Math.max(high, positions[i]);
	}
	return castOffset(high - low);
}

function printAttributes(faces: Faces, ranges: Range[]) {
	const screen: number[] = [],
		offset: number[] = [];
	let outline = faces.p.length / 3;
	ranges.forEach(({ start, part }, index) => {
		const end = ranges[index + 1]?.start ?? faces.p.length / 3;
		if (end === start) return;
		if (part.overprint) outline = Math.min(outline, start);
		const dots = Number(!part.overprint && !isPathInk(part.token) && part.token !== '--ink');
		const shift = shadowDistance(part, faces.p, start, end);
		for (let i = start; i < end; i++) {
			screen.push(dots);
			offset.push(shift);
		}
	});
	attributes.set(faces, { screen, offset, outline });
}

/** Batches opaque surfaces, keeping contour-free ink patches at the end of each face array. */
export function printBatch(parts: Primitive[], colorOf: (part: Primitive) => Color) {
	const patches = parts.filter((p) => p.overprint);
	const ordered = patches.length ? parts.filter((p) => !p.overprint).concat(patches) : parts;
	const ranges = { neu: [] as Range[], blatt: [] as Range[], glas: [] as Range[] };
	const result = batch(ordered, colorOf, true, (part, out) => {
		for (const key of kinds) ranges[key].push({ start: out[key].p.length / 3, part });
	});
	for (const key of kinds) printAttributes(result[key], ranges[key]);
	return result;
}

/** Builds the scene geometry with optional print and cast data baked beside the vertex colors. */
export function printGeometry(faces: Faces) {
	const geometry = geometryOf(faces);
	const print = attributes.get(faces);
	if (!print) return geometry;
	geometry.setAttribute('printScreen', new Float32BufferAttribute(print.screen, 1));
	geometry.setAttribute('printOffset', new Float32BufferAttribute(print.offset, 1));
	geometry.userData.outlineVertices = print.outline;
	return geometry;
}
