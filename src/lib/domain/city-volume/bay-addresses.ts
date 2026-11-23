import type { Vec3 } from '../../core/geometry';
import { planEdgeId } from '../terrain-grid';
import { columnBays, type CornerReader } from './foundation';

export type LatticePoint = Readonly<{ id: string; position: Vec3 }>;

export type Column = Readonly<{
	planCellId: string;
	corners: readonly LatticePoint[];
	neighbors: readonly (string | null)[];
	levels: number;
	groundAtHub?: number;
}>;

/** A coarse cell and its boundary in counterclockwise plan order. */
export type LatticeBay = Readonly<{
	id: string;
	planCellId: string;
	level: number;
	planCorners: readonly string[];
	floorFace: string;
	ceilingFace: string;
	sideFaces: readonly string[];
}>;

/** A canonical bay face. Its loop resolves in bayCorners and may repeat clamped contacts. */
export type BayFace = Readonly<{ id: string; corners: readonly string[] }>;

export type BayRings = Readonly<{
	id: string;
	level: number;
	bottom: readonly LatticePoint[];
	top: readonly LatticePoint[];
	groundAtHub?: number;
}>;

export const bayId = (cell: string, level: number) => `${cell}/level/${level}`;
const capId = (cell: string, level: number) => `cap/${bayId(cell, level)}`;
const sideId = (edge: string, level: number) => `side/${edge}/level/${level}`;

/** Builds the canonical addresses and visits their ground-clamped rings in plan order. */
export function bayAddresses(
	columns: readonly Column[],
	datumZ: number,
	anchors: CornerReader,
	visit?: (bay: BayRings, first: boolean) => void
) {
	const cells: LatticeBay[] = [];
	const faces = new Map<string, BayFace>();
	function addFace(id: string, points: readonly LatticePoint[]) {
		faces.set(id, Object.freeze({ id, corners: Object.freeze(points.map((point) => point.id)) }));
	}
	for (const column of columns) {
		const { planCellId } = column;
		const planCorners = Object.freeze(column.corners.map(({ id }) => id));
		const sides = planCorners.map((a, i) => {
			const j = (i + 1) % planCorners.length;
			const b = planCorners[j];
			const [from, to] = a < b ? [i, j] : [j, i];
			return { edge: planEdgeId(a, b), from, to };
		});
		let first = true;
		for (const { level, bottom, top } of columnBays(column, datumZ, anchors.read)) {
			const id = bayId(planCellId, level);
			const floorFace = capId(planCellId, level);
			const ceilingFace = capId(planCellId, level + 1);
			if (first) addFace(floorFace, bottom);
			addFace(ceilingFace, top);
			const sideFaces = sides.map(({ edge, from, to }) => {
				const face = sideId(edge, level);
				if (!faces.has(face)) addFace(face, [bottom[from], bottom[to], top[to], top[from]]);
				return face;
			});
			cells.push(
				Object.freeze({
					id,
					planCellId,
					level,
					planCorners,
					floorFace,
					ceilingFace,
					sideFaces: Object.freeze(sideFaces)
				})
			);
			visit?.({ id, level, bottom, top, groundAtHub: column.groundAtHub }, first);
			first = false;
		}
	}
	return {
		cells: Object.freeze(cells),
		faces: Object.freeze([...faces.values()]),
		bayCorners: Object.freeze([...anchors.points])
	};
}
