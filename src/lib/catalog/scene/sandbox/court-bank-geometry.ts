import * as THREE from 'three/webgpu';
import { chartPoint, type TerrainGrid } from '../../logic/terrain-grid';
import { bankDistance, ravineDepth } from '../../logic/terrain';

/** Projects the shared court earthworks into the terrain shader, including true contour
 * elevation and the parcel chart for cover, lanes and focus overlays. */
export function courtBankGeometry(grid: TerrainGrid) {
	const position: number[] = [],
		relief: number[] = [],
		chart: number[] = [];
	const shore: number[] = [],
		frontages: number[] = [],
		shade: number[] = [],
		landform: number[] = [],
		indices: number[] = [];
	for (const cell of grid.cells) {
		const bank = cell.bank;
		if (!bank) continue;
		const start = shade.length,
			stride = bank.divisions + 1;
		for (const [i, [x, y, z]] of bank.points.entries()) {
			position.push(x, z, -y);
			landform.push(
				...(cell.landform
					? chartPoint(
							cell.landform,
							(i % stride) / bank.divisions,
							Math.floor(i / stride) / bank.divisions
						)
					: [0, 0, 0])
			);
			chart.push(
				cell.column + (i % stride) / bank.divisions,
				cell.row + Math.floor(i / stride) / bank.divisions
			);
			relief.push(z, ravineDepth(grid.terrain, x, y));
			shore.push(bankDistance(grid.terrain, x, y) - grid.profile.bankSetback);
			for (let e = 0; e < 4; e++) frontages.push((cell.alleyEdges >> e) & 1);
			shade.push(bank.shade[i]);
		}
		for (const index of bank.indices) indices.push(start + index);
	}
	const geometry = new THREE.BufferGeometry();
	for (const [key, values, size] of [
		['position', position, 3],
		['relief', relief, 2],
		['chart', chart, 2],
		['shore', shore, 1],
		['frontages', frontages, 4],
		['landform', landform, 3],
		['bankShade', shade, 1]
	] as const)
		geometry.setAttribute(key, new THREE.Float32BufferAttribute(values, size));
	geometry.setIndex(indices);
	geometry.computeVertexNormals();
	return geometry;
}
