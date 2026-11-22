import { defineParams, resolveParams, type ParamOverrides } from '../../core/params';
import { blockInputs } from '../../data/block-inputs';
import type { CellPoint } from '../cell-space';
import type { GroundPlan, GroundPlanCell } from '../city-plan';
import { required } from '../required';

const profile = defineParams({
	denseHeightM: { ...blockInputs.height, label: 'Dense district height', default: 24 },
	lowHeightM: { ...blockInputs.height, label: 'Low district height', default: 7 }
});

export type VolumeOptions = ParamOverrides<typeof profile> & {
	/** Persistent adjacent ground addresses. Defaults to the anchor and its first lexical neighbour. */
	readonly refineGroundPair?: readonly [string, string];
};
export type Vertex = { id: string; x: number; y: number; ground: number; canopy: number };
export type Column = { id: string; groundId: string; ring: Vertex[] };

function districtCenter(plan: GroundPlan, regime: GroundPlanCell['regime']) {
	const id = plan.centres.find((centre) => centre.regime === regime)?.cellId;
	return required(
		plan.cells.find((cell) => cell.id === id),
		regime
	).center;
}

function heightAt(plan: GroundPlan, options: ParamOverrides<typeof profile>, clearance: number) {
	const { denseHeightM, lowHeightM } = resolveParams(profile, undefined, options);
	if (lowHeightM <= clearance || denseHeightM < lowHeightM)
		throw new RangeError('Expected clearance < low height <= dense height');
	const dense = districtCenter(plan, 'dense-centre');
	const low = districtCenter(plan, 'detached');
	const dx = low[0] - dense[0],
		dy = low[1] - dense[1];
	const lengthSquared = dx * dx + dy * dy;
	return ([x, y]: CellPoint) => {
		const fraction = lengthSquared
			? ((x - dense[0]) * dx + (y - dense[1]) * dy) / lengthSquared
			: 0;
		return denseHeightM + Math.max(0, Math.min(1, fraction)) * (lowHeightM - denseHeightM);
	};
}

function turn(a: Vertex, b: Vertex, c: Vertex) {
	return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function planar([a, b, c, d]: Vertex[], level: 'ground' | 'canopy') {
	const area = turn(a, b, c);
	const expected =
		a[level] +
		((b[level] - a[level]) * turn(a, d, c) + (c[level] - a[level]) * turn(a, b, d)) / area;
	return Math.abs(d[level] - expected) <= 1e-10;
}

function footprints(ring: Vertex[]) {
	const [a, b, c, d] = ring;
	if (turn(a, b, c) * turn(a, c, d) <= 0)
		throw new RangeError('Terrain diagonal must lie inside its ground quad');
	const convex = ring.every(
		(v, i) => turn(v, ring[(i + 1) % 4], ring[(i + 2) % 4]) * turn(a, b, c) > 0
	);
	return convex && planar(ring, 'ground') && planar(ring, 'canopy')
		? [ring]
		: [
				[a, b, c],
				[a, c, d]
			];
}

export function liftEnvelope(plan: GroundPlan, options: ParamOverrides<typeof profile>) {
	const clearances = new Set(
		plan.areas.flatMap((area) => (area.kind === 'path' ? [area.reserve.clearanceM] : []))
	);
	const [clearance] = clearances;
	if (clearances.size !== 1 || !Number.isFinite(clearance) || clearance <= 0)
		throw new RangeError('Expected one positive path clearance surface');
	const height = heightAt(plan, options, clearance);
	const vertices = new Map<string, Vertex>();
	const columns: Column[] = [];
	for (const cell of [...plan.cells].sort((a, b) => (a.id < b.id ? -1 : 1))) {
		const corners = cell.vertexIds.map((id, i) => {
			const p = cell.corners[i];
			const known = vertices.get(id);
			if (known) return known;
			const vertex = { id, x: p[0], y: p[1], ground: p[2], canopy: p[2] + height(p) };
			vertices.set(id, vertex);
			return vertex;
		});
		for (const ring of footprints(corners)) {
			const piece =
				ring.length === 4
					? 'quad'
					: 'triangle/' +
						ring
							.map((v) => v.id)
							.sort()
							.join('+');
			columns.push({ id: plan.id + '/column/' + cell.id + '/' + piece, groundId: cell.id, ring });
		}
	}
	return { clearance, columns };
}
