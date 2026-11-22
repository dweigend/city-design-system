import type { TerrainField } from '../surface';
import { slopeSpacing } from './spacing';
import { trackRiver, type ReachFrame } from './frame';
import { skirt } from './skirt';

type Point = { x: number; y: number; z: number; water: number };
type Mesh = { kind: 'mesh'; positions: number[]; indices: number[] };

const stationCount = 160;
const lateralCounts = [26, 12, 8, 12, 26] as const;
const stride = 1 + lateralCounts.reduce((sum, count) => sum + count, 0);
const leftBankIndex = lateralCounts[0] + lateralCounts[1];
const rightBankIndex = leftBankIndex + lateralCounts[2];
const bankMargin = 210;

function shore(frame: ReachFrame, x: number, center: number, outside: number) {
	let wet = center;
	let dry = outside;
	if (frame.sample(x, dry).bank <= 0) return dry;
	for (let i = 0; i < 14; i++) {
		const middle = (wet + dry) / 2;
		if (frame.sample(x, middle).bank > 0) dry = middle;
		else wet = middle;
	}
	return (wet + dry) / 2;
}

function section(
	frame: ReachFrame,
	x: number,
	center: number,
	half: number,
	scale: number,
	field: TerrainField
) {
	const left = shore(frame, x, center, -half);
	const right = shore(frame, x, center, half);
	const cuts = [
		-half,
		Math.max(-half, left - bankMargin),
		left,
		right,
		Math.min(half, right + bankMargin),
		half
	];
	const points: Point[] = [];
	const sample = (y: number) => {
		const { height, water } = frame.sample(x, y);
		points.push({ x, y, z: height * scale, water: water * scale });
	};
	sample(-half);
	for (const [band, count] of lateralCounts.entries()) {
		const from = cuts[band];
		const to = cuts[band + 1];
		const offsets =
			band === 0 || band === lateralCounts.length - 1
				? slopeSpacing(field, x, from, to, count)
				: Array.from({ length: count }, (_, i) => from + ((to - from) * (i + 1)) / count);
		for (const y of offsets) sample(y);
	}
	for (const index of [leftBankIndex, rightBankIndex]) {
		const point = points[index];
		if (Math.abs(point.y) < half) point.z = point.water;
	}
	return points;
}

function mesh(positions: number[] = []): Mesh {
	return { kind: 'mesh', positions, indices: [] };
}

function capWater(west: readonly Point[], east: readonly Point[]) {
	const cut = mesh();
	for (const points of [west, east]) {
		const base = cut.positions.length / 3;
		for (const { x, y, z, water } of points) cut.positions.push(x, y, water, x, y, z);
		for (let index = 1; index < points.length; index++) {
			const a = base + (index - 1) * 2;
			const b = a + 2;
			if (points === west) cut.indices.push(a, a + 1, b, b, a + 1, b + 1);
			else cut.indices.push(a, b, a + 1, b, b + 1, a + 1);
		}
	}
	return cut;
}

export function terrainMeshes(frame: ReachFrame, scale: number, field: TerrainField) {
	const riverAt = trackRiver(frame.course);
	const points = Array.from({ length: stationCount + 1 }, (_, row) => {
		const x = (row / stationCount - 0.5) * frame.length;
		const half = field.depth / 2;
		const center = Math.min(half, Math.max(-half, riverAt(x)));
		return section(frame, x, center, half, scale, field);
	}).flat();
	const ground = mesh(points.flatMap(({ x, y, z }) => [x, y, z]));
	const water = mesh();
	let lowest = Infinity;
	for (let row = 0; row <= stationCount; row++) {
		const begin = row * stride;
		for (const at of [leftBankIndex, rightBankIndex]) {
			const p = points[begin + at];
			water.positions.push(p.x, p.y, p.water);
		}
		if (row === stationCount) break;
		const a = row * 2;
		water.indices.push(a, a + 2, a + 1, a + 2, a + 3, a + 1);
		for (let column = 0; column < stride - 1; column++) {
			const s = begin + column;
			const t = s + stride;
			ground.indices.push(s, t, s + 1, t, t + 1, s + 1);
		}
	}
	for (const { z } of points) lowest = Math.min(lowest, z);
	const bed = (row: number) =>
		points.slice(row * stride + leftBankIndex, row * stride + rightBankIndex + 1);
	return [
		{ id: 'ground', slot: 'ground', shape: ground },
		{ id: 'earth', slot: 'earth', shape: skirt(points, stride, stationCount, lowest - 7 * scale) },
		{ id: 'river', slot: 'water', shape: water },
		{ id: 'river-cut', slot: 'water-section', shape: capWater(bed(0), bed(stationCount)) }
	];
}
