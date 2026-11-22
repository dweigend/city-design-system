import type { Vec2 } from '../../core/geometry';
import type { CityProfile } from '../../domain/city-volume';
import { mesh } from './mesh';

const sampleStep = 4;
const contourStep = 12;

function distance([x, y]: Vec2, [u, v]: Vec2) {
	return Math.hypot(x - u, y - v);
}

function mix([x, y]: Vec2, [u, v]: Vec2, t: number): Vec2 {
	return [x + t * (u - x), y + t * (v - y)];
}

function densify(outline: readonly Vec2[]) {
	return outline.flatMap((a, i) => {
		const b = outline[(i + 1) % outline.length];
		const subdivisions = Math.ceil(distance(a, b) / sampleStep);
		return Array.from({ length: subdivisions }, (_, j) => mix(a, b, j / subdivisions));
	});
}

export function profileMesh(
	outline: readonly Vec2[],
	profile: CityProfile,
	toLocal: (x: number, y: number) => Vec2,
	groundHeight: (x: number, y: number) => number
) {
	const geometry = mesh();
	const heights: number[] = [];
	const perimeter = densify(outline);
	const rows = Math.ceil(
		Math.max(...perimeter.map((p) => distance(p, profile.summit))) / sampleStep
	);
	function addPoint([x, y]: Vec2) {
		const height = profile.height(x, y);
		heights.push(height);
		geometry.positions.push(...toLocal(x, y), groundHeight(x, y) + height);
	}
	addPoint(profile.summit);
	for (let row = 1; row <= rows; row++) {
		for (const edge of perimeter) addPoint(mix(profile.summit, edge, row / rows));
	}
	const sides = perimeter.length;
	for (let j = 0; j < sides; j++) {
		const next = (j + 1) % sides;
		geometry.indices.push(0, 1 + j, 1 + next);
		for (let row = 1; row < rows; row++) {
			const a = 1 + (row - 1) * sides + j;
			const b = 1 + (row - 1) * sides + next;
			geometry.indices.push(a, a + sides, b + sides, a, b + sides, b);
		}
	}
	return { geometry, wires: contours(geometry, heights) };
}

function contours({ positions, indices }: ReturnType<typeof mesh>, heights: readonly number[]) {
	const wires: number[] = [];
	const segment = (a: number, b: number, z: number) => {
		if (heights[a] < z === heights[b] < z) return;
		const t = (z - heights[a]) / (heights[b] - heights[a]);
		for (let axis = 0; axis < 3; axis++) {
			const u = positions[3 * a + axis];
			const v = positions[3 * b + axis];
			wires.push(u + (v - u) * t);
		}
	};
	for (let i = 0; i < indices.length; i += 3) {
		const [a, b, c] = [indices[i], indices[i + 1], indices[i + 2]];
		const min = Math.min(heights[a], heights[b], heights[c]);
		const max = Math.max(heights[a], heights[b], heights[c]);
		for (let z = (Math.floor(min / contourStep) + 1) * contourStep; z < max; z += contourStep) {
			segment(a, b, z);
			segment(b, c, z);
			segment(c, a, z);
		}
	}
	return Object.freeze(wires);
}
