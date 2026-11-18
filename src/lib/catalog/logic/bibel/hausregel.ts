/**
 * Comparison plate "one house rule, any grid": the same building program painted onto three
 * carriers — a square grid, the irregular quads of the corner-grid fan, and terrain cells
 * that follow the contours on a slope. The house brush reads only the quad carrier contract,
 * so nothing in the rule knows which grid it stands on.
 */
import {
	houseChunk,
	HOUSE_STYLES,
	raise,
	type HouseStyle,
	type HouseUse,
	type Stacks
} from '../house-brush';
import { createPatch } from '../parametrik/eckraster/topology';
import type { Primitive, Vec3 } from '../parametrik/types';
import { quadGrid, squareGrid, type QuadCell, type QuadGrid } from '../quad-grid';
import { createTerrain } from '../terrain';
import { deriveGrid } from '../terrain-grid';

const SEED = 7;
/** Cut-out of the terrain grid at the creek, where rows bend most: first row and size in cells. */
const SLOPE_WINDOW = { row: 52, size: 9 };
/** Module of the terrain lattice, meters. */
const MODULE = 5;

/** Building program in shares of the grid's bounding box: region, use and stories. */
const PROGRAM: { u: [number, number]; v: [number, number]; use: HouseUse; stories: number }[] = [
	{ u: [0.12, 0.78], v: [0.14, 0.36], use: 'living', stories: 2 },
	{ u: [0.12, 0.3], v: [0.14, 0.36], use: 'living', stories: 2 },
	{ u: [0.58, 0.78], v: [0.36, 0.72], use: 'water', stories: 1 },
	{ u: [0.14, 0.4], v: [0.6, 0.86], use: 'food', stories: 1 },
	{ u: [0.44, 0.52], v: [0.52, 0.6], use: 'energy', stories: 1 },
	{ u: [0.82, 0.98], v: [0.78, 0.98], use: 'material', stories: 1 }
];

export type RulePlate = { id: string; title: string; text: string; primitives: Primitive[] };

/** Recenters cells around the origin and sets their lowest ground to zero. */
function recenter(cells: readonly QuadCell[]): QuadCell[] {
	const xs = cells.flatMap((cell) => cell.corners.map((corner) => corner[0]));
	const ys = cells.flatMap((cell) => cell.corners.map((corner) => corner[1]));
	const dx = (Math.min(...xs) + Math.max(...xs)) / 2;
	const dy = (Math.min(...ys) + Math.max(...ys)) / 2;
	const dz = Math.min(...cells.map((cell) => cell.pad));
	const move = ([x, y, z]: Vec3): Vec3 => [x - dx, y - dy, z - dz];
	const ids = new Set(cells.map((cell) => cell.id));
	const kept = (id: string | null) => (id !== null && ids.has(id) ? id : null);
	const [n0, n1, n2, n3] = [0, 1, 2, 3] as const;
	return cells.map((cell, index) => ({
		...cell,
		index,
		corners: [
			move(cell.corners[0]),
			move(cell.corners[1]),
			move(cell.corners[2]),
			move(cell.corners[3])
		],
		center: move(cell.center),
		neighbors: [
			kept(cell.neighbors[n0]),
			kept(cell.neighbors[n1]),
			kept(cell.neighbors[n2]),
			kept(cell.neighbors[n3])
		],
		pad: cell.pad - dz + 0.5,
		chunk: 'plate'
	}));
}

/** The quads of the corner-grid fan as a carrier: flat ground, one chunk. */
function fanGrid(): QuadGrid {
	const patch = createPatch(42);
	const points = new Map(patch.vertices.map((vertex) => [vertex.id, vertex.point]));
	const corner = (id: string): Vec3 => {
		const [x, y] = points.get(id) ?? [0, 0];
		return [x, y, 0];
	};
	return quadGrid(
		patch.faces.map((face, index): QuadCell => {
			const corners = [
				corner(face.vertices[0]),
				corner(face.vertices[1]),
				corner(face.vertices[2]),
				corner(face.vertices[3])
			] as const;
			return {
				id: face.id,
				index,
				corners,
				vertexIds: face.vertices,
				center: [
					(corners[0][0] + corners[1][0] + corners[2][0] + corners[3][0]) / 4,
					(corners[0][1] + corners[1][1] + corners[2][1] + corners[3][1]) / 4,
					0
				],
				neighbors: [face.neighbors[0], face.neighbors[1], face.neighbors[2], face.neighbors[3]],
				pad: 0.5,
				raised: false,
				buildable: true,
				chunk: 'plate'
			};
		})
	);
}

