import type { Vec3 } from '../../lib/core/geometry';
import { required } from '../../lib/core/invariant';
import { mesh } from '../../lib/core/mesh';
import type { Drawable } from '../../lib/scene/surface';
import { grove, rectangle, slab } from './district';

export type Condition = 'dry' | 'wet';
export type Measures = 'baseline' | 'sponge';

const tank = { west: 13, east: 39, south: -23, north: -10, wall: 0.9 };
const floor = 0.45;
const spillwayLip = 5;
const tankRim = 6.8;

const storageFrames = {
	baseline: {
		dry: { surfaceZ: 1.15, label: 'Shortage' },
		wet: { surfaceZ: spillwayLip, label: 'Overflowing' }
	},
	sponge: {
		dry: { surfaceZ: 3.2, label: 'Buffer available' },
		wet: { surfaceZ: 4.2, label: 'Buffered' }
	}
} as const;

const { west, east, south, north, wall } = tank;
const outlet = [23, 29] as const;
const lining = '--ground-stone';
const rim = '--ink-2';
// The water run passes above the power main where the two routes cross.
export const waterSupply: Vec3 = [east - 4, north, 1.18];

export const waterworks = [
	slab('cistern/floor', rectangle(west, south, east, north), 0, floor, lining),
	slab('cistern/back-wall', rectangle(west, north - wall, east, north), floor, tankRim, lining),
	slab(
		'cistern/west-wall',
		rectangle(west, south + wall, west + wall, north - wall),
		floor,
		tankRim,
		lining
	),
	slab(
		'cistern/east-wall',
		rectangle(east - wall, south + wall, east, north - wall),
		floor,
		tankRim,
		lining
	),
	slab(
		'cistern/front-wall',
		rectangle(west, south, east, south + wall),
		floor,
		spillwayLip - 0.16,
		lining
	),
	slab(
		'cistern/left-shoulder',
		rectangle(west, south, outlet[0], south + wall),
		spillwayLip - 0.16,
		tankRim,
		lining
	),
	slab(
		'cistern/right-shoulder',
		rectangle(outlet[1], south, east, south + wall),
		spillwayLip - 0.16,
		tankRim,
		lining
	),
	slab(
		'cistern/spillway',
		rectangle(outlet[0], south, outlet[1], south + wall),
		spillwayLip - 0.16,
		spillwayLip,
		rim
	),
	slab('swale/floor', rectangle(-33, -22, 5, -11), -1.8, -1.55, lining),
	slab('district/plinth', rectangle(-45, -28, 45, 29), -3.4, -1.8, '--ground-stone'),
	slab('district/north', rectangle(-45, -9, 45, 29), -1.8, 0, '--paper-2'),
	slab('district/south', rectangle(-45, -28, 45, -24), -1.8, 0, '--paper-2'),
	slab('district/west', rectangle(-45, -24, -35, -9), -1.8, 0, '--paper-2'),
	slab('district/east', rectangle(7, -24, 45, -9), -1.8, 0, '--paper-2')
];

function spill() {
	const stream = mesh();
	stream.ribbon(
		[
			[26, south + wall, spillwayLip + 0.05],
			[26, south - 0.16, spillwayLip + 0.05],
			[26, south - 2, 0.28]
		],
		5.2,
		0.18
	);
	return [
		{
			id: 'cistern/overflow',
			shape: required(stream.shape(), 'cistern spill'),
			color: '--water',
			finish: 'matte'
		} as const,
		slab(
			'cistern/overflow-apron',
			[
				[19, -27.5],
				[31, -27.5],
				[34, -25],
				[30, -23.5],
				[22, -23.5],
				[18, -25.6]
			],
			0.02,
			0.26,
			'--river-water'
		)
	];
}

export function storage(condition: Condition, measures: Measures) {
	const frame = storageFrames[measures][condition];
	const drawables = [
		slab(
			'cistern/water',
			rectangle(west + wall, south + wall, east - wall, north - wall),
			floor,
			frame.surfaceZ,
			'--water'
		)
	];
	if (frame.label === 'Shortage') {
		drawables.push(
			slab(
				'cistern/shortage-marker',
				rectangle(west + 2, south - 0.17, east - 2, south),
				2.6,
				3.4,
				'--signal'
			),
			slab(
				'cistern/minimum-line',
				rectangle(west + wall, north - wall - 0.16, east - wall, north - wall),
				2.6,
				3,
				'--signal'
			)
		);
	}
	if (frame.label === 'Overflowing') drawables.push(...spill());
	return { ...frame, drawables };
}

const plantingBed = rectangle(-32, -12.9, 4, -9.6);
const plantedBank = grove('swale/planting', plantingBed, 0.04, 63);

function swaleBanks(planted: boolean): Drawable {
	const banks = mesh();
	const inner = rectangle(-33, -22, 5, -11);
	const outer = rectangle(-35, -24, 7, -9);
	banks.append({
		kind: 'mesh',
		positions: [
			...outer.flatMap(([x, y]) => [x, y, 0]),
			...inner.flatMap(([x, y]) => [x, y, -1.55])
		],
		indices: [0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7]
	});
	return {
		id: 'swale/banks',
		shape: required(banks.shape(), 'swale banks'),
		color: planted ? '--cat-lawn' : lining,
		finish: 'matte'
	};
}

export function retention(condition: Condition, measures: Measures): Drawable[] {
	const planted = measures === 'sponge';
	const banks = swaleBanks(planted);
	if (!planted && condition === 'dry') return [banks];
	if (!planted) {
		return [banks, slab('swale/runoff', rectangle(-33, -18, 5, -15), -1.54, -1.1, '--river-water')];
	}
	return [
		banks,
		slab('swale/planting-terrace', plantingBed, -1.55, 0, '--terrain-soil'),
		...plantedBank,
		slab(
			'swale/retained-water',
			condition === 'wet' ? rectangle(-33, -22, 5, -13) : rectangle(-31, -20, 3, -15),
			-1.54,
			condition === 'wet' ? -0.42 : -1.32,
			'--river-water'
		)
	];
}
