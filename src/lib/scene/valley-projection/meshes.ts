import type { TerrainField } from '../surface';
import { slopeSpacing } from './spacing';
import { trackRiver, type ReachFrame } from './frame';
import { borderSides, skirt } from './skirt';
import { waterSections, waterSurface } from './water';

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
	// Rows whose tracked river centre is dry, as in a crosswise window, keep their sampled heights.
	if (frame.sample(x, center).bank > 0) return points;
	for (const index of [leftBankIndex, rightBankIndex]) {
		const point = points[index];
		if (Math.abs(point.y) < half) point.z = point.water;
	}
	return points;
}

function mesh(positions: number[] = []): Mesh {
	return { kind: 'mesh', positions, indices: [] };
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
	for (let row = 0; row < stationCount; row++) {
		for (let column = 0; column < stride - 1; column++) {
			const s = row * stride + column;
			const t = s + stride;
			ground.indices.push(s, t, s + 1, t, t + 1, s + 1);
		}
	}
	const lowest = points.reduce((low, { z }) => Math.min(low, z), Infinity);
	return [
		{ id: 'ground', slot: 'ground', shape: ground },
		{ id: 'earth', slot: 'earth', shape: skirt(points, stride, stationCount, lowest - 7 * scale) },
		{ id: 'river', slot: 'water', shape: waterSurface(frame, field.depth, scale) },
		{
			id: 'river-cut',
			slot: 'water-section',
			shape: waterSections(borderSides(points, stride, stationCount))
		}
	];
}
