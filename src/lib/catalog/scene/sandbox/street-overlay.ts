import * as THREE from 'three/webgpu';
import { attribute, float, mix, texture, vec2 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { MODULE, type TerrainCell, type TerrainGrid } from '../../logic/terrain-grid';
import { defineParams, numberParam, resolveParams } from '../../logic/params';
import { pushThree } from '../world-space';

const viewProfile = resolveParams(
	defineParams({
		emptyInk: numberParam('Outer street ink', 'ratio', 0.18, [0, 1, 0.01]),
		cityInk: numberParam('Settled street ink', 'ratio', 0.32, [0, 1, 0.01]),
		cityRadiusCells: numberParam('Frontage reach', 'cells', 4, [1, 16, 1], 'integer'),
		treadsPerCell: numberParam('Treads per module', 'treads', 4, [1, 10, 1], 'integer')
	})
);

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

/** Nearest-cell mask for street widths, stair treads and occupied frontages. */
export function streetOverlay(grid: TerrainGrid, profile = viewProfile) {
	const pixels = new Uint8Array(grid.cells.length * 4);
	const map = new THREE.DataTexture(pixels, grid.columns, grid.rows);
	function update(next: TerrainGrid, houses: Iterable<string>) {
		const occupied = frontages(next, houses, profile.cityRadiusCells);
		for (const cell of next.cells) {
			const { square, width, stairs } = cell.plan;
			const band = Math.min(255, Math.round((255 * width) / MODULE));
			const channel = (axis: 'along' | 'across') =>
				square ? 255 : cell.street === axis || cell.street === 'both' ? band : 0;
			pixels.set(
				[
					channel('along'),
					channel('across'),
					stairs ? 255 : 0,
					255 * cell.plan.extent * (occupied.has(cell.index) ? profile.cityInk : profile.emptyInk)
				],
				cell.index * 4
			);
		}
		map.needsUpdate = true;
	}
	update(grid, []);
	return {
		update,
		dispose: () => map.dispose(),
		shade(ground: Node<'vec3'>, ink: Node<'color'>, people: Node<'color'>, weight: Node<'float'>) {
			const chart = attribute('chart', 'vec2');
			const mask = texture(map, chart.div(vec2(grid.columns, grid.rows)));
			const dist = chart.fract().sub(0.5).abs().mul(2);
			const band = (distance: Node<'float'>, width: Node<'float'>) =>
				float(1)
					.sub(distance.smoothstep(width.sub(distance.fwidth()), width.add(distance.fwidth())))
					.mul(float(width.greaterThan(0)));
			const coverage = band(dist.x, mask.g).max(band(dist.y, mask.r));
			const tread = chart.y.mul(profile.treadsPerCell).fract().smoothstep(0.35, 0.65).mul(mask.b);
			const streets = mix(ground, ink, coverage.mul(mask.a).mul(weight));
			return mix(
				streets,
				people,
				band(dist.x, mask.g)
					.mul(mask.b)
					.mul(tread.add(1).div(2))
					.mul(float(mask.a.greaterThan(0)))
					.mul(weight)
			);
		}
	};
}

/** Continuous deck across the river with shared edge heights on both approaches. */
export function bridgeGeometry(grid: TerrainGrid) {
	const positions: number[] = [];
	for (const cell of grid.cells) {
		if (!cell.plan.bridge) continue;
		const [a, b, c, d] = cell.corners;
		for (const p of [a, b, c, a, c, d])
			pushThree(positions, [
				p[0],
				p[1],
				Math.max(p[2], grid.terrain.waterLevel + grid.profile.bridgeClearance)
			]);
	}
	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
	geometry.computeVertexNormals();
	return geometry;
}
