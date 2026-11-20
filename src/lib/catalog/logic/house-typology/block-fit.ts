import { STORY } from '../../data/grid';
import { blockBase } from './plinth-stock';
import { fitBandStock } from './band-stock';
import type { Body, Plan, Point } from './types';

function shortEnvelope(plan: Plan, baseHeight: number) {
	const { width, depth, programme } = plan.site;
	const axis = width >= depth ? 0 : 1,
		dims: [number, number] = [width - 0.1, depth - 0.1];
	const canWiden = Math.max(width, depth) + 1.1 >= 3.6;
	if (canWiden) dims[axis] = Math.max(3.6, dims[axis]);
	const target = Math.max(6, Math.min(programme.length * STORY + 1, dims[axis] / 0.6));
	return { dims, height: target - baseHeight - 0.16 - 1 };
}

function parcelFits(plan: Plan, w: number, d: number, shift = 0) {
	const { site } = plan;
	if (site.cells.length !== 1) return w <= site.width + 0.35 && d <= site.depth + 0.35;
	const [x, y] = site.center;
	return site.cells[0].corners.every(([u, v], i, ring) => {
		const [a, b] = ring[(i + 1) % ring.length],
			dx = a - u,
			dy = b - v;
		const distance =
			dx * (y - shift - v) -
			dy * (x - u) -
			Math.abs(dx) * (d / 2 + 0.08) -
			Math.abs(dy) * (w / 2 + 0.08);
		return distance >= -0.59 * Math.hypot(dx, dy);
	});
}
function accessShift(plan: Plan, depth: number) {
	const excess = (depth - plan.site.depth) / 2;
	return Math.max(0, Math.min(0.55 - excess, excess + 0.1));
}
function approachFits(plan: Plan, depth: number) {
	if (plan.site.cells.length !== 1) return true;
	const [x, y] = plan.site.center;
	const foot = y + plan.sign * (depth / 2 - accessShift(plan, depth) + 0.635);
	return plan.site.cells[0].corners.every(([u, v], i, ring) => {
		const [a, b] = ring[(i + 1) % ring.length],
			dx = a - u,
			dy = b - v;
		return dx * (foot - v) - dy * (x - u) - Math.abs(dy) * 0.31 >= -0.534 * Math.hypot(dx, dy);
	});
}
/** Chooses a plinth that clears the actual parcel perimeter. */
export function baseFor(plan: Plan) {
	const { width, depth } = plan.site;
	const k = blockBase(width, depth);
	return parcelFits(plan, k.w, k.d) ? k : { w: width, d: depth, height: k.height };
}
function acceptableCourse(plan: Plan, body: Body) {
	const { width, depth, programme, ground } = plan.site;
	const targetHeight = body.size[2];
	if (programme.length > 4) return (size: Point) => Math.abs(size[2] - targetHeight) <= 2;
	const widthLimited = Math.min(width, depth) >= 2.1 && Math.max(width, depth) + 1.2 < 3.6;
	return ([w, d, h]: Point) => {
		const top = body.position[2] - ground + h + 0.16;
		return top + 1 >= 5 && (widthLimited || Math.max(w, d) >= 0.6 * Math.max(6, top + 0.5));
	};
}

/** Seats uniformly scaled storey stock or fits a closed course to an incompatible envelope. */
export function fitBlock(body: Body, plan: Plan) {
	const { width, depth, programme } = plan.site;
	if (programme.length <= 4)
		body.size[2] = shortEnvelope(plan, body.position[2] - plan.site.ground).height;
	const initial = body.size;
	const accept = acceptableCourse(plan, body);
	const minimum = 0.85 * width * depth;
	for (const allowance of [0, 0.3, 0.6]) {
		body.size = [
			allowance === 0.6 ? width + 1.2 : Math.min(width + 1.1, initial[0] + 2 * allowance),
			Math.min(depth + 0.95, initial[1] + 2 * allowance),
			initial[2]
		];
		const extent = fitBandStock(
			body,
			minimum / (body.size[0] * body.size[1]),
			true,
			(extent) =>
				parcelFits(plan, extent[0], extent[1], plan.sign * accessShift(plan, extent[1])) &&
				approachFits(plan, extent[1]) &&
				accept(extent)
		);
		if (extent) {
			body.size = extent;
			body.position[1] -= plan.sign * accessShift(plan, body.size[1]);
			return;
		}
	}
	body.size =
		programme.length <= 4
			? [...shortEnvelope(plan, body.position[2] - plan.site.ground).dims, initial[2]]
			: [Math.min(initial[0], width - 0.1), Math.min(initial[1], depth - 0.1), initial[2]];
}
