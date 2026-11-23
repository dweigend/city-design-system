import { defaults } from './settings';
import type { Vec3 } from '../../core/geometry';
import type { Reach, ReachStation } from './reaches';

const { channelCapChordErrorToleranceM, channelCapMinSegments } = defaults;

/** The sampler and projection use a tapered strip with round ends for each solved segment. */
export function* channelSegments(reaches: readonly Reach[]) {
	for (const { id, stations, trunk } of reaches) {
		for (let i = 1; i < stations.length; i++) {
			const [start, end] = [stations[i - 1], stations[i]];
			const dx = end.xy[0] - start.xy[0];
			const dy = end.xy[1] - start.xy[1];
			const length = Math.hypot(dx, dy);
			if (length > 0) yield { id, start, end, dx, dy, length, trunk, first: i === 1 };
		}
	}
}

export function halfWidth(start: ReachStation, end: ReachStation, t: number) {
	return (start.width + (end.width - start.width) * t) / 2;
}

// Exact arithmetic: these fractions select the endpoints of a normalized segment.
export const sectionEndpoints = { start: 0, end: 1 } as const;

function rim({ xy: [x, y], water }: ReachStation, radius: number, angle: number): Vec3 {
	return [x + radius * Math.cos(angle), y + radius * Math.sin(angle), water];
}

function cap(station: ReachStation, radius: number, angle: number): Vec3[] {
	const step = 2 * Math.acos(Math.max(-1, 1 - channelCapChordErrorToleranceM / radius));
	const count = Math.max(channelCapMinSegments, Math.ceil(Math.PI / step));
	return Array.from({ length: count + 1 }, (_, i) =>
		rim(station, radius, angle + (Math.PI * i) / count)
	);
}

/** Yields the sampler's channel strips and round ends, in world XYZ meters. Arc chords
 * deviate by at most 0.35 m from the sampled cross-section. Overlaps remain in the outline. */
export function* channelPolygons(reaches: readonly Reach[]): IterableIterator<readonly Vec3[]> {
	for (const { start, end, dx, dy } of channelSegments(reaches)) {
		const heading = Math.atan2(dy, dx);
		const normal = heading + Math.PI / 2;
		const a = halfWidth(start, end, sectionEndpoints.start);
		const b = halfWidth(start, end, sectionEndpoints.end);
		yield [
			rim(start, a, normal),
			rim(start, a, normal + Math.PI),
			rim(end, b, normal + Math.PI),
			rim(end, b, normal)
		];
		yield cap(start, a, normal);
		yield cap(end, b, normal + Math.PI);
	}
}
