import type { Point } from './polyline';

type AxisInterval = { enter: number; exit: number; entryEdge: number; exitEdge: number };

function axisInterval(from: number, to: number, half: number): AxisInterval | null {
	if (from === to) {
		if (Math.abs(from) > half) return null;
		return {
			enter: -Infinity,
			exit: Infinity,
			entryEdge: /* Exact arithmetic: parallel interior segments have no active clip edges. */ 0,
			exitEdge: /* Exact arithmetic: parallel interior segments have no active clip edges. */ 0
		};
	}
	const entryEdge = to > from ? -half : half;
	const exitEdge = -entryEdge;
	return {
		enter: (entryEdge - from) / (to - from),
		exit: (exitEdge - from) / (to - from),
		entryEdge,
		exitEdge
	};
}

function axisCoordinate(from: number, to: number, t: number, axis: AxisInterval): number {
	if (t === 0) return from;
	if (t === 1) return to;
	if (t === axis.enter) return axis.entryEdge;
	if (t === axis.exit) return axis.exitEdge;
	return from + t * (to - from);
}

export function onBorder(point: Point, half: number): boolean {
	return Math.abs(point.x) === half || Math.abs(point.y) === half;
}

export function clipSegment(from: Point, to: Point, half: number) {
	const x = axisInterval(from.x, to.x, half);
	const y = axisInterval(from.y, to.y, half);
	if (!x || !y) return null;

	const enter = Math.max(0, x.enter, y.enter);
	const exit = Math.min(1, x.exit, y.exit);
	if (enter >= exit) return null;
	const at = (t: number) => ({
		x: axisCoordinate(from.x, to.x, t, x),
		y: axisCoordinate(from.y, to.y, t, y)
	});

	return {
		start: at(enter),
		end: at(exit),
		startsAtVertex: enter === 0,
		endsAtVertex: exit === 1,
		overlapsBorder:
			(from.x === to.x && Math.abs(from.x) === half) ||
			(from.y === to.y && Math.abs(from.y) === half)
	};
}
