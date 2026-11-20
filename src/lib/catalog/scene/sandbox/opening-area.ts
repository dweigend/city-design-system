import type { OpeningArea } from './view';

type Rect = NonNullable<OpeningArea['reserved']>[number];

function freeStrips(left: number, right: number, height: number, reserved: Rect[]) {
	const crossed = reserved
		.filter((r) => r.left < right && r.right > left)
		.sort((a, b) => a.top - b.top);
	const free: Rect[] = [];
	let top = 0;
	for (const r of crossed) {
		if (r.top > top) free.push({ left, right, top, bottom: Math.min(r.top, height) });
		top = Math.max(top, r.bottom);
	}
	if (top < height) free.push({ left, right, top, bottom: height });
	return free;
}

/** Fits beside overlapping phone controls when their usual horizontal gap closes. */
export function phoneOpeningArea(
	width: number,
	height: number,
	top: number,
	bottom: number,
	reserved: Rect[]
): OpeningArea {
	if (top < bottom) return { top, bottom, reserved };
	const edges = [...new Set([0, width, ...reserved.flatMap((r) => [r.left, r.right])])]
		.filter((x) => x >= 0 && x <= width)
		.sort((a, b) => a - b);
	const strips = edges.flatMap((left, i) =>
		edges.slice(i + 1).flatMap((right) => freeStrips(left, right, height, reserved))
	);
	const area = (r: Rect) => (r.right - r.left) * (r.bottom - r.top);
	const free = strips.sort((a, b) => area(b) - area(a))[0] ?? {
		left: 0,
		right: width,
		top: 0,
		bottom: height
	};
	return { ...free, reserved };
}
