import { terrainHeight } from '../terrain';
import { WALKWAY_WIDTH_M } from '../walkway';
import { HOCHWEG_M } from '../../data/stadtHochwege';
import { routeSlope } from '../megastructure';
import type { TerrainCell, TerrainGrid } from '../terrain-grid';
import type { Vec3 } from '../parametrik/types';
import {
	position,
	rejected,
	type Anchor,
	type Installation,
	type Proposal
} from './installation-parts';

const distance = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const address = (c: TerrainCell, vertex: number, z: number): Anchor => ({
	cellId: c.id,
	level: 0,
	vertex,
	lift: z - c.pad
});
const span = (cell: TerrainCell, other: TerrainCell) => distance(cell.corners[0], other.corners[0]);

function supports(cells: TerrainCell[]) {
	const seats = [cells[0]];
	for (const cell of cells.slice(1)) {
		const previous = seats[seats.length - 1];
		if (span(previous, cell) >= 6) seats.push(cell);
	}
	const end = cells[cells.length - 1];
	if (seats.length > 1 && seats.at(-1) !== end) seats[seats.length - 1] = end;
	return seats;
}

// The level plaza meets the uphill edge of its terrain footprint.
function plazaHeight(grid: TerrainGrid, [x, y]: Vec3) {
	const corners = [-WALKWAY_WIDTH_M, WALKWAY_WIDTH_M];
	return (
		Math.max(
			...corners.flatMap((dx) => corners.map((dy) => terrainHeight(grid.terrain, x + dx, y + dy)))
		) + 0.08
	);
}

// Survey outward rows of real lattice edges. Each row loses the same share of
// the deck's elevation above terrain. Cross-links allow the flight to turn on steep ground.
function surveyApproach(grid: TerrainGrid, end: TerrainCell, inner: TerrainCell, z: number) {
	const dx = end.column - inner.column,
		dy = end.row - inner.row;
	const along = Math.abs(dx) >= Math.abs(dy);
	const dir = Math.sign(along ? dx : dy);
	const locate = (row: number, col: number) =>
		grid.cellsById.get(
			end.column + (along ? row * dir : col - 1) + '/' + (end.row + (along ? col - 1 : row * dir))
		);
	const anchors: Anchor[] = [],
		links: [number, number][] = [];
	for (let n = 0; n < 18; n++) {
		const row = Math.floor(n / 3),
			col = n % 3;
		const cell = locate(row, col);
		if (!cell || cell.zone === 'water') return;
		const ground = row === 5 ? plazaHeight(grid, cell.corners[0]) : cell.corners[0][2];
		anchors.push(address(cell, 0, ground + (z - end.corners[0][2]) * (1 - row / 5)));

		if (row) links.push([n - 3, n]);
		if (col) links.push([n - 1, n]);
	}
	return { anchors, links };
}

function approach(
	grid: TerrainGrid,
	end: TerrainCell,
	inner: TerrainCell,
	z: number
): Installation[] | undefined {
	const survey = surveyApproach(grid, end, inner, z);
	if (!survey) return;
	const { anchors, links } = survey;
	const route = routeSlope({ points: anchors.map((a) => position(grid, a)), links }, 1, 16);
	if (!route) return;
	return route.nodes.flatMap((node, i): Installation[] => {
		const anchor = anchors[node];
		const plaza = i === route.nodes.length - 1;
		const landing: Installation = { kind: 'stop', recipe: plaza ? 'plaza' : 'landing', anchor };
		return i
			? [
					{ kind: 'segment', recipe: 'stair', anchor: anchors[route.nodes[i - 1]], end: anchor },
					landing
				]
			: [landing];
	});
}

function straightThrough(seats: TerrainCell[]) {
	let blocks = new Set([seats[0].block]);
	let heading: number | undefined;
	for (const [i, b] of seats.slice(1).entries()) {
		const a = seats[i],
			angle = Math.atan2(b.row - a.row, b.column - a.column);
		if (heading === undefined || Math.cos(angle - heading) < Math.cos(Math.PI / 8)) {
			blocks = new Set([a.block]);
			heading = angle;
		}
		blocks.add(b.block);
		if (blocks.size >= 3) return true;
	}
	return false;
}

/** Plans supported 6–18 meter spans, a surveyed descent and a square at each end. */
export function walkwayStroke(grid: TerrainGrid, cells: TerrainCell[]): Proposal {
	const seats = supports(cells);
	if (seats.length < 2) return rejected('short-span', cells);
	if (straightThrough(seats)) return rejected('straight-three-blocks', seats);
	const z = seats[0].corners[0][2] + HOCHWEG_M;
	const parts: Installation[] = [];
	for (const [i, c] of seats.entries()) {
		if (c.zone === 'water') return rejected('wet-support', [c]);
		const anchor = address(c, 0, z);
		if (z <= c.corners[0][2]) return rejected('buried-deck', [c]);
		if (i) {
			const length = span(seats[i - 1], c);
			if (length < 6 || length > 18) return rejected('unsupported-span', [seats[i - 1], c]);
			parts.push({
				kind: 'segment',
				recipe: 'walkway',
				anchor: address(seats[i - 1], 0, z),
				end: anchor
			});
		}
		parts.push({ kind: 'pillar', recipe: 'support', anchor });
	}
	for (const [end, inner] of [
		[seats[0], seats[1]],
		[seats[seats.length - 1], seats[seats.length - 2]]
	]) {
		const flight = approach(grid, end, inner, z);
		if (!flight) return rejected('no-stair-route', [end]);
		parts.push(...flight);
	}
	return { parts };
}
