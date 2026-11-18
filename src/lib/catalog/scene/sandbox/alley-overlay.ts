import * as THREE from 'three/webgpu';
import { attribute, float, mix, texture, vec2 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { MODULE, type TerrainCell, type TerrainGrid } from '../../logic/terrain-grid';
import { pushThree } from '../world-space';

function frontages(next: TerrainGrid, houses: Iterable<string>, radius: number) {
	const occupied = new Set<number>();
	for (const id of houses) {
		const cell = next.cellsById.get(id);
		if (!cell) continue;
		markFrontage(next, cell, radius, occupied);
	}
	return occupied;
}

function markFrontage(next: TerrainGrid, cell: TerrainCell, radius: number, occupied: Set<number>) {
	for (let y = Math.max(0, cell.row - radius); y <= Math.min(next.rows - 1, cell.row + radius); y++)
		for (
			let x = Math.max(0, cell.column - radius);
			x <= Math.min(next.columns - 1, cell.column + radius);
			x++
		)
			occupied.add(y * next.columns + x);
}

/** Nearest-cell mask for alley widths, stair treads and occupied frontages. */
export function alleyOverlay(grid: TerrainGrid, profile: Readonly<Record<keyof typeof import("./view-params").TERRAIN_VIEW_PARAMS, number>>, nodes: { treadsPerCell: Node<"float">, cityInk: Node<"float">, emptyInk: Node<"float"> }) {
	const pixels = new Uint8Array(grid.cells.length * 4);
	const map = new THREE.DataTexture(pixels, grid.columns, grid.rows);
	let current = grid;
	let anchors: string[] = [];
	function update(next: TerrainGrid, houses: Iterable<string>) {
		current = next;
		anchors = [...houses];
		const occupied = frontages(next, anchors, profile.cityRadiusCells);
		for (const cell of next.cells) {
			const { square, width, stairAlley } = cell.plan;
			const band = Math.min(255, Math.round((255 * width) / MODULE));
			const channel = (axis: 'along' | 'across') =>
				square ? 255 : cell.alley === axis || cell.alley === 'both' ? band : 0;
			pixels.set(
				[
					channel('along'),
					channel('across'),
					(stairAlley ? 128 : 0) + (occupied.has(cell.index) ? 64 : 0),
					255 * cell.plan.extent
				],
				cell.index * 4
			);
		}
		map.needsUpdate = true;
	}
	update(grid, []);
	return {
		update,
		setParams(next: typeof profile) {
			const changed = next.cityRadiusCells !== profile.cityRadiusCells;
			profile = next;
			if (changed) update(current, anchors);
		},
		dispose: () => map.dispose(),
		shade(ground: Node<'vec3'>, ink: Node<'vec3'>, people: Node<'color'>, weight: Node<'float'>) {
			const chart = attribute('chart', 'vec2');
			const mask = texture(map, chart.div(vec2(grid.columns, grid.rows)));
			const dist = chart.fract().sub(0.5).abs().mul(2);
			const band = (distance: Node<'float'>, width: Node<'float'>) =>
				float(1)
					.sub(distance.smoothstep(width.sub(distance.fwidth()), width.add(distance.fwidth())))
					.mul(float(width.greaterThan(0)));
			const coverage = band(dist.x, mask.g).max(band(dist.y, mask.r));
			const stairs = float(mask.b.greaterThanEqual(0.5));
			const occupied = mask.b.mul(255).div(64).round().mod(2);
			const tread = chart.y.mul(nodes.treadsPerCell).fract().smoothstep(0.35, 0.65).mul(stairs);
			const alleys = mix(ground, ink, coverage.mul(mix(nodes.emptyInk, nodes.cityInk, occupied)).mul(mask.a).mul(weight));
			return mix(
				alleys,
				people,
				band(dist.x, mask.g)
					.mul(stairs)
					.mul(tread.add(1).div(2))
					.mul(float(mask.a.greaterThan(0)))
					.mul(weight)
			);
		}
	};
}

/** A closed deck with shared cross sections and sloped landings at ground level. */
export function footbridgeGeometry(grid: TerrainGrid) {
	const span = grid.cells.filter((cell) => cell.plan.footbridge);
	const positions: number[] = [];
	if (span.length) appendBridge(positions, grid, span);
	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
	geometry.computeVertexNormals();
	return geometry;
}

function appendBridge(output: number[], grid: TerrainGrid, span: TerrainCell[]) {
	const first = span[0],
		last = span[span.length - 1];
	const { approachCells, footbridgeClearance, deckDepth } = grid.profile;
	const start = Math.max(0, first.row - approachCells),
		end = Math.min(grid.rows, last.row + 1 + approachCells);
	const deck = grid.terrain.waterLevel + footbridgeClearance;
	type Point = TerrainCell['center'];
	const quad = (a: Point, b: Point, c: Point, d: Point) => {
		for (const p of [a, b, c, a, c, d]) pushThree(output, p);
	};
	const section = (p: Point, row: number): [Point, Point] => {
		const blend = Math.min(
			1,
			(row - start) / Math.max(1, first.row - start),
			(end - row) / Math.max(1, end - last.row - 1)
		);
		const z = p[2] + Math.max(0, deck - p[2]) * blend;
		return [
			[p[0], p[1], z],
			[p[0], p[1], z - deckDepth]
		];
	};
	for (let r = start; r < end; r++) {
		const cell = grid.cells[r * grid.columns + first.column];
		const [southWest, southEast, northEast, northWest] = cell.corners;
		const side = (left: Point, right: Point): Point => {
			const length = Math.hypot(left[0] - right[0], left[1] - right[1]);
			const t = (1 - Math.min(1, grid.profile.footbridgeWidth / length)) / 2;
			return [
				left[0] + (right[0] - left[0]) * t,
				left[1] + (right[1] - left[1]) * t,
				left[2] + (right[2] - left[2]) * t
			];
		};
		const [a, A] = section(side(southWest, southEast), r);
		const [b, B] = section(side(southEast, southWest), r);
		const [c, C] = section(side(northEast, northWest), r + 1);
		const [d, D] = section(side(northWest, northEast), r + 1);
		quad(a, b, c, d);
		quad(D, C, B, A);
		quad(a, d, D, A);
		quad(c, b, B, C);
		if (r === start) quad(b, a, A, B);
		if (r + 1 === end) quad(d, c, C, D);
	}
}
