import type { Vec2 } from '../../core/geometry';
import type { Random } from '../../core/random';
import { rectPolygon } from './cells';
import type { Unit } from './prism';

/** Module, joint and relief of one family in patch meters, plus unitless shares. `relief` holds
 * the face height and, where the family has one, the trim height. */
export type ReliefParams = Readonly<{
	module: Vec2;
	joint: number;
	relief: readonly number[];
	bond: number;
	alt: number;
	jitter: number;
	crest: Vec2;
}>;

/** Places units over a patch of the given size; units may overhang and are clipped later. */
export type Layout = (params: ReliefParams, size: Vec2, random: Random) => Unit[];

function pick(random: Random, alt: number) {
	return random.number() < alt ? 'unit-alt' : 'unit';
}

function jittered(random: Random, depth: number, jitter: number) {
	return depth * (1 + jitter * (random.number() * 2 - 1));
}

/** Courses of rectangular units with a joint above and beside each, every second course shifted
 * by the bond share: masonry, scored render, paving. */
// Exact arithmetic: units rest on the patch plane and every second course shifts.
function bond(
	{ module: [length, rise], joint, relief, bond: shift, alt, jitter }: ReliefParams,
	[width, height]: Vec2,
	random: Random
): Unit[] {
	const units: Unit[] = [];
	for (let row = 0; row * rise < height; row++) {
		const v0 = row * rise;
		const offset = (row % 2) * shift * length;
		for (let u0 = -offset; u0 < width; u0 += length) {
			const slot = pick(random, alt);
			const at = jittered(random, relief[0], jitter);
			units.push({
				slot,
				polygon: rectPolygon([u0, v0, u0 + length - joint, v0 + rise - joint]),
				base: 0,
				top: { at }
			});
		}
	}
	return units;
}

/** Vertical boards side by side with a raised batten over every board joint. Battens cast onto
 * the highest board face, so their shade shows on every board. */
// Exact arithmetic: boards and battens rest on the patch plane.
function boards(
	{ module: [board, run], joint, relief, alt, jitter }: ReliefParams,
	[width, height]: Vec2,
	random: Random
): Unit[] {
	const units: Unit[] = [];
	const gap = joint / 2;
	for (let column = 0; column * board <= width; column++) {
		const u0 = column * board;
		const slot = pick(random, alt);
		const at = jittered(random, relief[0], jitter);
		for (let v0 = 0; v0 < height; v0 += run)
			units.push({
				slot,
				polygon: rectPolygon([u0, v0, u0 + board, v0 + run - gap]),
				base: 0,
				top: { at }
			});
		units.push({
			slot: 'trim',
			polygon: rectPolygon([u0 - gap, 0, u0 + gap, height]),
			base: 0,
			top: { at: relief[1] },
			castOnto: relief[0] * (1 + jitter)
		});
	}
	return units;
}

/** A trapezoid corrugation across the patch, extruded upward, with sheets lapping every module
 * height: every second sheet is lifted by the joint, so the lap reads as a step. */
// Exact arithmetic: sheets rest on the patch plane and every second sheet laps.
function profile(
	{ module: [pitch, sheet], joint, relief, crest: [crestShare, flankShare] }: ReliefParams,
	[width, height]: Vec2
): Unit[] {
	const units: Unit[] = [];
	const depth = relief[0];
	const crest = pitch * crestShare;
	const flank = pitch * flankShare;
	const trough = pitch - crest - 2 * flank;
	const slope = depth / flank;
	for (let row = 0; row * sheet < height; row++) {
		const [v0, v1] = [row * sheet, (row + 1) * sheet];
		const lap = (row % 2) * joint;
		for (let k = 0; k * pitch < width; k++) {
			const a = k * pitch + trough / 2;
			const [b, c, d] = [a + flank, a + flank + crest, a + 2 * flank + crest];
			const rect = (u0: number, u1: number) => rectPolygon([u0, v0, u1, v1]);
			units.push(
				{ slot: 'unit', polygon: rect(a, b), base: 0, top: { at: lap - slope * a, perU: slope } },
				{ slot: 'unit', polygon: rect(b, c), base: 0, top: { at: lap + depth } },
				{
					slot: 'unit',
					polygon: rect(c, d),
					base: 0,
					top: { at: lap + depth + slope * c, perU: -slope }
				}
			);
			if (lap > 0)
				units.push(
					{ slot: 'unit', polygon: rect(k * pitch, a), base: 0, top: { at: lap } },
					{ slot: 'unit', polygon: rect(d, (k + 1) * pitch), base: 0, top: { at: lap } }
				);
		}
	}
	return units;
}

/** A frame grid of mullions and transoms, edges included, with a recessed pane in every cell. */
// Exact arithmetic: frames and panes rest on the patch plane.
function grid(
	{ module: [paneWidth, paneHeight], joint, relief, alt }: ReliefParams,
	[width, height]: Vec2,
	random: Random
): Unit[] {
	const units: Unit[] = [];
	const half = joint / 2;
	const stops = (size: number, step: number) => {
		const list: number[] = [];
		for (let x = 0; x < size; x += step) list.push(x);
		return [...list, size];
	};
	const us = stops(width, paneWidth);
	const vs = stops(height, paneHeight);
	const frame = { at: relief[1] };
	for (const u of us)
		units.push({
			slot: 'trim',
			polygon: rectPolygon([u - half, 0, u + half, height]),
			base: 0,
			top: frame,
			castOnto: relief[0]
		});
	for (let i = 0; i + 1 < us.length; i++) {
		for (const [j, v] of vs.entries()) {
			units.push({
				slot: 'trim',
				polygon: rectPolygon([us[i] + half, v - half, us[i + 1] - half, v + half]),
				base: 0,
				top: frame,
				castOnto: relief[0]
			});
			if (j + 1 < vs.length)
				units.push({
					slot: pick(random, alt),
					polygon: rectPolygon([us[i] + half, v + half, us[i + 1] - half, vs[j + 1] - half]),
					base: 0,
					top: { at: relief[0] }
				});
		}
	}
	return units;
}

/** The layouts by name; a family names one. */
export const layouts = Object.freeze({ bond, boards, profile, grid } satisfies Record<
	string,
	Layout
>);