/** Terrain cells at the creek, where the rows follow the contours into the notch. */
function slopeGrid(): QuadGrid {
	const grid = deriveGrid(createTerrain({ seed: SEED }));
	const { row, size } = SLOPE_WINDOW;
	const column0 = Math.round(grid.terrain.creekAlong / MODULE) - Math.floor(size / 2);
	const cells = grid.cells.filter(
		(cell) =>
			cell.column >= column0 &&
			cell.column < column0 + size &&
			cell.row >= row &&
			cell.row < row + size
	);
	return quadGrid(recenter(cells));
}

const within = (value: number, [from, to]: [number, number]) => value >= from && value <= to;

/** Paints the program: every cell whose center lies in a region gets its stories. */
function paint(grid: QuadGrid): Stacks {
	const xs = grid.cells.map((cell) => cell.center[0]);
	const ys = grid.cells.map((cell) => cell.center[1]);
	const [x0, y0] = [Math.min(...xs), Math.min(...ys)];
	const [width, depth] = [Math.max(...xs) - x0, Math.max(...ys) - y0];
	let stacks: Stacks = new Map();
	for (const { u, v, use, stories } of PROGRAM) {
		const inRegion = grid.cells.filter(
			(cell) => within((cell.center[0] - x0) / width, u) && within((cell.center[1] - y0) / depth, v)
		);
		for (const cell of inRegion)
			for (let story = 0; story < stories; story++) stacks = raise(stacks, cell.id, use);
	}
	return stacks;
}

/** Cell outlines as plan lines, so the carrier stays visible under the houses. */
const outlines = (grid: QuadGrid): Primitive[] =>
	grid.cells.map((cell) => ({
		id: `${cell.id}:outline`,
		kind: 'polyline',
		role: 'neu',
		token: '--paper',
		material: 'concrete',
		closed: true,
		points: cell.corners.map(([x, y, z]): Vec3 => [x, y, z])
	}));

function plate(id: string, title: string, text: string, grid: QuadGrid): RulePlate {
	const houses = [...grid.chunks.keys()].flatMap((chunk) =>
		houseChunk(grid, paint(grid), chunk, SEED)
	);
	return { id, title, text, primitives: [...outlines(grid), ...houses] };
}

/** The three plates, in reading order. Deterministic; detached primitives in meters. */
export function rulePlates(): RulePlate[] {
	return [
		plate('square', 'Square grid', 'Orthogonal cells of 5 m.', squareGrid(9, 9, 5)),
		plate('fan', 'Corner grid', 'Irregular quads of the five-sector fan.', fanGrid()),
		plate('slope', 'Terrain grid', 'Cells that follow the contours at the creek.', slopeGrid())
	];
}

const STYLE_TITLES: Record<HouseStyle, string> = {
	terrace: 'Terrace',
	totem: 'Totem',
	megastructure: 'Megastructure',
	collage: 'Collage'
};

/**
 * Style study: the same building program on the same terrain cells, once per look of the
 * house rule. Deterministic; detached primitives in meters.
 */
export function stylePlates(): RulePlate[] {
	const grid = slopeGrid();
	const stacks = paint(grid);
	return HOUSE_STYLES.map((style) => ({
		id: style,
		title: STYLE_TITLES[style],
		text: 'Same cells, same program.',
		primitives: [
			...outlines(grid),
			...[...grid.chunks.keys()].flatMap((chunk) => houseChunk(grid, stacks, chunk, SEED, style))
		]
	}));
}
