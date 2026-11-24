import type { TerrainField } from '../surface';
import type { ReachFrame } from './frame';
import { sectionCuts } from './sections';
import { skirt } from './skirt';
import { slopeSpacing } from './spacing';
import { mesh, waterSections, waterSurface, type Mesh, type SectionPoint } from './water';

type Water = ReturnType<typeof waterSurface>;

function section(
	frame: ReachFrame,
	x: number,
	scale: number,
	field: TerrainField,
	count: number,
	polygons: Water['polygons']
) {
	const half = field.depth / 2;
	const crossings = sectionCuts(polygons, x);
	const regular = [-half, ...slopeSpacing(field, x, -half, half, count)];
	const points: SectionPoint[] = [];
	for (const y of regular) {
		if (crossings.some(({ across }) => Math.abs(y - across) < 0.03)) continue;
		const { height, water } = frame.sample(x, y);
		const index = crossings.findIndex(({ across }) => across >= y);
		const next = crossings[index];
		const previous = crossings[index - 1];
		if (next && previous && previous.bankSide !== 1) {
			const t = (y - previous.across) / (next.across - previous.across);
			const surface = previous.water + (next.water - previous.water) * t;
			points.push({
				x,
				y,
				z: Math.min(height * scale, surface - 0.015 * scale),
				water: surface,
				bankSide: 0
			});
		} else {
			points.push({ x, y, z: height * scale, water: water * scale, bankSide: 0 });
		}
	}
	for (const { across, water, bank, bankSide } of crossings) {
		const y = Math.min(half, Math.max(-half, across));
		const { height } = frame.sample(x, y);
		const edge = Math.abs(y) === half || Math.abs(x) === field.width / 2;
		points.push({
			x,
			y,
			water,
			bankSide,
			z: bank && !edge ? water : Math.min(water, height * scale)
		});
	}
	points.sort((a, b) => a.y - b.y);
	return points;
}

type Row = readonly SectionPoint[];

function banks(row: Row) {
	const spans: { a: number; b: number; middle: number }[] = [];
	let start = 0;
	for (let i = 0; i < row.length; i++) {
		if (row[i].bankSide < 0) start = i;
		if (row[i].bankSide > 0) spans.push({ a: start, b: i, middle: (row[start].y + row[i].y) / 2 });
	}
	return spans;
}

function matchBanks(left: Row, right: Row) {
	const anchors: [number, number][] = [];
	const a = banks(left);
	const b = banks(right);
	const reach = 1.5 * (right[0].x - left[0].x) + 12;
	let i = 0;
	let j = 0;
	while (i < a.length && j < b.length) {
		const delta = a[i].middle - b[j].middle;
		if (delta < -reach) i++;
		else if (delta > reach) j++;
		else {
			anchors.push([a[i].a, b[j].a], [a[i].b, b[j].b]);
			i++;
			j++;
		}
	}
	anchors.push([left.length - 1, right.length - 1]);
	return anchors;
}

function join(ground: Mesh, left: Row, right: Row, start: number) {
	const middle = start + left.length;
	let a = 0;
	let b = 0;
	for (const [endA, endB] of matchBanks(left, right)) {
		const beginA = left[a].y;
		const beginB = right[b].y;
		const rangeA = left[endA].y - beginA || 1;
		const rangeB = right[endB].y - beginB || 1;
		while (a < endA || b < endB) {
			const nextA = a < endA ? (left[a + 1].y - beginA) / rangeA : Infinity;
			const nextB = b < endB ? (right[b + 1].y - beginB) / rangeB : Infinity;
			if (nextA <= nextB) {
				ground.indices.push(start + a, middle + b, start + a + 1);
				a++;
			} else {
				ground.indices.push(start + a, middle + b, middle + b + 1);
				b++;
			}
		}
	}
}

function groundMesh(rows: readonly (readonly SectionPoint[])[]) {
	const result = mesh();
	let offset = 0;
	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		for (const { x, y, z } of row) result.positions.push(x, y, z);
		if (i + 1 < rows.length) join(result, row, rows[i + 1], offset);
		offset += row.length;
	}
	return result;
}

function stations(
	frame: ReachFrame,
	field: TerrainField,
	count: number,
	polygons: Water['polygons']
) {
	const step = frame.length / count;
	const regular = Array.from({ length: count + 1 }, (_, i) => i * step - frame.length / 2);
	const edgeCrossings = polygons.flatMap((polygon) =>
		polygon.filter(([, y]) => Math.abs(Math.abs(y) - field.depth / 2) < 1e-7).map(([x]) => x)
	);
	return [...regular, ...edgeCrossings]
		.sort((a, b) => a - b)
		.filter(
			(x, i, xs) => i === 0 || i === xs.length - 1 || (x - xs[i - 1] > 0.15 && xs[i + 1] - x > 0.15)
		);
}

export function terrainMeshes(
	frame: ReachFrame,
	scale: number,
	field: TerrainField,
	water: Water,
	budget: number
) {
	const count = Math.max(32, Math.min(136, Math.ceil(field.width / 58)));
	const lateral = Math.min(
		75,
		Math.max(26, Math.floor((budget - water.surface.indices.length / 3 - 3200) / (count * 2)) - 14)
	);
	const rows = stations(frame, field, count, water.polygons).map((x) =>
		section(frame, x, scale, field, lateral, water.polygons)
	);
	const sides = [
		rows.map((row) => row[0]),
		rows[rows.length - 1],
		rows.map((row) => row[row.length - 1]).reverse(),
		[...rows[0]].reverse()
	];
	let lowest = Infinity;
	for (const row of rows) for (const { z } of row) lowest = Math.min(lowest, z);
	const parts = [
		{ id: 'ground', slot: 'ground', shape: groundMesh(rows) },
		{ id: 'earth', slot: 'earth', shape: skirt(sides, lowest - 7 * scale) }
	];
	if (water.surface.indices.length)
		parts.push({ id: 'river', slot: 'water', shape: water.surface });
	const cut = waterSections(sides);
	if (cut.indices.length) parts.push({ id: 'river-cut', slot: 'water-section', shape: cut });
	return parts;
}
