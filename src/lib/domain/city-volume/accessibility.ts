import { accessibilityDefaults as config } from '../../../config/city-volume';
import { distance, type Vec2 } from '../../core/geometry';
import { Random } from '../../core/random';
import { cityVolumeConfig } from '../../../config/city-volume';
import { valueNoise } from './value-noise';

const span = (random: Random, min: number, max: number) => random.number({ min, max });

type GroundReading = Readonly<{ height: number; waterKind: string | null }>;
type Ground = (x: number, y: number) => GroundReading;

/** Determines which ground an approach may traverse. The default allows dry ground. */
export type CityApproachPolicy = Readonly<{ isWalkable: (reading: GroundReading) => boolean }>;
const dryGround: CityApproachPolicy = { isWalkable: ({ waterKind }) => waterKind === null };
type Walkable = CityApproachPolicy['isWalkable'];
type Route = (guide: readonly Vec2[], armKey: string, head: Vec2) => readonly Vec2[];
type Arm = { path: readonly Vec2[]; speed: number; entry: number; width: number };

const stepM = cityVolumeConfig.corridorStepM;
const probes = Math.ceil(stepM / cityVolumeConfig.corridorProbeStepM);

function walkableSegment(a: Vec2, b: Vec2, ground: Ground, walkable: Walkable) {
	for (let i = 1; i < probes; i++) {
		const t = i / probes;
		if (!walkable(ground(a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])))) return false;
	}
	return true;
}

function advance(
	point: Vec2,
	heading: number,
	bearing: number,
	ground: Ground,
	walkable: Walkable
): { point: Vec2; heading: number; score: number } | undefined {
	const current = ground(...point);
	const options = config.corridorTurnOptionsRad;
	let best: { point: Vec2; heading: number; score: number } | undefined;
	for (const angle of options) {
		const direction = heading + angle;
		const next: Vec2 = [
			point[0] + stepM * Math.cos(direction),
			point[1] + stepM * Math.sin(direction)
		];
		const middle = ground((point[0] + next[0]) / 2, (point[1] + next[1]) / 2);
		const end = ground(...next);
		if (!walkable(middle) || !walkable(end) || !walkableSegment(point, next, ground, walkable))
			continue;
		const rise = Math.abs(end.height - middle.height) + Math.abs(middle.height - current.height);
		const score =
			rise / config.corridorRiseCostScaleM +
			Math.abs(angle) * config.corridorTurnCost -
			config.corridorAlignmentBonus * Math.abs(Math.cos(direction - bearing));
		if (!best || score < best.score) best = { point: next, heading: direction, score };
	}
	return best;
}

function armPath(
	random: Random,
	head: Vec2,
	outward: number,
	bearing: number,
	ground: Ground,
	walkable: Walkable
) {
	const steps = Math.round(span(random, ...config.corridorStepRange));
	let heading =
		outward + span(random, -config.corridorHeadingOffsetRad, config.corridorHeadingOffsetRad);
	const turn =
		span(random, ...config.corridorCurvatureRangeRad) *
		(random.number() < /* Exact arithmetic: split the two directions evenly. */ 0.5 ? -1 : 1);
	const path = [head];
	for (let i = 0; i < steps; i++) {
		const next = advance(path[path.length - 1], heading + turn, bearing, ground, walkable);
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

function approachAccess(
	random: Random,
	head: Vec2,
	opposite: Vec2 | undefined,
	bearing: number,
	ground: Ground,
	route: Route | undefined,
	walkable: Walkable
) {
	const outward = opposite ? Math.atan2(head[1] - opposite[1], head[0] - opposite[0]) : bearing;
	const inland = opposite ? span(random, ...config.approachCenterOffsetRangeM) : 0;
	const toward =
		outward +
		span(random, -config.approachCenterBearingOffsetRad, config.approachCenterBearingOffsetRad);
	const inlandPoint: Vec2 = [
		head[0] + inland * Math.cos(toward),
		head[1] + inland * Math.sin(toward)
	];
	const center = walkable(ground(...inlandPoint)) ? inlandPoint : head;
	const spread = span(random, ...config.approachSpreadRange);
	const edge = valueNoise(random.derive('edge'), config.approachEdgeWavelengthM);
	const lobes = valueNoise(random.derive('lobes'), config.approachLobeWavelengthM);
	const count = Math.floor(
		span(
			random.derive('count'),
			/* Exact arithmetic: a crossing can have no arms. */ 0,
			config.approachArmCountLimit
		)
	);
	const phaseOffset = span(
		random.derive('bearing'),
		-config.approachBearingOffsetRad,
		config.approachBearingOffsetRad
	);
	const arms: Arm[] = Array.from({ length: count }, (_, index) => {
		const arm = random.derive('arm/' + index);
		const guide = armPath(
			arm,
			head,
			outward + phaseOffset + config.approachFanWidthRad * ((index + 0.5) / count - 0.5),
			bearing,
			ground,
			walkable
		);
		return {
			path: route ? route(guide, 'arm/' + index, head) : guide,
			speed: span(arm, ...config.approachArmSpeedRange),
			entry: span(arm, ...config.approachArmEntryRangeM),
			width: span(arm, ...config.approachArmWidthCostRange)
		};
	});
	const aspect = span(random, ...config.approachAspectRange);
	const phase =
		bearing + span(random, -config.approachPhaseOffsetRad, config.approachPhaseOffsetRad);
	const u = Math.cos(phase);
	const v = Math.sin(phase);
	return (point: Vec2, grade: number, clearance: number) => {
		const x = point[0] - center[0];
		const y = point[1] - center[1];
		const radial = Math.hypot(aspect * (x * u + y * v), y * u - x * v);
		const approach = distance(point, head);
		const travel = arms.reduce(
			(cost, arm) => Math.min(cost, armCost(arm, point)),
			Math.min(
				radial * spread,
				config.directApproachEntryM + config.directApproachCostRatio * approach
			)
		);
		const raggedness =
			Math.min(1, approach / config.approachNoiseFadeDistanceM) *
			(config.approachEdgeAmplitudeM * edge(...point) +
				config.approachLobeAmplitudeM * lobes(...point));
		return (
			travel +
			config.approachGradeCostM * grade -
			config.approachShoreBonusM * Math.exp(-Math.max(0, clearance) / config.approachShoreDecayM) +
			raggedness
		);
	};
}

/** Ranks ground from independently drawn approaches. Arms start at the given heads
 * and prefer shallow rises across walkable ground. The caller classifies which approach serves a point. */
export function cityAccessibility(
	seed: number,
	heads: readonly [first: Vec2, second?: Vec2],
	bearing: number,
	ground: Ground,
	useSecondApproach: (point: Vec2) => boolean,
	route?: Route,
	{ isWalkable } = dryGround
) {
	const random = Random.create({ seed }).derive('accessibility');
	const [first, second] = heads;
	const primary = approachAccess(
		random.derive('first-bank'),
		first,
		second,
		bearing,
		ground,
		route,
		isWalkable
	);
	if (!second) return primary;
	const secondary = approachAccess(
		random.derive('second-bank'),
		second,
		first,
		bearing,
		ground,
		route,
		isWalkable
	);
	const balance = random.derive('bank-balance');
	const bias =
		span(balance, ...config.approachBankBiasRangeM) *
		(balance.number() < /* Exact arithmetic: split the two directions evenly. */ 0.5 ? -1 : 1);
	return (point: Vec2, grade: number, clearance: number) =>
		useSecondApproach(point)
			? secondary(point, grade, clearance) + Math.max(0, bias)
			: primary(point, grade, clearance) + Math.max(0, -bias);
}
