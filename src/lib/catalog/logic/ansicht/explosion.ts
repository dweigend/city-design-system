/**
 * Explosion (93, 86) and build phases (134) as an offset per group.
 * The scene is built once; slider and animation only move groups.
 */
import type { Primitive, Vec3 } from '../parametrik/types';
import { bounds, center, union, type Bounds } from './geometrie';
import { phaseState } from './fokus';
import { tagFor, type Tags } from './tags';

export type Gruppe = { id: string; center: Vec3; level: number; phase: number; boden: boolean };
export type Explosion = {
	/** Meters per floor by which the levels move apart. */
	ebenen: number;
	/** Share by which modules move radially away from the center (0 … 1). */
	module: number;
};
/** Drop height during installation in the build-phase animation. */
export const DROP = 9;

export function gruppen(primitives: Primitive[], tags: Tags): Map<string, Gruppe> {
	const acc = new Map<string, { b: Bounds[]; level: number; phase: number; boden: boolean }>();
	for (const p of primitives) {
		const t = tagFor(tags, p);
		const g = acc.get(t.group) ?? {
			b: [],
			level: t.level,
			phase: t.phase,
			boden: t.schicht === 'boden'
		};
		g.b.push(bounds(p));
		acc.set(t.group, g);
	}
	return new Map(
		[...acc].map(([id, g]) => [
			id,
			{ id, center: center(union(g.b)), level: g.level, phase: g.phase, boden: g.boden }
		])
	);
}

const ease = (x: number) => 1 - (1 - x) ** 3;

/** Offset per group from explosion and build time t ∈ [0, 4]. */
export function versatz(
	groups: Map<string, Gruppe>,
	e: Explosion,
	zeit: number,
	mitte: [number, number]
): Map<string, Vec3> {
	const out = new Map<string, Vec3>();
	for (const g of groups.values()) {
		if (g.boden) {
			out.set(g.id, [0, 0, 0]);
			continue;
		}
		const dz = g.level * e.ebenen;
		const dx = (g.center[0] - mitte[0]) * e.module,
			dy = (g.center[1] - mitte[1]) * e.module;
		const arrive =
			g.phase > 0 && phaseState(g.phase, zeit) === 'built'
				? (1 - ease(Math.min(1, Math.max(0, zeit - (g.phase - 1))))) * DROP
				: 0;
		out.set(g.id, [dx, dy, dz + arrive]);
	}
	return out;
}
