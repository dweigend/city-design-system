import type { Vec2 } from '../../core/geometry';
import { citySiteConfig } from './config';
import type { CityTerrainSampler } from './sampling';

type Window = Readonly<{ origin: Vec2; bearing: number; length: number; width: number }>;
type Mesh = { kind: 'mesh'; positions: number[]; indices: number[] };
const mesh = (): Mesh => ({ kind: 'mesh', positions: [], indices: [] });
const intervals = (extent: number) =>
	Math.min(citySiteConfig.windowMaxIntervals, Math.ceil(extent / citySiteConfig.windowSampleStepM));

/** Samples a terrain window in local meters. Water uses wet triangles of the same mesh. */
export function sampleCityWindow(sample: CityTerrainSampler, window: Window) {
	const {
		origin: [cx, cy],
		bearing,
		length,
		width
	} = window;
	const c = Math.cos(bearing);
	const s = Math.sin(bearing);
	const toLocal = (x: number, y: number): Vec2 => [
		(x - cx) * c + (y - cy) * s,
		(y - cy) * c - (x - cx) * s
	];
	const ground = mesh();
	const water = mesh();
	const waterIndex: (number | undefined)[] = [];
	const cols = intervals(length);
	const rows = intervals(width);
	for (let j = 0; j <= rows; j++) {
		const y = (j / rows - 0.5) * width;
		for (let i = 0; i <= cols; i++) {
			const x = (i / cols - 0.5) * length;
			const reading = sample(cx + x * c - y * s, cy + x * s + y * c);
			ground.positions.push(x, y, reading.height);
			waterIndex.push(reading.waterKind === null ? undefined : water.positions.length / 3);
			if (reading.waterKind !== null) water.positions.push(x, y, reading.waterHeight);
		}
	}
	const add = (a: number, b: number, c: number) => {
		ground.indices.push(a, b, c);
		const [u, v, w] = [waterIndex[a], waterIndex[b], waterIndex[c]];
		if (u !== undefined && v !== undefined && w !== undefined) water.indices.push(u, v, w);
	};
	for (let j = 0; j < rows; j++) {
		for (let i = 0; i < cols; i++) {
			const a = j * (cols + 1) + i;
			const b = a + cols + 1;
			add(a, a + 1, b + 1);
			add(a, b + 1, b);
		}
	}
	return { ground, water, toLocal, footprint: { width: length, depth: width } };
}
