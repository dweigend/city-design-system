import { resolveParams } from '../../core/params';
import { blockInputs, type BlockInputs } from '../../data/block-inputs';
import { createCellSpace, type CellPoint } from '../cell-space';
import type { HouseCourtParcel, HouseCourtSlot } from '../house-court';
import { required } from '../required';
import { LAENGEN_TOLERANZ, planen, pruefePlan, type TraegerPlan } from '../traeger';

export type LevelParcel = Readonly<{
	id: string;
	/** Oriented exterior edge, left to right as seen from the entrance. */
	entrance: readonly [CellPoint, CellPoint];
	depth: number;
}>;

export type ParcelDeck = HouseCourtParcel & Readonly<{ plotRing: readonly CellPoint[] }>;

function parcelFrame(plot: LevelParcel) {
	const [left, right] = plot.entrance;
	const dx = right[0] - left[0];
	const dy = right[1] - left[1];
	const width = Math.hypot(dx, dy);
	if (
		!plot.id ||
		![...left, ...right, plot.depth, width].every(Number.isFinite) ||
		width <= 0 ||
		plot.depth <= 0 ||
		left[2] !== right[2]
	)
		throw new RangeError('Expected a finite, level rectangular parcel');
	const point = (x: number, y: number, z = 0): CellPoint => [
		left[0] + (dx * x - dy * y) / width,
		left[1] + (dy * x + dx * y) / width,
		left[2] + z
	];
	return { width, point };
}

function axisPositions(plan: TraegerPlan, axis: 0 | 1) {
	const values = [...new Set(plan.knoten.map(({ p }) => p[axis]))].sort((a, b) => a - b);
	if (values.length !== 4) throw new Error('Expected four node lines in the orthogonal carrier');
	return { min: values[0], span: values[3] - values[0], values };
}

type Axis = ReturnType<typeof axisPositions>;

function slotIndex(value: number, axis: Axis): HouseCourtSlot['row'] {
	if (value < axis.values[1]) return 0;
	if (value < axis.values[2]) return 1;
	return 2;
}

function deckSlots(plan: TraegerPlan, x: Axis, y: Axis, address: (id: string) => string) {
	const nodes = new Map(plan.knoten.map(({ id, p }) => [id, p]));
	const faces = new Map(plan.flaechen.map(({ id, knoten }) => [id, knoten]));
	return plan.zellen
		.map(({ id, flaechen }) => {
			const nodeIds = new Set(
				flaechen.flatMap((face) => required(faces.get(face), 'carrier face'))
			);
			const points = [...nodeIds].map((node) => required(nodes.get(node), 'carrier node'));
			const center = (axis: 0 | 1) => points.reduce((sum, p) => sum + p[axis], 0) / points.length;
			return { cellId: address(id), row: slotIndex(center(1), y), column: slotIndex(center(0), x) };
		})
		.sort((a, b) => a.row - b.row || a.column - b.column);
}

/**
 * Fits a centred 3×3 deck to a level parcel in world metres, with the rear to the left
 * of the oriented entrance edge. Parameters default to the common block schema.
 * Seed defaults to 7 and is passed to the source carrier. Throws when the parcel is
 * invalid, the requested width exceeds the usable span, or the carrier contract fails.
 * Returns detached geometry and entrance-aligned slots ordered front to back, left to right.
 */
export function createParcelDeck(
	plot: LevelParcel,
	inputs: Partial<BlockInputs> = {},
	seed = 7
): ParcelDeck {
	const { width, height, complexity } = resolveParams(blockInputs, undefined, inputs);
	const frame = parcelFrame(plot);
	const tolerance = LAENGEN_TOLERANZ * Math.max(1, width);
	if (width > Math.min(frame.width, plot.depth) + tolerance)
		throw new RangeError('House deck does not fit parcel');

	const plan = planen('orthogonal', { lagen: 1, versatz: 0 }, seed);
	const findings = pruefePlan(plan);
	if (findings.length || plan.zellen.length !== 9)
		throw new Error('Invalid orthogonal carrier: ' + JSON.stringify(findings));

	const address = (id: string) => JSON.stringify([plot.id, id]);
	const x = axisPositions(plan, 0);
	const y = axisPositions(plan, 1);
	const floor = Math.min(...plan.knoten.map(({ p }) => p[2]));
	const insetX = (frame.width - width) / 2;
	const insetY = (plot.depth - width) / 2;
	const nodes = plan.knoten.map(({ id, p }) => {
		const row = (p[1] - y.min) / y.span;
		const relief = p[2] === floor ? 0 : height * (1 - (complexity / 2) * (1 - row));
		return {
			id: address(id),
			position: frame.point(
				insetX + (width * (p[0] - x.min)) / x.span,
				insetY + width * row,
				relief
			)
		};
	});
	const faces = plan.flaechen.map(({ id, knoten }) => ({
		id: address(id),
		nodeIds: knoten.map(address)
	}));
	const cells = plan.zellen.map(({ id, flaechen }) => ({
		id: address(id),
		faceIds: flaechen.map(address)
	}));
	const space = createCellSpace({ nodes, faces, cells });
	const slots = deckSlots(plan, x, y, address);
	const frontNodes = new Set(
		plan.knoten.filter(({ p }) => p[1] === y.min).map(({ id }) => address(id))
	);
	const exit = space.faces.find(
		({ uses, nodeIds }) =>
			uses.length === 1 &&
			uses[0].cellId === slots[1].cellId &&
			nodeIds.every((id) => frontNodes.has(id))
	);
	if (!exit) throw new Error('Orthogonal carrier has no middle entrance face');
	return {
		id: plot.id,
		space,
		slots,
		exitFaceId: exit.id,
		entrance: [frame.point(0, 0), frame.point(frame.width, 0)],
		plotRing: [
			frame.point(0, 0),
			frame.point(frame.width, 0),
			frame.point(frame.width, plot.depth),
			frame.point(0, plot.depth)
		]
	};
}
