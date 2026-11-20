import { publicStair } from './stair-track';
import type { Section } from './types';
import { houseSurfaces } from './surfaces';
import { fitsWinding } from './access';
import { planPoints } from './part-plan';
import { partsIntersect } from '../house-typology';
import { bodyParts } from './provider';
import { houseStructure } from './structure';
import { bounds } from '../ansicht/geometrie';
import type { StockPart } from './house-object';

type XY = [number, number];
const radius = publicStair.radius + publicStair.width / 2;
const margin = 0.6;

function axes(s: Section, rear: number, sign: number) {
	const { x, y, width, depth } = s.composition.bay;
	const reach = publicStair.radius + publicStair.width;
	const edge = (center: number, span: number) => [
		center - span / 2 + radius - margin,
		center + span / 2 - radius + margin
	];
	const xs = edge(x, width),
		ys = edge(y, depth);
	if (xs[0] > xs[1] || ys[0] > ys[1]) return [];
	const candidates: XY[] = [[x, rear + sign * reach]];
	for (const u of [x, ...xs])
		for (const v of [rear, y, rear + sign * radius, rear + sign * reach, ...ys])
			candidates.push([u, v]);
	for (const l of s.decks) {
		for (const side of [-1, 1]) {
			candidates.push([l.position[0] + side * (l.width / 2 + radius), l.position[1]]);
			candidates.push([l.position[0] + side * (l.width / 2 + radius), rear]);
			candidates.push([l.position[0], l.position[1] + side * (l.depth / 2 + radius)]);
		}
	}
	return candidates.filter(
		([u, v]) => u >= xs[0] - 1e-8 && u <= xs[1] + 1e-8 && v >= ys[0] - 1e-8 && v <= ys[1] + 1e-8
	);
}
function clearsDecks(s: Section, [x, y]: XY) {
	return s.decks.every((l) => {
		const dx = Math.abs(x - l.position[0]),
			dy = Math.abs(y - l.position[1]);
		return (
			(l.round
				? Math.hypot(dx, dy) - l.width / 2
				: Math.hypot(Math.max(0, dx - l.width / 2), Math.max(0, dy - l.depth / 2))) >=
			radius - 0.02
		);
	});
}
function insideBay(s: Section, p: StockPart) {
	const { x, y, width, depth } = s.composition.bay;
	return planPoints(p).every(
		([u, v]) =>
			Math.abs(u - x) <= width / 2 + margin + 1e-7 && Math.abs(v - y) <= depth / 2 + margin + 1e-7
	);
}
function obstacles(s: Section) {
	const stock = [
		...s.slots.flatMap((b) => bodyParts(b, houseSurfaces)),
		...houseStructure(s, houseSurfaces).filter((p) => p.source.objectId !== 'primitive-slab')
	];
	return stock.map((part) => {
		const ext = bounds(part);
		if ((part.kind === 'box' || part.kind === 'wedge') && part.rotation) {
			const pts = planPoints(part);
			for (const k of [0, 1] as const) {
				ext.min[k] = Math.min(...pts.map((p) => p[k]));
				ext.max[k] = Math.max(...pts.map((p) => p[k]));
			}
		}
		return { part, ext };
	});
}
function dockClearance(s: Section) {
	const stock = obstacles(s);
	const levels = new Map<number, typeof stock>();
	return (p: StockPart) => {
		const box = bounds(p),
			z = box.min[2];
		let row = levels.get(z);
		if (!row) {
			row = stock.filter(({ ext }) => ext.min[2] < box.max[2] - 0.02 && ext.max[2] > z + 0.02);
			levels.set(z, row);
		}
		return row.every(
			({ part, ext }) =>
				ext.min.some((v, k) => v >= box.max[k] - 0.02 || ext.max[k] <= box.min[k] + 0.02) ||
				!partsIntersect(p, part)
		);
	};
}
function parcelAxes(s: Section, rear: number, sign: number): XY[] {
	const [cx] = s.base;
	const reach = publicStair.radius + publicStair.width;
	return s.cells.flatMap((cell) => {
		const [x, y] = cell.center;
		const points: XY[] = [
			[x, y],
			[cx, y],
			[x, rear],
			[x, rear + sign * reach],
			[cx, rear + sign * reach]
		];
		for (const [i, a] of cell.corners.entries()) {
			const b = cell.corners[(i + 1) % 4],
				dx = b[0] - a[0],
				dy = b[1] - a[1],
				length = Math.hypot(dx, dy);
			const inset = (radius - margin) / length;
			for (const t of [0.25, 0.5, 0.75])
				points.push([a[0] + t * dx - inset * dy, a[1] + t * dy + inset * dx]);
		}
		return points;
	});
}
function inParcel(s: Section, [x, y]: XY) {
	return s.cells.some((c) =>
		c.corners.every(([u, v], i) => {
			const b = c.corners[(i + 1) % 4],
				dx = b[0] - u,
				dy = b[1] - v;
			return dx * (y - v) - dy * (x - u) >= -margin * Math.hypot(dx, dy) - 1e-7;
		})
	);
}
function parcelFit(s: Section, axis: XY) {
	// Reject axes outside the painted carrier before constructing the complete path.
	for (let i = 0; i < 24; i++) {
		const angle = (i * Math.PI) / 12;
		if (!inParcel(s, [axis[0] + radius * Math.cos(angle), axis[1] + radius * Math.sin(angle)]))
			return false;
	}
	return true;
}
/** Fits the actual winding stock and deck connections after all occupied levels have been seated. */
export function stairAxis(s: Section, rear: number, sign: number): XY | undefined {
	const seen = new Set<string>();
	let clear: ReturnType<typeof dockClearance> | undefined;
	for (const axis of [...axes(s, rear, sign), ...parcelAxes(s, rear, sign)]) {
		const key = axis.join('/');
		if (seen.has(key)) continue;
		seen.add(key);
		if (!clearsDecks(s, axis) || !parcelFit(s, axis)) continue;
		clear ??= dockClearance(s);
		const clearDock = clear;
		const inside = (p: StockPart) => insideBay(s, p) || planPoints(p).every((q) => inParcel(s, q));
		if (fitsWinding({ ...s, compact: false, stairAxis: axis }, inside, clearDock)) return axis;
	}
}
