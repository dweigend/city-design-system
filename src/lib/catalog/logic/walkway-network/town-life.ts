import { nearest, distance } from './clearance';
import type { Point } from './types';
import { hashUnit } from '../../core/random';
import { interpolatePoint, type Primitive } from '../parametrik/types';
import { available, fitting, mountFitting, type Reservation } from './town-scatter';
import type { TownSpan } from './town-stations';

const length = ({ a, b }: TownSpan) => Math.hypot(b[0] - a[0], b[1] - a[1]);

// A 2 m reservation has 0.25 m of clearance on either side. A paired run
// spends at most 0.1 m of that at its level joint; the joint plate covers the turn.
function levelRuns(spans: TownSpan[]) {
	const runs: TownSpan[] = [];
	let previous: TownSpan | undefined;
	for (const span of spans) {
		if (span.a[2] !== span.b[2]) {
			previous = undefined;
			continue;
		}
		if (previous && previous.b.every((v, i) => v === span.a[i]) && shallowJoint(previous, span)) {
			previous.b = span.b;
			previous = undefined;
		} else {
			previous = { ...span };
			runs.push(previous);
		}
	}
	return runs;
}
function shallowJoint(before: TownSpan, after: TownSpan) {
	const xy = (p: TownSpan['a']): Point => [p[0], p[1]];
	const joint = xy(after.a);
	return (
		distance(joint, nearest(joint, { a: xy(before.a), b: xy(after.b) })) <= 0.1 &&
		Math.min(length(before), length(after)) >= 2
	);
}

/** Allocates one rigid line or single to each selected level span at one person per twenty metres. */
export function townLife(spans: TownSpan[], seed: number, reserved: readonly Reservation[] = []) {
	let remaining = Math.round(spans.reduce((sum, s) => sum + length(s), 0) / 20);
	const free = levelRuns(spans)
		.map((span) => ({
			span,
			length: length(span),
			rank: hashUnit(seed, span.id, 'party')
		}))
		.sort((a, b) => a.rank - b.rank);
	const parts: Primitive[] = [];
	const taken = [...reserved];
	const sizes = [15, 1, 7, 1, 3, 1];
	let draw = 2 * (Math.abs(Math.trunc(seed)) % 3);
	while (remaining && free.length) {
		const size = Math.min(remaining, sizes[draw++ % sizes.length]);
		const pose = draw % 4 === 2 ? 'walk' : 'stand';
		const choice = partySite(free, size, pose, taken);
		if (!choice) break;
		const { n, index, box } = choice;
		const {
			span: { a, b, id }
		} = free.splice(index, 1)[0];
		taken.push(box);
		const asset = fitting(scatter(n, pose));
		const variant = n === 1 ? asset.variants[0] : 'deck-line';
		parts.push(
			...mountFitting(
				asset.id,
				variant,
				interpolatePoint(a, b, 0.5),
				id + '/life',
				seed,
				Math.atan2(b[1] - a[1], b[0] - a[0])
			)
		);
		remaining -= n;
	}
	const levelLength = spans
		.filter(({ a, b }) => a[2] === b[2])
		.reduce((sum, s) => sum + length(s), 0);
	const planter = fitting('rolled-lip-planter');
	const clearance = Math.hypot(...planter.footprint);
	let remainingPlanters = Math.floor(levelLength / 30);
	for (const {
		span: { a, b, id },
		length
	} of free) {
		if (!remainingPlanters) break;
		const mid = interpolatePoint(a, b, 0.5),
			[w, d] = planter.footprint;
		const box = { x: mid[0], y: mid[1], w, d };
		if (length < clearance + 0.2 || !available(box, taken)) continue;
		parts.push(...mountFitting(planter.id, 'compact', mid, id + '/planter', seed));
		taken.push(box);
		remainingPlanters--;
	}
	return parts;
}
function scatter(n: number, pose: string) {
	return 'kit-scatter-' + (n === 1 ? pose : 'group-' + n);
}
function partySite(
	sites: { span: TownSpan; length: number }[],
	size: number,
	pose: string,
	taken: Reservation[]
) {
	for (const n of [15, 7, 3, 1].filter((n) => n <= size)) {
		const [w, d] = fitting(scatter(n, pose)).footprint;
		for (const [index, site] of sites.entries()) {
			if (site.length < w + 0.2 || d > 2) continue;
			const { a, b } = site.span;
			const c = Math.abs(b[0] - a[0]) / site.length,
				s = Math.abs(b[1] - a[1]) / site.length;
			const box = {
				x: (a[0] + b[0]) / 2,
				y: (a[1] + b[1]) / 2,
				w: c * w + s * d,
				d: s * w + c * d
			};
			if (available(box, taken)) return { n, index, box };
		}
	}
}
