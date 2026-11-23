import { distance, type Vec2 } from '../../core/geometry';
import { Random } from '../../core/random';
import { cityVolumeConfig } from './config';
import { valueNoise } from './value-noise';

const span = (random: Random, min: number, max: number) => random.number({ min, max });

type Ground = (x: number, y: number) => Readonly<{ height: number; waterKind: string | null }>;
type Route = (guide: readonly Vec2[], armKey: string, head: Vec2) => readonly Vec2[];
type Arm = { path: readonly Vec2[]; speed: number; entry: number; width: number };

const stepM = cityVolumeConfig.corridorStepM;
const probes = Math.ceil(stepM / cityVolumeConfig.corridorProbeStepM);

function drySegment(a: Vec2, b: Vec2, ground: Ground) {
	for (let i = 1; i < probes; i++) {
		const t = i / probes;
		if (ground(a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])).waterKind !== null) return false;
	}
	return true;
}

function advance(
	point: Vec2,
	heading: number,
	bearing: number,
	ground: Ground
): { point: Vec2; heading: number; score: number } | undefined {
	const current = ground(...point);
	const options = [-0.85, -0.42, 0, 0.42, 0.85];
	let best: { point: Vec2; heading: number; score: number } | undefined;
	for (const angle of options) {
		const direction = heading + angle;
		const next: Vec2 = [
			point[0] + stepM * Math.cos(direction),
			point[1] + stepM * Math.sin(direction)
		];
		const middle = ground((point[0] + next[0]) / 2, (point[1] + next[1]) / 2);
		const end = ground(...next);
		if (middle.waterKind !== null || end.waterKind !== null || !drySegment(point, next, ground))
			continue;
		const rise = Math.abs(end.height - middle.height) + Math.abs(middle.height - current.height);
		const score = rise / 5 + Math.abs(angle) * 0.9 - 0.25 * Math.abs(Math.cos(direction - bearing));
		if (!best || score < best.score) best = { point: next, heading: direction, score };
	}
	return best;
}

function armPath(random: Random, head: Vec2, outward: number, bearing: number, ground: Ground) {
	const steps = Math.round(span(random, 8, 23));
	let heading = outward + span(random, -0.29, 0.29);
	const turn = span(random, 0.035, 0.115) * (random.number() < 0.5 ? -1 : 1);
	const path = [head];
	for (let i = 0; i < steps; i++) {
		const next = advance(path[path.length - 1], heading + turn, bearing, ground);
		if (!next) break;
		path.push(next.point);
		heading = next.heading;
	}
	return path;
}

function armCost({ path, speed, entry, width }: Arm, [x, y]: Vec2) {
	let cost = Infinity;
	let along = 0;
	for (let i = 1; i < path.length; i++) {
		const [ax, ay] = path[i - 1];
		const dx = path[i][0] - ax;
		const dy = path[i][1] - ay;
		const length = Math.hypot(dx, dy);
		if (length === 0) continue;
		const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (length * length)));
		const lateral = Math.hypot(x - ax - t * dx, y - ay - t * dy);
		cost = Math.min(cost, entry + (along + t * length) / speed + lateral * width);
		along += length;
	}
	return cost;
}

function bankAccess(
	random: Random,
	head: Vec2,
	opposite: Vec2 | undefined,
	bearing: number,
	ground: Ground,
	route: Route | undefined
) {
	const outward = opposite ? Math.atan2(head[1] - opposite[1], head[0] - opposite[0]) : bearing;
	const inland = opposite ? span(random, 150, 430) : 0;
	const toward = outward + span(random, -1.22, 1.22);
	const inlandPoint: Vec2 = [
		head[0] + inland * Math.cos(toward),
		head[1] + inland * Math.sin(toward)
	];
	const center = ground(...inlandPoint).waterKind === null ? inlandPoint : head;
	const spread = span(random, 1.8, 2.45);
	const edge = valueNoise(random.derive('edge'), 210);
	const lobes = valueNoise(random.derive('lobes'), 530);
	const count = Math.floor(span(random.derive('count'), 0, 4));
	const phaseOffset = span(random.derive('bearing'), -0.42, 0.42);
	const arms: Arm[] = Array.from({ length: count }, (_, index) => {
		const arm = random.derive('arm/' + index);
		const guide = armPath(
			arm,
			head,
			outward + phaseOffset + 2.35 * ((index + 0.5) / count - 0.5),
			bearing,
			ground
		);
		return {
			path: route ? route(guide, 'arm/' + index, head) : guide,
			speed: span(arm, 2.7, 4.8),
			entry: span(arm, 5, 90),
			width: span(arm, 1.58, 2.1)
		};
	});
	const aspect = span(random, 0.68, 1.6);
	const phase = bearing + span(random, -1.55, 1.55);
	const u = Math.cos(phase);
	const v = Math.sin(phase);
	return (point: Vec2, grade: number, clearance: number) => {
		const x = point[0] - center[0];
		const y = point[1] - center[1];
		const radial = Math.hypot(aspect * (x * u + y * v), y * u - x * v);
		const approach = distance(point, head);
		const travel = arms.reduce(
			(cost, arm) => Math.min(cost, armCost(arm, point)),
			Math.min(radial * spread, 70 + 2.85 * approach)
		);
		const raggedness = Math.min(1, approach / 350) * (125 * edge(...point) + 620 * lobes(...point));
		return travel + 240 * grade - 18 * Math.exp(-Math.max(0, clearance) / 55) + raggedness;
	};
}

/** Ranks dry ground from independently drawn bank approaches. Arms start at the given heads
 * and take dry, shallow-rise steps along the valley. The caller supplies the bank classifier. */
export function cityAccessibility(
	seed: number,
	heads: readonly [first: Vec2, second?: Vec2],
	bearing: number,
	ground: Ground,
	secondBank: (point: Vec2) => boolean,
	route?: Route
) {
	const random = Random.create({ seed }).derive('accessibility');
	const [first, second] = heads;
	const primary = bankAccess(random.derive('first-bank'), first, second, bearing, ground, route);
	if (!second) return primary;
	const secondary = bankAccess(random.derive('second-bank'), second, first, bearing, ground, route);
	const balance = random.derive('bank-balance');
	const bias = span(balance, 250, 465) * (balance.number() < 0.5 ? -1 : 1);
	return (point: Vec2, grade: number, clearance: number) =>
		secondBank(point)
			? secondary(point, grade, clearance) + Math.max(0, bias)
			: primary(point, grade, clearance) + Math.max(0, -bias);
}
