import type { Vec3 } from '../../core/geometry';
import type { Reach } from '../../domain/valley';
import { terrainDrape } from '../terrain-grid-projection';
import type { ReachFrame } from './frame';
import type { Shape } from '../../core/object';

function clip([ax, ay, az]: Vec3, [bx, by, bz]: Vec3, halfX: number, halfY: number) {
	const dx = bx - ax;
	const dy = by - ay;
	let from = 0;
	let to = 1;
	for (const [value, delta, half] of [
		[ax, dx, halfX],
		[ay, dy, halfY]
	]) {
		if (delta === 0) {
			if (Math.abs(value) > half) return;
			continue;
		}
		const low = (-half - value) / delta;
		const high = (half - value) / delta;
		from = Math.max(from, Math.min(low, high));
		to = Math.min(to, Math.max(low, high));
	}
	if (to <= from) return;
	const point = (t: number): Vec3 => [ax + dx * t, ay + dy * t, az + (bz - az) * t];
	return [point(from), point(to)] as const;
}

// Use the regional map's terrain triangles for the minimum screen-width ink.
// A sparse terrain row can bridge across a narrow channel above its water mesh.
export function tributaryStrokes(
	reaches: readonly Reach[],
	frame: ReachFrame,
	width: number,
	scale: number,
	ground: Extract<Shape, { kind: 'mesh' }>
) {
	const tributaries = reaches.filter(({ trunk }) => !trunk);
	if (!tributaries.length) return [];
	const project = terrainDrape(ground, 64);
	const segments: number[] = [];
	for (const { stations } of tributaries) {
		const local = stations.map(({ xy, water }): Vec3 => [...frame.toLocal(...xy), water * scale]);
		for (let i = 1; i < local.length; i++) {
			const clipped = clip(local[i - 1], local[i], frame.length / 2, width / 2);
			if (!clipped) continue;
			const [[ax, ay, az], [bx, by, bz]] = clipped;
			const dx = bx - ax;
			const dy = by - ay;
			const span = dx * dx + dy * dy;
			if (span < 1e-8) continue;
			const points = project([ax, ay], [bx, by]).map(([x, y, groundZ]): Vec3 => {
				const t = ((x - ax) * dx + (y - ay) * dy) / span;
				return [x, y, Math.max(groundZ, az + t * (bz - az)) + 0.15 * scale];
			});
			for (let j = 1; j < points.length; j++) segments.push(...points[j - 1], ...points[j]);
		}
	}
	return segments;
}
