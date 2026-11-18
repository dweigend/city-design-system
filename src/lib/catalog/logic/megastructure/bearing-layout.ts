import { preferredWallRing } from './wall-order';
import type { RoofCell } from './footprints';
import type { Vec3 } from '../traeger';
export type Joint = { id: string; p: Vec3 };
function length(a: Joint, b: Joint) {
	return Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1], a.p[2] - b.p[2]);
}
function bay(roof: RoofCell, level: number, start: number, direction: number) {
	const ring = roof.polygon;
	const feet = Array.from({ length: 3 }, (_, k): Joint => {
		const i = (start + direction * Math.floor((k * ring.length) / 3) + ring.length) % ring.length,
			a = ring[i],
			b = ring[(i + 1) % ring.length];
		return {
			id: JSON.stringify([roof.id, k, 'foot']),
			p: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, roof.height]
		};
	});
	const [a, b, c] = feet.map((n) => n.p);
	if (Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) < 1e-8) return;
	const crown = feet.map(({ p }, k): Joint => ({
		id: JSON.stringify([roof.id, k, 'head']),
		p: [p[0], p[1], level + (k === 1 ? 1 : 0)]
	}));
	return { feet, crown };
}

export type Bay = NonNullable<ReturnType<typeof bay>>;

/** Enumerates the member axes in assembly order. */
export function bayMembers({ feet, crown }: Bay) {
	return crown.flatMap((head, i) =>
		[...feet, crown[(i + 1) % 3]].map((target): [Joint, Joint] => [head, target])
	);
}
/** Tries the canonical survey first, then all cyclic starts in both directions.
 * Only bays whose posts, chords and diagonals fit the span in meters survive. */
export function bearingLayouts(roof: RoofCell, level: number, maxSpan: number) {
	const result: Bay[] = [];
	const ordered = { ...roof, polygon: preferredWallRing(roof.polygon) };
	for (const direction of [1, -1])
		for (let start = 0; start < ordered.polygon.length; start++) {
			const layout = bay(ordered, level, start, direction);
			if (layout && bayMembers(layout).every(([a, b]) => length(a, b) <= maxSpan))
				result.push(layout);
		}
	return result;
}
/** The three shortest available links between neighboring crowns, or none. */
export function crownLinks(bay: Bay, other: Bay, maxSpan: number) {
	const pairs = bay.crown
		.flatMap((a) => other.crown.map((b) => ({ a, b, d: length(a, b) })))
		.filter((p) => p.d > 1e-8 && p.d <= maxSpan)
		.sort((a, b) => a.d - b.d);
	return pairs.length >= 3 ? pairs.slice(0, 3) : [];
}
