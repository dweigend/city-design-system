import { hashUnit } from '../../core/random';
import { interpolatePoint, type Primitive } from '../parametrik/types';
import { available, fitting, mountFitting, type Reservation } from './town-scatter';
import type { TownSpan } from './town-stations';

const length = ({ a, b }: TownSpan) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** Allocates one rigid line or single to each selected level span at one person per twenty metres. */
export function townLife(spans: TownSpan[], seed: number, reserved: readonly Reservation[] = []) {
	let remaining = Math.round(spans.reduce((sum, s) => sum + length(s), 0) / 20);
	const free = spans
		.filter(({ a, b }) => a[2] === b[2])
		.map((span) => ({
			span,
			length: length(span),
			rank: hashUnit(seed, span.id, 'party')
		}))
		.sort((a, b) => a.rank - b.rank);
	const parts: Primitive[] = [];
	const taken = [...reserved];
	const walker = fitting('kit-scatter-walk');
	const [w, d] = walker.footprint;
	for (const site of [...free]) {
		if (!remaining) break;
		if (site.length < w + 0.2) continue;
		const { a, b, id } = site.span,
			mid = interpolatePoint(a, b, 0.5);
		const c = Math.abs(b[0] - a[0]) / site.length,
			s = Math.abs(b[1] - a[1]) / site.length;
		const box = { x: mid[0], y: mid[1], w: c * w + s * d, d: s * w + c * d };
		if (!available(box, taken)) continue;
		taken.push(box);
		free.splice(free.indexOf(site), 1);
		parts.push(
			...mountFitting(
				walker.id,
				walker.variants[0],
				mid,
				id + '/life',
				seed,
				Math.atan2(b[1] - a[1], b[0] - a[0])
			)
		);
		remaining--;
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
