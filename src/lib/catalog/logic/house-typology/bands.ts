import { STORY } from '../../data/grid';
import { solid } from './objects';
import type { Body, Level, Plan, Point } from './types';

type Bay = (width: number, depth: number, fraction: number) => number[];
const full: Bay = (w, d) => [w, d];
const shapes: Partial<Record<Plan['type'], Bay>> = {
	'deck-tower': full,
	'portal-house': (w, d) => [w, d * 0.88],
	'lattice-head': (w, d) => [w * 0.62, d * 0.64],
	'courtyard-house': full,
	'terrace-house': (w, d, t) => [w * (1 - t * 0.48), d * (1 - t * 0.34)],
	'plinth-house': (w, d, t) => (t ? [w * 0.32, d * 0.5] : [w, d]),
	rack: (w, d) => [0.88 * w, Math.min(d, 5.3)],
	'bridge-house': (w, d) => [w, Math.min(d, 4.5)],
	'twin-stack': (w, d) => [w * 0.62, d],
	'slab-house': (w, d) => [w, Math.min(d, 3.25)],
	'water-house': (w, d, t) => (t ? [w * 0.62, d * 0.64] : [w, d])
};

function corners([x, y, z]: Point, w: number, d: number): Point[] {
	return [
		[-1, -1],
		[1, -1],
		[1, 1],
		[-1, 1]
	].map(([u, v]) => [x + (u * w) / 2, y + (v * d) / 2, z]);
}

/** Surveys a closed storey, its rear gallery and the alternating terrace at its flank. */
export function storeyBand(
	plan: Plan,
	i: number,
	course: number,
	use: Body['use']
): Level | undefined {
	const shape = shapes[plan.type];
	if (!shape) return;
	const { site, sign, rear } = plan;
	const fraction = i / Math.max(1, site.programme.length - 1);
	const [span, depth] = shape(
		site.width - 0.3,
		site.depth - site.accessDepth - (plan.type === 'water-house' ? 0.5 : 0),
		fraction
	);
	const width = Math.max(5, span);
	const shift = Math.min(1.25, Math.max(0.5, width * 0.065));
	const gallery = Math.min(1.25, Math.max(0.32, depth * 0.085));
	const w = width - shift,
		d = depth - gallery;
	const x = site.center[0],
		y = rear - (sign * depth) / 2,
		z = plan.datum + i * STORY;
	const position: Point = [x, y, z];
	const bodyPosition: Point = [x + ((-1) ** course * shift) / 2, y - (sign * gallery) / 2, z];
	const court =
		plan.type === 'courtyard-house'
			? { center: [x, y, z] as Point, width: Math.min(w, d) * 0.38 }
			: undefined;
	const band: Body = {
		id: site.id + '/level/' + i + '/body/0',
		objectId: 'primitive-slab',
		variant: 'rounded',
		seed: plan.seed,
		band: {
			shell: false,
			plinth: plan.type === 'plinth-house' && i === 0,
			court: court && { ...court, center: [x, y + sign * 0.3, z], width: court.width + 0.6 }
		},
		position: bodyPosition,
		size: [w, d, STORY - 0.3],
		use,
		kind: 'workshop',
		rotation: 0,
		scale: 1,
		nativeSize: [1, 1, 1],
		nativeCenter: [0, 0, 0],
		anchor: 'deck',
		facing: [0, sign]
	};
	return {
		position,
		width,
		depth,
		deckArea: width * depth - (court?.width ?? 0) ** 2,
		outline: corners(position, width, depth),
		round: false,
		programme: site.programme[i],
		kind: 'workshop',
		use,
		bodies: [band],
		court,
		landing: court
			? [x, court.center[1] + sign * (court.width / 2 + 0.15), z]
			: [x, rear - (sign * gallery) / 2, z]
	};
}

/** Cuts a bearing solid to the courtyard common to the rim and its inhabited band. */
export function bandSolid(block: ReturnType<typeof solid>, court: Level['court']) {
	if (!court) return block;
	const [w, d, h] = block.size,
		[x, y, z] = block.position;
	const ring = (pts: Point[]) => pts.map(([u, v]): [number, number] => [u, v]);
	return {
		...block,
		kind: 'prism' as const,
		z,
		height: h,
		polygon: ring(corners([x + w / 2, y + d / 2, z], w, d)),
		holes: [ring(corners(court.center, court.width, court.width)).reverse()]
	};
}
