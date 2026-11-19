import { shell } from '../assembly';
import { drum, cap } from '../parts';
import { panel } from '../objects/forms';
import type { ObjectGeometry } from '../object-geometry';
import { actionFigure } from './activities/action-figure';
import { feet, hands, sitting, upright } from './activities/props';
import { series } from './series';

const plug = series(
	'inhabited-modules',
	'deck',
	[5, 7.5, 10],
	['deep-porch', 'clerestory', 'winter-garden']
);
const floor = 0.5;
type Room = 'reading' | 'canteen' | 'nursery' | 'greenhouse' | 'studio' | 'lounge' | 'ticket';
function furnishings(room: Room, x: number): ObjectGeometry[] {
	switch (room) {
		case 'reading':
			return [
				panel(x, 0.17, floor, 0.85, 0.72, 0.44, 'slats'),
				panel(x, 0.48, 0.94, 0.85, 0.17, 0.55, 'slats')
			];
		case 'canteen':
			return [
				drum([x, 0.1, floor], 0.23, 0.44, 'slats'),
				panel(x, -0.7, floor, 0.34, 0.45, 0.72, 'body'),
				panel(x, -0.7, 1.22, 1.24, 0.66, 0.12, 'slats')
			];
		case 'nursery':
			return [
				panel(x, -0.8, floor, 0.82, 0.62, 0.28, 'slats'),
				cap([x, -0.8, 0.78], 0.28, 0.24, 'body')
			];
		case 'greenhouse':
			return [
				drum([x, -0.89, floor], 0.4, 0.54, 'slats'),
				cap([x, -0.89, 1.04], 0.45, 0.64, 'body')
			];
		case 'studio':
			return [
				panel(x, -0.9, floor, 0.38, 0.43, 0.9, 'body'),
				panel(x, -0.9, 1.4, 1.1, 0.75, 0.12, 'slats')
			];
		case 'lounge':
			return [
				panel(x, 0.13, floor, 1.08, 0.85, 0.46, 'slats'),
				panel(x, 0.51, 0.96, 1.05, 0.22, 0.48, 'body')
			];
		case 'ticket':
			return [
				panel(x, -0.94, floor, 1.22, 0.52, 0.92, 'body'),
				panel(x, -0.94, 1.42, 1.38, 0.68, 0.1, 'slats')
			];
	}
}
// The front glazing starts behind the structural lip. The rear is opaque for contrast.
function envelope(w: number, v: number) {
	const depth = 3.9,
		rise = 0.78 + 0.19 * v,
		spring = 2.65,
		entry = depth / 2 - 0.32;
	return [
		panel(0, 0, 0, w, depth, floor, 'body'),
		panel(0, -entry, floor, w - 0.28, 0.36, spring - floor, 'body'),
		...[-1, 1].map((side) =>
			panel(side * (w / 2 - 0.28), 0, floor, 0.46, depth - 0.18, spring - floor, 'body')
		),
		shell('vault', 0, 0, spring, w - 0.08, depth - 0.18, rise, 0.31, 'body'),
		panel(0, entry - 0.2, floor, w - 0.64, 0.12, spring - floor, 'glass'),
		shell('vault', 0, entry - 0.2, spring, w - 0.68, 0.14, rise - 0.18, 0.14, 'glass'),
		panel(0, entry + 0.16, 2.43, w - 0.32, 0.34, 0.26, 'body')
	];
}
const seated = new Set<Room>(['reading', 'canteen', 'lounge']);
function tenant(room: Room, x: number, i: number) {
	const pose = seated.has(room)
		? sitting(i % 3)
		: { hip: upright, lean: 0.1, feet: feet(0.19, -0.16), hands: hands(0.29, 0.22, 1.15) };
	if (room === 'nursery') {
		pose.hip = 0.6;
		pose.hands = hands(0.25, 0.17, 0.83);
	}
	const finish: Record<string, string> = { skin: 'slats', coat: 'body', gear: 'slats' };
	return actionFigure(pose, room === 'nursery', x, 0.12, floor).map((p) => ({
		...p,
		slot: finish[p.slot]
	}));
}
function moduleRoom(room: Room) {
	return plug(
		room + '-window-module',
		['body', 'glass', 'slats'],
		() => 4,
		(w, v) => {
			const n = Math.floor(w / 1.65);
			return [
				...envelope(w, v),
				...Array.from({ length: n }, (_, i) => {
					const x = ((i - (n - 1) / 2) * (w - 1.1)) / n;
					return [...furnishings(room, x), ...tenant(room, x, i)];
				}).flat()
			];
		}
	);
}
export const inhabited = (
	['reading', 'canteen', 'nursery', 'greenhouse', 'studio', 'lounge', 'ticket'] as const
).flatMap(moduleRoom);
