import { worldSize, objectSlot } from './objects';
import type { Plan, Body, Point } from './types';
import type { Typology } from './families';

type Bay = { width: number; depth: number; direction: number };
type Envelope = (w: number, d: number, i: number, n: number) => Bay;
const bay = (width: number, depth: number, direction = 0) => ({ width, depth, direction });
const bar: Envelope = (w, d) => bay(w, Math.min(d, 5));
const mast: Envelope = (w, d, i) => bay(Math.min(w, 7.5), Math.min(d, 7.5), (-1) ** i);
const envelopes: Record<Typology, Envelope> = {
	'capsule-stack': mast,
	'cluster-mast': (w, d, i) => bay(Math.min(w, 6.25), Math.min(d, 6.25), [1, 0, -1, 0][i % 4]),
	'deck-tower': (w, d) => bay(w, Math.min(d, 10)),
	'round-tower': bar,
	'portal-house': (w, d) => bay(w, d),
	'lattice-head': (w, d) => bay(w / 2, Math.min(d, w / 2)),
	'courtyard-house': bar,
	'terrace-house': (w, d, i) =>
		w > 1.6 * d
			? bay(Math.max(Math.min(w, 8.9), w - i * 10), d, 1)
			: bay(w, Math.max(Math.min(d, 5.9), d - i * 10), 1),
	'plinth-house': (w, d, i) =>
		i ? bay(Math.max(5, w * 0.38), Math.max(3.25, d * 0.42), (-1) ** i) : bay(w, d),
	rack: (w, d) => bay(w, Math.min(d, 6)),
	'bridge-house': bar,
	'bell-house': (w, d, i) => (i ? bay(w, d) : bay(Math.min(3.75, w), Math.min(3.75, d))),
	'twin-stack': (w, d) => bay(w, Math.min(d, 6.25)),
	'slab-house': (w, d, i) => bay(w * (i ? 0.92 : 0.4), Math.min(d, 5.9), (-1) ** i),
	'water-house': (w, d, i) => (i ? bay(w, Math.min(d, 3.75)) : bay(w, d)),
	'tree-house': (w, d, i) => bay(Math.min(w, 7.5), Math.min(d, 5), [-1, 1, 0][i % 3])
};

function scaleBody(body: Body, scale: number): Body {
	return { ...body, scale, size: body.nativeSize.map((x) => x * scale) as Point };
}

function unit(plan: Plan, i: number, body: Body, width: number, depth: number) {
	const turn = ['cluster-mast', 'capsule-stack'].includes(plan.type)
		? i % 2
		: Number(depth > width);
	const rotation = (turn * Math.PI) / 2;
	const length = turn ? depth : width;
	const choice = [10, 7.5, 5].find((l) => l * 0.85 <= length) ?? 5;
	const shell = i % 8 >= 4 ? 'porthole' : 'ribbon';
	const spec =
		body.kind === 'capsule'
			? objectSlot(
					body.id,
					[
						'kit-capsule-' + shell + '-' + String(choice).replace('.', 'p') + 'm',
						'round-shoulder',
						'capsule'
					],
					body.use,
					plan.seed,
					rotation
				)
			: { ...body, rotation };
	const [w, d] = worldSize(spec);
	const limit = Math.min(1.15, width / w, depth / d, 2.78 / spec.size[2]);
	const fit = (span: number, size: number) => span / (Math.ceil(span / (size * limit)) * size);
	const scale = Math.max(
		0,
		...[limit, fit(width, w), fit(depth, d)]
			.filter((s) => s >= 0.85)
			.sort((a, b) => capacity(b) - capacity(a))
			.slice(0, 1)
	);
	function capacity(s: number) {
		return s * s * Math.floor((width + 1e-8) / (s * w)) * Math.floor((depth + 1e-8) / (s * d));
	}
	if (scale < 0.85) return undefined;
	return scaleBody(spec, scale);
}

/** Fills the typology envelope with whole registered units at their measured uniform scale. */
export function packedBodies(plan: Plan, i: number, first: Body, z: number) {
	const { site } = plan;
	const width = site.width - (plan.type === 'plinth-house' && !i ? 0.6 : 1.1),
		depth = site.depth - site.accessDepth - 1.55;
	const shape = envelopes[plan.type](width, depth, i, site.programme.length);
	const w = Math.max(2.5, Math.min(width, shape.width)),
		d = Math.max(2.5, Math.min(depth, shape.depth));
	const twin = plan.type === 'twin-stack';
	const single = plan.type === 'capsule-stack' || (plan.type === 'water-house' && i > 0);
	const paired = twin || plan.type === 'rack';
	const slotWidth = paired ? w * (twin ? 0.42 : 0.5) : w;
	const body =
		unit(plan, i, first, slotWidth, d) ??
		unit(plan, i, { ...first, kind: 'capsule' }, slotWidth, d);
	if (!body) return [];
	return fillGrid(plan, i, z, body, w, d, shape.direction, single, paired);
}
function gridDimensions(
	single: boolean,
	paired: boolean,
	rack: boolean,
	w: number,
	d: number,
	bw: number,
	bd: number
) {
	const cols = single ? 1 : paired ? 2 : Math.max(1, Math.floor((w + 1e-8) / bw));
	const rows = single || rack ? 1 : Math.max(1, Math.floor((d + 1e-8) / bd));
	return { cols, rows };
}
function fillGrid(
	plan: Plan,
	i: number,
	z: number,
	body: Body,
	w: number,
	d: number,
	direction: number,
	single: boolean,
	paired: boolean
) {
	const { site, sign, rear } = plan;
	const [bw, bd] = worldSize(body);
	const { cols, rows } = gridDimensions(single, paired, plan.type === 'rack', w, d, bw, bd);
	const spread = paired ? w : cols === 1 ? bw : Math.min(w, (cols * bw) / 0.87);
	const travel = Math.min(site.width - spread - 0.6, 1.25);
	const dx =
		plan.type === 'terrace-house'
			? (site.width - spread - 0.6) / 2
			: (direction || (-1) ** i) * Math.max(0, travel / 2);
	const pitch = (spread - bw) / (cols - 1 || 1);
	const units = Array.from({ length: cols * rows }, (_, k): Body => ({
		...body,
		id: body.id.replace(/\/0$/, '/' + k),
		facing: [0, sign],
		position: [
			site.center[0] + dx + ((k % cols) - (cols - 1) / 2) * pitch,
			rear - sign * (1.25 + (Math.floor(k / cols) + 0.5) * bd),
			z + 0.12
		]
	}));
	if (plan.type === 'rack' && units.length > 1)
		return units.filter((_, k) => (k + i * units.length) % 5 !== 4);
	return units;
}
