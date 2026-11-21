import { STORY } from '../data/grid';
import { openingScene, prepareAdvance } from '../logic/sandbox';
import { isolinien } from '../logic/modellierung/feld';
import { terrainHeight } from '../logic/terrain';
import { bankHeight, cellAtPoint } from '../logic/terrain-grid';
import { required } from '../logic/required';
import type { Point2 } from '../logic/parametrik/vocab';

// Fixed survey window around the western court of the seed-7 opening.
const origin = [-20, -107];
const cutY = -106;
const local = ([x, y]: readonly number[]): Point2 => [x - origin[0], y - origin[1]];
const round = (x: number) => Math.round(x * 100) / 100;

function cutSpan(ring: readonly (readonly number[])[]) {
	const crossings = ring.flatMap(([x, y], i) => {
		const [u, v] = ring[(i + 1) % ring.length];
		return y < cutY !== v < cutY ? [x + ((cutY - y) * (u - x)) / (v - y)] : [];
	});
	return crossings.length === 2 ? crossings.sort((a, b) => a - b) : undefined;
}

function survey() {
	const before = openingScene(7).world;
	const after = prepareAdvance(before).finish();
	const group = required(before.state.city?.centres[0].ensembles[0], 'western court');
	const plaza = required(group.plaza, 'reserved square').polygon;
	const nearby = before.grid.cells.filter(
		({ center }) => Math.abs(center[0] - origin[0]) < 48 && Math.abs(center[1] - origin[1]) < 24
	);
	const blocks: number[] = [];
	const lots: { polygon: Point2[]; added: boolean; removed: boolean }[] = [];
	const buildings = [];
	for (const cell of nearby) {
		cell.neighbors.forEach((id, i) => {
			if (id && id < cell.id) return;
			if (id && before.grid.cellsById.get(id)?.block === cell.block) return;
			blocks.push(...local(cell.corners[i]), ...local(cell.corners[(i + 1) % 4]));
		});
		const beforeStories = before.state.stacks.get(cell.id)?.length;
		const stories = after.state.stacks.get(cell.id)?.length;
		if (!stories && !beforeStories) continue;
		const ring = cell.lotCorners ?? cell.corners;
		const added = !beforeStories;
		const removed = !stories;
		lots.push({ polygon: ring.map(local), added, removed });
		if (!stories) continue;
		const span = cutSpan(ring);
		if (span && span[0] >= -42 && span[1] <= 2)
			buildings.push({ left: span[0], right: span[1], pad: cell.pad, stories, added });
	}
	const height = (x: number, y: number) => terrainHeight(before.grid.terrain, x, y);
	const contours = Array.from({ length: 13 }, (_, i) => 2 + i / 2).flatMap((level) =>
		isolinien(
			(u, v) => height(origin[0] + (u - 50) * 0.9, origin[1] + (v - 50) * 0.44),
			level,
			48
		).flatMap((line) => line.flatMap(([u, v]) => [round((u - 50) * 0.9), round((v - 50) * 0.44)]))
	);
	const terrain = Array.from({ length: 89 }, (_, i) => {
		const x = -42 + i / 2;
		const cell = required(cellAtPoint(after.grid, x, cutY), 'section ground');
		return [x, round(cell.bank ? bankHeight(cell, x, cutY) : height(x, cutY))];
	});
	return {
		beforeYear: before.state.year,
		afterYear: after.state.year,
		blocks,
		contours,
		lots,
		plaza: plaza.map(local),
		cut: { left: local([-42, cutY]), right: local([2, cutY]) },
		section: {
			terrain,
			buildings,
			square: required(cutSpan(plaza), 'square section'),
			story: STORY,
			envelope: Math.max(...group.heights) * STORY + Math.max(...buildings.map((b) => b.pad))
		}
	};
}

let cached: ReturnType<typeof survey> | undefined;

/** Returns the two survey dates and a section from the same generated court. */
export function courtStudy() {
	return (cached ??= survey());
}

export type CourtStudy = ReturnType<typeof courtStudy>;
