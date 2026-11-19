import { drum, cap, rod } from '../parts';
import { panel } from '../objects/forms';
import { actionFigure, type Gesture } from './activities/action-figure';
import { feet, hands, sitting, upright } from './activities/props';
import { ride } from './activities/ride';
import type { ObjectGeometry } from '../object-geometry';
import { series } from './series';

const plaza = series(
	'occupied-decks',
	'deck',
	[5, 7.5, 10],
	['neighbours', 'small-party', 'crowd']
);
type Place = 'reading' | 'stop' | 'skate' | 'work' | 'play' | 'lookout' | 'market';
// The public seating and its scale figures share timber, coated members and glazed bodies.
function crossingSlots(parts: ObjectGeometry[]) {
	const slots: Record<string, string> = { skin: 'slats', coat: 'body', gear: 'frame' };
	return parts.map((p) => ({ ...p, slot: slots[p.slot] }));
}
function furniture(place: Place, w: number): ObjectGeometry[] {
	switch (place) {
		case 'reading':
			return [
				panel(0, 0, 0, 0.83, w - 0.5, 0.43, 'slats'),
				panel(-0.39, 0, 0.43, 0.15, w - 0.54, 0.55, 'frame')
			];
		case 'stop':
			return [
				panel(-0.7, -w / 2 + 0.52, 0, 0.5, 0.55, 2.6, 'frame'),
				panel(-0.7, -w / 2 + 0.52, 2.4, 0.32, 0.82, 0.6, 'body'),
				panel(-0.92, 0, 0, 0.38, w - 0.45, 0.68, 'slats')
			];
		case 'skate':
			return [
				panel(-0.98, 0, 0, 0.58, w - 0.4, 0.27, 'slats'),
				panel(-1, 0, 0.27, 0.64, w - 0.32, 0.12, 'frame')
			];
		case 'work':
			return [
				panel(0.88, 0, 0.84, 1, w - 0.8, 0.18, 'slats'),
				...[-1, 1].map((s) => panel(0.88, s * w * 0.31, 0, 0.88, 0.32, 0.84, 'frame')),
				drum([0.87, 0, 1.02], 0.25, 0.32, 'body')
			];
		case 'play':
			return [
				panel(0.92, 0, 0, 1, w - 0.5, 0.25, 'slats'),
				...[-1, 1].map((s) => cap([0.92, s * w * 0.25, 0.25], 0.44, 0.55, 'body'))
			];
		case 'lookout':
			return [0, 1, 2].flatMap((i) => {
				const tread = (w - 0.3) / 3,
					x = (i - 1) * tread;
				return [
					panel(x, 0, 0, tread + 0.015, w - 0.16, 0.19 * (i + 1), 'slats'),
					panel(x, w / 2 - 0.24, 0.19 * (i + 1), tread, 0.31, 0.32, 'frame')
				];
			});
		case 'market':
			return [
				panel(0.9, 0, 0, 0.8, w - 0.8, 0.86, 'slats'),
				...[-1, 0, 1].map((t) => cap([0.9, t * w * 0.25, 0.86], 0.36, 0.31, 'body'))
			];
	}
}
function gesture(place: Place, i: number): Gesture {
	if (place === 'reading') return sitting(i);
	if (place === 'play')
		return {
			hip: 0.55,
			lean: 0.12,
			feet: feet(0.13, -0.15, 0.08),
			hands: [
				[0.28, -0.2, 0.86],
				[0.19, 0.27, 1.01 + i * 0.06]
			]
		};
	const targets =
		place === 'work' || place === 'market' ? hands(0.48, 0.2, 1.07) : hands(0.18, 0.22, 0.86);
	if (place === 'lookout') targets[1] = [0.47, 0.24, 1.47 + i * 0.05];
	return { hip: upright, lean: 0.1, feet: feet(0.14, -0.17), hands: targets };
}
function visitor(place: Place, row: number, column: number, x: number, y: number, z: number) {
	const active = row === 0 || place === 'lookout';
	const pose = gesture(active ? place : 'stop', column % 3);
	const heading = active ? 0 : Math.PI * ([0.54, -0.46, 0.88][column % 3] + 0.16 * row);
	const members = crossingSlots(actionFigure(pose, place === 'play' && active, x, y, z, heading));
	if (place === 'reading' && active) members.push(panel(0.43, y, 0.91, 0.25, 0.42, 0.075, 'body'));
	if (place === 'work' && active)
		members.push(rod([0.46, y + 0.2, 1.08], [0.74, y + 0.14, 1.04], 0.065, 'frame'));
	return members;
}
// The leading ankle rests on the upper tread. The trailing foot stays on the lower tread.
function stairVisitor(row: number, col: number, w: number, y: number) {
	const tread = (w - 0.3) / 3,
		x = (row - 1) * tread,
		z = 0.19 * (row + 1);
	if (row === 2 || col % 2 === 0) return visitor('lookout', row, col, x, y, z);
	const pose = gesture('stop', col);
	pose.lean = 0.18;
	pose.feet = [
		[0.28, -0.14, 0.29],
		[-0.24, 0.14, 0.1]
	];
	return crossingSlots(actionFigure(pose, false, x + tread / 2, y, z));
}
function scene(place: Place) {
	return plaza(
		place + '-public-deck',
		['frame', 'slats', 'body'],
		(w) => w,
		(w, v) => {
			const columns = w >= 7.5 ? 5 : 3;
			const crowd = Array.from({ length: (v + 1) * columns }, (_, i) => {
				const row = Math.floor(i / columns),
					column = i % columns;
				const y = ((column - (columns - 1) / 2) * (w - 1.6)) / columns;
				if (place === 'skate' && i === Math.floor(columns / 2)) {
					const rider = ride('skater', v);
					return crossingSlots([...actionFigure(rider.pose, false), ...rider.props]);
				}
				if (place === 'lookout') return stairVisitor(row, column, w, y);
				return visitor(
					place,
					row,
					column,
					[0, -w * 0.33, w * 0.35][row],
					y + Math.sin(row * column) * 0.2,
					0
				);
			});
			return [...furniture(place, w), ...crowd.flat()];
		}
	);
}
export const occupiedDecks = (
	['reading', 'stop', 'skate', 'work', 'play', 'lookout', 'market'] as const
).flatMap(scene);
