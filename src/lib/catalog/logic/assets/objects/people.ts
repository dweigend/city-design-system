import { block } from '../assembly';
import { rod, bulb } from '../parts';
import { bicycle, pushcart, wheel } from './deck-vehicles';
import { capsule, kitRecipe, rounded } from './kit-recipe';
import { figure, type Pose } from './figure';
import type { ObjectGeometry } from '../object-geometry';

type Prop = (variant: number) => ObjectGeometry[];
function person(
	id: string,
	pose: Pose,
	child = false,
	prop?: Prop,
	space: [number, number] = [1.25, 1.25],
	vehicle = false
) {
	return kitRecipe(
		'person-' + id,
		'neighbourhood-services',
		space,
		vehicle ? ['body', 'trim', 'accent', 'frame'] : ['body', 'trim', 'accent'],
		['relaxed', 'lifted-hand', 'broad-coat'],
		(v) => [...figure(pose, 0, 0, v, child), ...(prop?.(v) ?? [])]
	);
}
function group(id: string, poses: Pose[], childLast = false, spacing = 0.8) {
	return kitRecipe(
		'person-' + id,
		'neighbourhood-services',
		[1.25, poses.length === 3 ? 3.75 : 2.5],
		['body', 'accent', 'trim'],
		['relaxed', 'lifted-hand', 'broad-coat'],
		(v) =>
			poses.flatMap((p, i) =>
				figure(p, 0, (i - (poses.length - 1) / 2) * spacing, v, childLast && i === poses.length - 1)
			)
	);
}
function dog() {
	return [
		capsule([0.35, 0.4, 0.35], [0.7, 0.4, 0.35], 0.15, 'accent'),
		bulb([0.8, 0.4, 0.5], 0.15, 1, 'trim'),
		...[0.35, 0.7].flatMap((x) =>
			[0.3, 0.5].map((y) => capsule([x, y, 0.3], [x, y, 0.1], 0.1, 'body'))
		),
		rod([0, 0.2, 0.95], [0.65, 0.4, 0.45], 0.06, 'trim')
	];
}
function chair() {
	return [
		wheel(0, 0.35, 0.35),
		wheel(0, -0.35, 0.35),
		wheel(0.45, 0.25, 0.15),
		wheel(0.45, -0.25, 0.15),
		rounded(0.1, 0, 0.35, 0.6, 0.6, 0.1, 'frame'),
		block(-0.2, 0, 0.45, 0.12, 0.6, 0.55, 'frame'),
		...[-0.25, 0.25].map((y) => rod([0, y, 0.35], [0.45, y, 0.15], 0.06, 'frame'))
	];
}
function ladder() {
	return [
		...[-0.25, 0.25].map((y) => block(0.45, y, 0, 0.12, 0.12, 1.8, 'frame')),
		...[0.3, 0.6, 0.9, 1.2, 1.5].map((z) => block(0.45, 0, z, 0.12, 0.4, 0.12, 'frame'))
	];
}

export const people = [
	person('standing', 'stand'),
	person('waving', 'wave'),
	person('pointing', 'point'),
	person('looking-out', 'look'),
	person('walking-left', 'walk-left'),
	person('walking-right', 'walk-right'),
	person('running', 'run'),
	person('sitting', 'sit'),
	person('sitting-reading', 'sit', false, () => [block(0.3, 0, 0.67, 0.25, 0.4, 0.05, 'accent')]),
	person('railing-lean', 'lean'),
	person('stair-climb', 'step'),
	person(
		'crate-carrier',
		'carry',
		false,
		() => [block(0.4, 0, 1.05, 0.45, 0.45, 0.35, 'accent')],
		[2.5, 1.25]
	),
	person('cart-pusher', 'push', false, () => pushcart(1.05, 0, false), [3.75, 1.25], true),
	person(
		'watering',
		'carry',
		false,
		() => [
			rounded(0.45, 0, 0.85, 0.4, 0.3, 0.35, 'accent'),
			rod([0.6, 0, 0.95], [0.9, 0, 1.15], 0.06, 'trim')
		],
		[2.5, 1.25]
	),
	person('ladder-repair', 'reach', false, ladder, [1.25, 1.25], true),
	person(
		'at-workbench',
		'carry',
		false,
		() => [
			block(0.55, 0, 0.95, 0.6, 1, 0.15, 'frame'),
			...[-0.35, 0.35].map((y) => block(0.55, y, 0, 0.3, 0.3, 0.95, 'frame'))
		],
		[2.5, 1.25],
		true
	),
	person('bicycle-rider', 'ride', false, () => bicycle(0.15, 0, false), [2.5, 1.25], true),
	person('bicycle-walker', 'push', false, () => bicycle(0, 0.4, false), [2.5, 2.5], true),
	person('cargo-rider', 'ride', false, () => bicycle(0.15, 0, true), [3.75, 1.25], true),
	person('cargo-walker', 'push', false, () => bicycle(0, 0.4, true), [3.75, 2.5], true),
	person('pram-pusher', 'push', false, () => pushcart(1.05, 0, true), [3.75, 1.25], true),
	person('wheelchair-user', 'sit', false, chair, [2.5, 1.25], true),
	person('dog-walker', 'walk-left', false, dog, [2.5, 1.25]),
	person('reading', 'read', false, () => [block(0.3, 0, 1.25, 0.25, 0.4, 0.05, 'accent')]),
	person('child-standing', 'stand', true),
	person('child-waving', 'wave', true),
	person('child-walking', 'walk-left', true),
	person('child-running', 'run', true),
	person('child-climbing', 'step', true),
	person('child-pointing', 'point', true),
	group('walking-pair', ['walk-left', 'walk-right']),
	group('waiting-pair', ['stand', 'look']),
	group('greeting-pair', ['wave', 'stand']),
	group('seated-pair', ['sit', 'sit']),
	group('holding-child-hand', ['hand', 'hand'], true, 0.7),
	group('family-walk', ['walk-left', 'walk-right', 'walk-left'], true),
	group('waiting-trio', ['stand', 'look', 'stand']),
	group('tour-trio', ['point', 'look', 'look']),
	group('walking-trio', ['walk-left', 'walk-right', 'walk-left']),
	group('greeting-trio', ['wave', 'stand', 'wave'])
];
