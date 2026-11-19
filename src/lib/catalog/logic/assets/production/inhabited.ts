import { castPlinth } from './cast-panel';
import { shell } from '../assembly';
import { drum, cap } from '../parts';
import { panel } from '../objects/forms';
import type { ObjectGeometry } from '../object-geometry';
import { actionFigure } from './activities/action-figure';
import { series } from './series';

const plug = series(
	'inhabited-modules',
	'deck',
	[5, 7.5, 10],
	['deep-porch', 'clerestory', 'winter-garden'],
	'slats'
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
// The sash slides behind a fixed light, leaving a full-height opening on both long faces.
function windowBay(w: number, v: number, y: number, slot: string) {
	const span = w - 0.86,
		side = y > 0 ? 1 : -1,
		width = span * (0.26 + v * 0.05);
	const x = side * (span / 2 - width / 2);
	return [
		panel(x, y, floor, width, 0.14, 1.98, slot),
		panel(x - side * width * 0.27, y + side * 0.17, floor, width, 0.14, 1.98, 'glass'),
		panel(x - side * width * 0.77, y + side * 0.17, floor, 0.13, 0.17, 1.98, 'body'),
		panel(0, y, 2.47, span, 0.18, 0.2, 'body')
	];
}
function envelope(w: number, v: number) {
	const depth = 3.9,
		rise = 0.78 + 0.19 * v,
		spring = 2.65,
		entry = depth / 2 - 0.32;
	return [
		castPlinth(w, depth, floor, 'body'),
		...windowBay(w, v, -entry, 'body'),
		...[-1, 1].map((side) =>
			panel(side * (w / 2 - 0.28), 0, floor, 0.46, depth - 0.18, spring - floor, 'body')
		),
		shell('vault', 0, 0, spring, w - 0.08, depth - 0.18, rise, 0.31, 'body'),
		...windowBay(w, v, entry - 0.2, 'glass'),
		shell('vault', 0, entry - 0.2, spring, w - 0.68, 0.14, rise - 0.18, 0.14, 'glass'),
		panel(0, entry + 0.16, 2.43, w - 0.32, 0.34, 0.26, 'body')
	];
}
const seated = new Set<Room>(['reading', 'canteen', 'lounge']);
function tenant(room: Room, x: number, i: number) {
	return actionFigure(seated.has(room) ? 'sit' : 'stand', [x, 0.12, floor], {
		child: room === 'nursery',
		heading: i * 0.87,
		slot: 'slats',
		sample: (i % 5) / 4
	});
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
