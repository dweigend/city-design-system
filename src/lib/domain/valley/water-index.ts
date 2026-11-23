import type { Vec2 } from '../../core/geometry';
import type { DrainageLake } from './lake-geometry';
import type { Reach, ReachStation } from './reaches';

const size = 160;
export const bankLimit = 160;
type Edge = {
	a: Vec2;
	dx: number;
	dy: number;
	inverse: number;
	halfX: number;
	halfY: number;
	midX: number;
	midY: number;
};
type Shore = Edge & { lake: DrainageLake };
type Channel = Edge & {
	start: ReachStation;
	end: ReachStation;
	kind: 'river' | 'tributary';
	sill: boolean;
	maximumRadius: number;
};

function edge(a: Vec2, b: Vec2): Edge {
	const dx = b[0] - a[0];
	const dy = b[1] - a[1];
	const halfX = Math.abs(dx) / 2;
	const halfY = Math.abs(dy) / 2;
	return {
		a,
		dx,
		dy,
		inverse: 1 / (dx * dx + dy * dy),
		halfX,
		halfY,
		midX: a[0] + dx / 2,
		midY: a[1] + dy / 2
	};
}

function key(x: number, y: number) {
	return Math.floor(x / size) + Math.floor(y / size) * 1024;
}

function spatial<T>() {
	const bins = new Map<number, T[]>();
	return {
		add(item: T, a: Vec2, b: Vec2, margin: number) {
			for (
				let y = Math.floor((Math.min(a[1], b[1]) - margin) / size);
				y <= Math.floor((Math.max(a[1], b[1]) + margin) / size);
				y++
			) {
				for (
					let x = Math.floor((Math.min(a[0], b[0]) - margin) / size);
					x <= Math.floor((Math.max(a[0], b[0]) + margin) / size);
					x++
				) {
					const id = x + y * 1024;
					const bucket = bins.get(id);
					if (bucket) bucket.push(item);
					else bins.set(id, [item]);
				}
			}
		},
		at(x: number, y: number) {
			return bins.get(key(x, y));
		}
	};
}

function projection({ a, dx, dy, inverse }: Edge, x: number, y: number) {
	return Math.min(1, Math.max(0, ((x - a[0]) * dx + (y - a[1]) * dy) * inverse));
}

function separation({ a, dx, dy }: Edge, x: number, y: number, t: number) {
	const u = x - a[0] - dx * t;
	const v = y - a[1] - dy * t;
	return Math.sqrt(u * u + v * v);
}

function mix(a: number, b: number, t: number) {
	return a + (b - a) * t;
}

export function waterIndex(reaches: readonly Reach[], lakes: readonly DrainageLake[]) {
	const channels = spatial<Channel>();
	const shores = spatial<Shore>();
	const outlines = new Map<DrainageLake, Shore[]>();
	const sillReaches = new Set(lakes.map(({ downstream }) => downstream));
	for (const { id, stations, trunk } of reaches) {
		for (let i = 1; i < stations.length; i++) {
			const [start, end] = [stations[i - 1], stations[i]];
			const line = edge(start.xy, end.xy);
			const maximumRadius = Math.max(start.width, end.width) / 2;
			if (!Number.isFinite(line.inverse)) continue;
			channels.add(
				{
					...line,
					maximumRadius,
					start,
					end,
					kind: trunk ? 'river' : 'tributary',
					sill: i === 1 && sillReaches.has(id)
				},
				start.xy,
				end.xy,
				bankLimit + maximumRadius
			);
		}
	}
	for (const lake of lakes) {
		const outline: Shore[] = [];
		outlines.set(lake, outline);
		for (const ring of lake.rings) {
			for (let i = 0; i < ring.length; i++) {
				const a = ring[i];
				const b = ring[(i + 1) % ring.length];
				const line = edge(a, b);
				if (!Number.isFinite(line.inverse)) continue;
				const shore = { ...line, lake };
				outline.push(shore);
				shores.add(shore, a, b, bankLimit);
			}
		}
	}
	return {
		channel(x: number, y: number) {
			let closest: Channel | undefined;
			let trunk: { edge: Channel; t: number; distance: number } | undefined;
			let bank = bankLimit;
			let t = 0;
			for (const candidate of channels.at(x, y) ?? []) {
				// Box distance bounds the segment distance. Keep trunk candidates that
				// can win the wet-overlap preference even when a tributary is closer.
				const limit = Math.max(
					0,
					candidate.maximumRadius + (candidate.kind === 'river' ? Math.max(0, bank) : bank)
				);
				if (
					Math.abs(x - candidate.midX) - candidate.halfX > limit ||
					Math.abs(y - candidate.midY) - candidate.halfY > limit
				)
					continue;
				const u = projection(candidate, x, y);
				const radius = mix(candidate.start.width, candidate.end.width, u) / 2;
				const distance = separation(candidate, x, y, u) - radius;
				if (candidate.kind === 'river' && distance < (trunk?.distance ?? 0)) {
					trunk = { edge: candidate, t: u, distance };
				}
				if (distance >= bank) continue;
				closest = candidate;
				bank = distance;
				t = u;
			}
			if (!closest) return null;
			const { start, end, kind, sill } = trunk?.edge ?? closest;
			const position = trunk?.t ?? t;
			const distance = trunk?.distance ?? bank;
			const radius = mix(start.width, end.width, position) / 2;
			const cut = Math.max(0, Math.min(1, -distance / radius));
			return {
				kind,
				bank,
				water: mix(start.water, end.water, position),
				depth: mix(start.depth, end.depth, position) * cut * (2 - cut) * (sill ? position : 1)
			};
		},
		shore(x: number, y: number, inside: DrainageLake | undefined) {
			let distance = bankLimit;
			let lake = inside;
			for (const candidate of shores.at(x, y) ?? []) {
				if (inside && candidate.lake !== inside) continue;
				const t = projection(candidate, x, y);
				const d = separation(candidate, x, y, t);
				if (d >= distance) continue;
				lake = candidate.lake;
				distance = d;
			}
			if (inside && distance === bankLimit) {
				distance = Infinity;
				for (const candidate of outlines.get(inside) ?? [])
					distance = Math.min(distance, separation(candidate, x, y, projection(candidate, x, y)));
				if (!Number.isFinite(distance)) distance = bankLimit;
			}
			return lake && { lake, bank: inside ? -distance : distance };
		}
	};
}
