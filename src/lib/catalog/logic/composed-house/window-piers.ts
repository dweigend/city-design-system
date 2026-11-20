import type { StockPart } from './house-object';

type XY = [number, number];
type Plate = Extract<StockPart, { kind: 'prism' }>;
const along = (a: XY, b: XY, t: number): XY => [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];

/** Divides a ribbon into glazed bays with solid piers spanning from wall face to pane. */
export function windowPiers(face: XY[], pane: XY[], stock: Plate): Plate[] {
	return face.flatMap((a, i) => {
		const j = (i + 1) % face.length,
			b = face[j];
		const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
		if (length < 2.5 || (pane[i][0] === a[0] && pane[i][1] === a[1])) return [];
		const bays = Math.ceil(length / 3.4);
		return Array.from({ length: bays }, (_, k) => {
			const center = (k + 0.5) / bays,
				half = 0.22 / length;
			const left = center - half,
				right = center + half;
			return {
				...stock,
				id: stock.id + '/' + i + '/' + k,
				holes: [],
				polygon: [
					along(a, b, left),
					along(a, b, right),
					along(pane[i], pane[j], right),
					along(pane[i], pane[j], left)
				]
			};
		});
	});
}
