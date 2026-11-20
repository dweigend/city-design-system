import { contours } from '../linear-path';
import type { Vec3, Primitive } from '../parametrik/types';
import { required } from '../required';
import type { Band } from './town-path';

type Face = Extract<Primitive, { kind: 'prism' }>;
const pair = (a: Vec3, b: Vec3) => [a.join(','), b.join(',')].sort().join('>');
/** Walking outline between the two ordered, parallel edge surveys. */
export function outline(left: Vec3[], right: Vec3[]) {
	return [...left, ...right.toReversed()].map(([x, y]): [number, number] => [x, y]);
}
function trace(stations: Vec3[], bands: Map<string, Band>) {
	const left: Vec3[] = [],
		right: Vec3[] = [],
		ids: string[] = [];
	for (const [i, p] of stations.slice(1).entries()) {
		const from = stations[i];
		const band = required(bands.get(pair(from, p)), 'level path band'),
			forward = band.span.a === from || band.span.a.join(',') === from.join(',');
		left.push(...(forward ? band.left : band.right.toReversed()).slice(Number(i > 0)));
		right.push(...(forward ? band.right : band.left.toReversed()).slice(Number(i > 0)));
		ids.push(band.span.id);
	}
	return { ids, polygon: outline(left, right) };
}
/** Removes interior cross-sections from uninterrupted level runs. A clipped
 * plaza mouth stays a boundary. Closed rings use two simple polygons. */
export function levelRuns(parts: Primitive[], bands: Band[]) {
	const faces = new Map(parts.flatMap((p) => (p.kind === 'prism' ? [[p.id, p] as const] : [])));
	const groups = new Map<string, Band[]>(),
		replaced = new Map<string, Face[]>();
	for (const b of bands) {
		const { id, a, b: end } = b.span,
			face = faces.get(id);
		if (!face || a[2] !== end[2] || !intact(face, b)) continue;
		const group = groups.get(face.token) ?? [];
		group.push(b);
		groups.set(face.token, group);
	}
	for (const group of groups.values()) {
		const records = new Map(group.map((b) => [pair(b.span.a, b.span.b), b]));
		const paths = contours(group.map((b) => [b.span.a, b.span.b]));
		for (const path of paths.flatMap(openRuns)) {
			if (path.length < 3) continue;
			const { ids, polygon } = trace(path, records);
			for (const id of ids) replaced.set(id, []);
			replaced.set(ids[0], [{ ...required(faces.get(ids[0]), 'level surface'), polygon }]);
		}
	}
	return parts.flatMap((p) => replaced.get(p.id) ?? [p]);
}
function intact(face: Face, b: Band) {
	const polygon = outline(b.left, b.right);
	return (
		face.polygon.length === polygon.length &&
		face.polygon.every(([x, y], i) => x === polygon[i][0] && y === polygon[i][1])
	);
}
function openRuns(path: Vec3[]) {
	if (path[0].join(',') !== path[path.length - 1].join(',')) return [path];
	const middle = Math.floor(path.length / 2);
	return [path.slice(0, middle + 1), path.slice(middle)];
}
