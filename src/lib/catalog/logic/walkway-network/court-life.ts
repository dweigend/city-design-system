import { hashUnit } from '../../core/random';
import { available, fitting, mountFitting, type Reservation } from './town-scatter';
import type { Vec3 } from '../parametrik/types';

type Point = [number, number];

export type PublicSpace = { id: string; position: Vec3; area: number; polygon: Point[] };

/** Tests a point against the closed outline of a convex court or apron, in metres. */
export function insideCourt([x, y]: Point, polygon: Point[]) {
	const sides = polygon.map(([a, b], i) => {
		const [u, v] = polygon[(i + 1) % polygon.length];
		return (u - a) * (y - b) - (v - b) * (x - a);
	});
	return Math.min(...sides) >= 0 || Math.max(...sides) <= 0;
}
function fits(b: Reservation, space: PublicSpace, taken: Reservation[]) {
	if (!available(b, taken)) return false;
	return [-1, 1].every((i) =>
		[-1, 1].every((j) => insideCourt([b.x + (i * b.w) / 2, b.y + (j * b.d) / 2], space.polygon))
	);
}
function sites(space: PublicSpace, seed: number) {
	const [cx, cy] = space.position;
	const radius = Math.ceil(Math.max(...space.polygon.map(([x, y]) => Math.hypot(x - cx, y - cy))));
	const points: Point[] = [];
	for (let x = -radius; x <= radius; x += 0.5)
		for (let y = -radius; y <= radius; y += 0.5) points.push([cx + x, cy + y]);
	return points
		.map((p, i) => ({ p, rank: hashUnit(seed, space.id, i) - Math.hypot(p[0] - cx, p[1] - cy) }))
		.sort((a, b) => a.rank - b.rank);
}

type Placement = { box: Reservation; ids: readonly string[]; key: string };
type Survey = { space: PublicSpace; candidates: ReturnType<typeof sites>; seed: number };

function* positions(survey: Survey, ids: readonly string[], key: string, taken: Reservation[]) {
	const [w, d] = fitting(ids[0]).footprint;
	for (const {
		p: [x, y]
	} of survey.candidates) {
		const box = { x, y, w, d };
		if (fits(box, survey.space, taken)) yield { box, ids, key };
	}
}

const features = [
	['stepped-pools'],
	['cube-roof-grove-3p75m'],
	['kit-terrace-awning', 'kit-terrace-bench'],
	['kit-terrace-planter']
];
function* arrangements(survey: Survey, furnished: boolean): Generator<Placement[]> {
	if (!furnished) {
		yield [];
		return;
	}
	const first = Math.floor(hashUnit(survey.seed, survey.space.id, 'feature') * features.length);
	for (let i = 0; i < features.length; i++)
		for (const feature of positions(survey, features[(first + i) % features.length], 'feature', []))
			yield [feature];
}

function visitors(survey: Survey, furniture: Placement[], landing?: Vec3) {
	const { space, seed } = survey;
	const result = [...furniture],
		taken = result.map((p) => p.box);
	let remaining = Math.min(2, Math.max(1, Math.round(space.area / 120)));
	if (landing) {
		const near = {
			...survey,
			candidates: [...survey.candidates].sort(
				(a, b) =>
					Math.hypot(a.p[0] - landing[0], a.p[1] - landing[1]) -
					Math.hypot(b.p[0] - landing[0], b.p[1] - landing[1])
			)
		};
		const group = positions(near, ['kit-scatter-stand'], 'court/landing', taken).next().value;
		if (
			!group ||
			Math.hypot(group.box.x - landing[0], group.box.y - landing[1]) +
				Math.hypot(group.box.w, group.box.d) / 2 >
				4.2
		)
			return;
		taken.push(group.box);
		result.push(group);
		remaining--;
	}
	while (remaining > 0) {
		const pose = hashUnit(seed, space.id, remaining) < 0.5 ? 'stand' : 'walk';
		const visitor = positions(survey, ['kit-scatter-' + pose], 'court/' + remaining, taken).next()
			.value;
		if (!visitor) return;
		result.push(visitor);
		taken.push(visitor.box);
		remaining--;
	}
	return result;
}

/** Packs the whole seeded party and its fitting together, at native registry sizes. */
function courtLayout(space: PublicSpace, seed: number, furnished: boolean, landing?: Vec3) {
	const survey = { space, seed, candidates: sites(space, seed) };
	for (const furniture of arrangements(survey, furnished)) {
		const layout = visitors(survey, furniture, landing);
		if (layout) return layout;
	}
}

/** Projects the complete furniture and visitor layout onto its carrier. */
export function courtLife(space: PublicSpace, seed: number, furnished: boolean, landing?: Vec3) {
	const layout =
		courtLayout(space, seed, furnished, landing) ?? courtLayout(space, seed, furnished);
	if (layout)
		return layout.flatMap(({ ids, box, key }) =>
			ids.flatMap((id) => {
				const variants = fitting(id).variants;
				const variant = id.startsWith('cube-roof-grove')
					? 'grove'
					: variants[Math.floor(hashUnit(seed, space.id, key, id) * variants.length)];
				return mountFitting(
					id,
					variant,
					[box.x, box.y, space.position[2]],
					space.id + '/' + key,
					seed
				);
			})
		);
	throw new RangeError('No furnished layout fits public space ' + space.id);
}
