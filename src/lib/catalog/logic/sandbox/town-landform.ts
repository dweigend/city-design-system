import { terrainHeight, valleyPoint, valleyCoords, type Terrain } from '../terrain';
import type { CityPlan } from '../city-plan';
import type { TerrainGrid } from '../terrain-grid';
import type { Vec3 } from '../parametrik/types';
import { required } from '../required';

type Point = readonly [number, number];
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const ease = (x: number) => {
	const t = clamp(x);
	return t * t * (3 - 2 * t);
};

// Survey in the valley frame so long strips follow its bend. Widths and heights are metres.
function ribbon(terrain: Terrain, a: Point, b: Point, za: number, zb: number) {
	const dx = b[0] - a[0],
		dy = b[1] - a[1],
		l2 = dx * dx + dy * dy;
	const length = Math.sqrt(l2) || 1,
		nx = -dy / length,
		ny = dx / length;
	const bow = Math.min(10, length * 0.16);
	const middle = (offset: number) =>
		valleyPoint(terrain, (a[0] + b[0]) / 2 + nx * offset, (a[1] + b[1]) / 2 + ny * offset);
	const lowSide =
		terrainHeight(terrain, ...middle(bow)) <= terrainHeight(terrain, ...middle(-bow)) ? 1 : -1;
	return (p: Point) => {
		const t = l2 ? clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2) : 0;
		const lateral = lowSide * bow * Math.sin(t * Math.PI) ** 2;
		return {
			distance: Math.hypot(
				p[0] - a[0] - t * dx - lateral * nx,
				p[1] - a[1] - t * dy - lateral * ny
			),
			datum: za + (zb - za) * t
		};
	};
}

function corridors(grid: TerrainGrid, city: CityPlan) {
	const anchor = (id: string) => {
		const [x, y, z] = required(grid.cellsById.get(id), 'landform anchor').center;
		return { xy: valleyCoords(grid.terrain, x, y), z };
	};
	const span = (from: string, to: string) => {
		const a = anchor(from),
			b = anchor(to);
		return ribbon(grid.terrain, a.xy, b.xy, a.z, b.z);
	};
	return [
		...city.corridors.map(([a, b]) => span(a, b)),
		...city.centres.flatMap((c) => (c.ensembles ?? []).map((e) => span(c.cellId, e.court)))
	];
}

// A shallow swale lies between two planted shoulders. Across the shoulders, the
// unmodified survey selects the terrace course; only the riser uses the full slope.
function section(z: number, datum: number, d: number, shore: number) {
	const influence = (1 - ease((d - 10) / 10)) * shore;
	const bed = (1 - ease(d / 4.5)) * influence;
	const shoulder = (1 - ease(Math.abs(d - 6) / 4.5)) * influence;
	const course = 1.5;
	const phase = (z - datum) / course;
	const fraction = phase - Math.floor(phase);
	const bench = course * (ease((fraction - 0.33) / 0.34) - fraction);
	const terrace = influence * (1 - bed);
	return {
		height: z + terrace * bench - 0.58 * bed + 0.28 * shoulder,
		slots: [terrace, shoulder, bed] as Vec3
	};
}

/** Grades shared lattice vertices between ensemble courts and valley centres. Fixed
 * house/court survey vertices and the waterline retain their elevations. The three
 * vertex slots are terrace tread, planted bank and swale bed, respectively. */
export function townLandform(grid: TerrainGrid, city: CityPlan, levels: Map<Vec3, number>) {
	const spans = corridors(grid, city);
	const slots = new Map<Vec3, Vec3>();
	for (const p of grid.vertices) {
		if (levels.has(p) || p[2] <= grid.terrain.waterLevel) continue;
		const xy = valleyCoords(grid.terrain, p[0], p[1]);
		let distance = 20,
			datumSum = 0,
			weight = 0;
		for (const span of spans) {
			const site = span(xy);
			if (site.distance >= 20) continue;
			const w = (1 - site.distance / 20) ** 4;
			datumSum += w * site.datum;
			weight += w;
			distance = Math.min(distance, site.distance);
		}
		if (distance >= 20) continue;
		const shore = ease((p[2] - grid.terrain.waterLevel) / 1.5);
		const grade = section(p[2], datumSum / weight, distance, shore);
		levels.set(p, grade.height);
		slots.set(p, grade.slots);
	}
	return slots;
}
