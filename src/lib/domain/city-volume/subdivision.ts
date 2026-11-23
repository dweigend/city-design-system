import { planEdgeId } from '../terrain-grid';
import { cityVolumeConfig } from './config';
import type { LatticeBay } from './bay-addresses';

/** A child bay and its six face loops of logical point IDs. */
export type ChildBay = Readonly<{
	id: string;
	floorFace: ChildBayFace;
	ceilingFace: ChildBayFace;
	sideFaces: readonly ChildBayFace[];
}>;

/** A child face with an undirected address, a point loop and undirected edge addresses. */
export type ChildBayFace = Readonly<{
	id: string;
	corners: readonly string[];
	edges: readonly string[];
}>;

function face(points: string[]): ChildBayFace {
	return Object.freeze({
		id: JSON.stringify([...points].sort()),
		corners: Object.freeze(points),
		edges: Object.freeze(
			points.map((a, i) => JSON.stringify([a, points[(i + 1) % points.length]].sort()))
		)
	});
}

/** Splits the plan into one kite per corner, then halves each kite vertically. Quads yield
 * 2×2×2 bays. Adjacent bays agree on edge midpoints and levels even where ground clamps
 * their coarse corners. These logical addresses carry no interpolated positions. */
export function subdivideBay(bay: LatticeBay): readonly ChildBay[] {
	const { id, planCellId, planCorners, level } = bay;
	const midpoint = (a: string, b: string) => `edge/${planEdgeId(a, b)}`;
	return Object.freeze(
		planCorners.flatMap((corner, i) => {
			const previous = planCorners[(i + planCorners.length - 1) % planCorners.length];
			const next = planCorners[(i + 1) % planCorners.length];
			const kite = [
				`vertex/${corner}`,
				midpoint(corner, next),
				`cell/${planCellId}`,
				midpoint(previous, corner)
			];
			const ring = (offset: number) => kite.map((point) => `${point}/level/${level + offset}`);
			const count = cityVolumeConfig.verticalChildCount;
			const rings = Array.from({ length: count + 1 }, (_, i) => ring(i / count));
			return rings.slice(0, -1).map((low, half) => {
				const high = rings[half + 1];
				return Object.freeze({
					id: `${id}/child/${JSON.stringify([corner, half])}`,
					floorFace: face(low),
					ceilingFace: face(high),
					sideFaces: Object.freeze(
						low.map((a, j) => {
							const k = (j + 1) % low.length;
							return face([a, low[k], high[k], high[j]]);
						})
					)
				});
			});
		})
	);
}
