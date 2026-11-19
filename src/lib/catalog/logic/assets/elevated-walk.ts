import { panel } from './objects/forms';

/** An elevated walkway section with solid parapets and a shallow continuous glazed coping. */
export function elevatedWalk(length: number, width: number, level: number) {
	const edge = width / 2 - 0.12;
	return [
		panel(0, 0, level, length, width, 0.36, 'deck'),
		...[-edge, edge].flatMap((y) => [
			panel(0, y, level + 0.36, length, 0.24, 0.66, 'deck'),
			panel(0, y, level + 1.02, length, 0.18, 0.18, 'glass')
		])
	];
}
