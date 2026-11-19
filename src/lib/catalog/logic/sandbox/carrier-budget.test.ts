// @ts-expect-error Bun supplies the test API.
import { expect, spyOn, test } from 'bun:test';
import type { Vec3 } from '../parametrik/types';
import { quadGrid, type QuadCell } from '../quad-grid';
import { buildingPlots } from './building-plots';
import { probeWallConnections } from './carrier-diagonals';
import * as finalValidator from './carrier-probe';
import { beginStroke, createWorld, extendStroke, withState } from './index';
import { position, type Anchor, type Installation } from './installation-parts';

const town = createWorld(7);
const tool = { kind: 'house', style: 'megastructure', use: 'water' } as const;
const plots = buildingPlots(town.grid);
const ids = ['83/47', '86/47', '87/47'];
const templateCells = ids.map((id) => {
	const cell = plots.cellsById.get(id);
	if (!cell) throw new Error('Missing carrier plot ' + id);
	return cell;
});
const frame = [ids[0], ids[2]].reduce(extendStroke, beginStroke(tool, town)).draft;
const template = [...frame.state.parts.values()];
const posts = template.filter((p) => p.recipe === 'chord' && p.anchor.cellId === p.end.cellId);
const crowns = posts.map((p) => {
	if (p.kind !== 'segment') throw new Error('Missing crown');
	return p.end;
});
const start = position(plots, crowns[0]),
	end = position(plots, crowns[2]);

function singularCarrier(groups: number) {
	const cells: QuadCell[] = [],
		parts: Installation[] = [];
	const anchor = (a: Anchor, i: number) => ({ ...a, cellId: i + ':' + a.cellId });
	for (let i = 0; i <= groups; i++) {
		const shift = ([x, y, z]: Vec3): Vec3 => [
			x + i * (end[0] - start[0] + 5),
			y + i * (end[1] - start[1]),
			z
		];
		for (const cell of i === groups ? templateCells.slice(0, 1) : templateCells) {
			const [a, b, c, d] = cell.corners;
			cells.push({
				...cell,
				id: i + ':' + cell.id,
				index: cells.length,
				center: shift(cell.center),
				corners: [shift(a), shift(b), shift(c), shift(d)]
			});
		}
		if (i)
			parts.push({
				kind: 'segment',
				recipe: 'chord',
				anchor: anchor(crowns[2], i - 1),
				end: anchor(crowns[0], i)
			});
		if (i === groups) {
			const foot = anchor(posts[0].anchor, i);
			parts.push(
				{ kind: 'pillar', recipe: 'bearing', anchor: foot },
				{ kind: 'segment', recipe: 'chord', anchor: foot, end: anchor(crowns[0], i) }
			);
			break;
		}
		for (const part of template) {
			// Restore the original 16.738 m forward diagonal in each three-roof group.
			const foot =
				part.recipe === 'brace' && part.end.cellId === ids[1] && part.anchor.cellId !== ids[1]
					? posts[0].anchor
					: part.anchor;
			parts.push(
				part.kind === 'segment'
					? { ...part, anchor: anchor(foot, i), end: anchor(part.end, i) }
					: { ...part, anchor: anchor(foot, i) }
			);
		}
	}
	return { grid: quadGrid(cells), cells, parts };
}

function measure(label: string, moves: (() => void)[]) {
	for (let i = 0; i < 12; i++) for (const move of moves) move();
	const times: number[] = [];
	for (let i = 0; i < 30; i++)
		for (const move of moves) {
			const start = performance.now();
			move();
			times.push(performance.now() - start);
		}
	times.sort((a, b) => a - b);
	const max = times[times.length - 1];
	console.info(
		label,
		'p95',
		times[Math.ceil(times.length * 0.95) - 1].toFixed(2),
		'max',
		max.toFixed(2),
		'ms'
	);
	expect(max).toBeLessThan(16);
}

for (const groups of [5, 6])
	test('bounded repair of a singular ' + groups + '-group carrier', () => {
		const { grid, cells, parts } = singularCarrier(groups);
		expect(parts.length).toBe(groups * 17 + 2);
		const move = () => probeWallConnections(grid, parts, cells);
		const probe = spyOn(finalValidator, 'carrierProbe');
		try {
			expect(move()).toMatchObject({ failure: { reason: 'wall-layout-unresolved' } });
			expect(probe).toHaveBeenCalledTimes(2);
		} finally {
			probe.mockRestore();
		}
		measure(groups + ' groups', [move]);
	});

test('each pointer move along a ten-roof stroke fits one frame', () => {
	const roofs = Array.from({ length: 10 }, (_, i) => 30 + 2 * i + '/40');
	const world = withState(town, {
		...town.state,
		stacks: new Map(roofs.map((id) => [id, ['living'] as const]))
	});
	let stroke = beginStroke(tool, world);
	const moves = roofs.map((id) => {
		const previous = stroke;
		const move = () => extendStroke(previous, id);
		stroke = move();
		return move;
	});
	expect(stroke.failure).toBeUndefined();
	expect(stroke.draft.state.parts.size).toBeGreaterThan(0);
	measure('ten roofs', moves);
});
