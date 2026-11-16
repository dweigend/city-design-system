/**
 * Box: the one building element of all city components. Every image is a list of axis-aligned
 * boxes in meters (x east, y north, z up; p = smallest corner, s = size). Color comes only as a
 * token name; the stage (scene/stadt/buehne.ts) resolves it in the current color mode.
 */
import type { Vec3 } from '../parametrik/types';
import { flowToken, type FlowId } from '../../data/focus';

export type { Vec3 };

export type Kiste = {
	/** Stable across all images of a scene. */
	id: string;
	p: Vec3;
	s: Vec3;
	/** Fill as a token, e.g. '--paper-3'. */
	fill: string;
	/** Edge color as a token; null = without edges. */
	edge: string | null;
	/** Opacity; below 1 translucent. */
	alpha: number;
	/** Unshaded (particles, water in section). */
	flat: boolean;
	/** What a click or pointer hits here. */
	target?: string;
	/** Rotation about the vertical axis through p, radians, counterclockwise seen from above. */
	yaw?: number;
};

export type KisteOptions = Partial<Pick<Kiste, 'edge' | 'alpha' | 'flat' | 'target' | 'yaw'>>;

/** Existing stock: gray, fine gray edge. */
export const BESTAND = { fill: '--paper-3', edge: '--ink-3' } as const;
/** Ground and alley. */
export const GRUND = { fill: '--paper-2', edge: '--line' } as const;

/** Base tone of a flow (step 4). */
export const strom = (id: FlowId) => flowToken[id] as string;
/** Step 1–5 of a flow; 4 is the base tone. */
export const stromStufe = (id: FlowId, step: 1 | 2 | 3 | 4 | 5) =>
	step === 4 ? strom(id) : `${strom(id)}-${step}`;

export function kiste(id: string, p: Vec3, s: Vec3, fill: string, o: KisteOptions = {}): Kiste {
	return {
		id,
		p,
		s,
		fill,
		edge: o.edge === undefined ? '--ink' : o.edge,
		alpha: o.alpha ?? 1,
		flat: o.flat ?? false,
		target: o.target,
		yaw: o.yaw
	};
}

/** Growing from below: f = 0 invisible, 1 full height. */
export function grow(k: Kiste, f: number): Kiste | null {
	if (f <= 0.001) return null;
	if (f >= 1) return k;
	return { ...k, s: [k.s[0], k.s[1], k.s[2] * f] };
}

/** Moves by d meters. */
export const shift = (k: Kiste, d: Vec3): Kiste => ({
	...k,
	p: [k.p[0] + d[0], k.p[1] + d[1], k.p[2] + d[2]]
});

/** Center of a box, e.g. as an anchor for labels. */
export const center = (k: Pick<Kiste, 'p' | 's'>): Vec3 => [
	k.p[0] + k.s[0] / 2,
	k.p[1] + k.s[1] / 2,
	k.p[2] + k.s[2] / 2
];

export const lerp3 = (a: Vec3, b: Vec3, f: number): Vec3 => [
	a[0] + (b[0] - a[0]) * f,
	a[1] + (b[1] - a[1]) * f,
	a[2] + (b[2] - a[2]) * f
];

/** Filters out empty entries after grow(). */
export const present = (list: (Kiste | null | undefined | false)[]): Kiste[] =>
	list.filter((k): k is Kiste => !!k);

/**
 * Beam from a to b (plan), width w across, height h from z. For footbridges, pipes and paths
 * in any direction.
 */
export function beam(
	id: string,
	a: [number, number],
	b: [number, number],
	z: number,
	w: number,
	h: number,
	fill: string,
	o: KisteOptions = {}
): Kiste {
	const dx = b[0] - a[0],
		dy = b[1] - a[1];
	const len = Math.hypot(dx, dy);
	const yaw = Math.atan2(dy, dx);
	// Corner p such that the center line lies on a–b.
	const nx = -Math.sin(yaw) * (w / 2),
		ny = Math.cos(yaw) * (w / 2);
	return kiste(id, [a[0] - nx, a[1] - ny, z], [len, w, h], fill, { ...o, yaw });
}
