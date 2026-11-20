import type { QuadCell } from '../quad-grid';

type XY = [number, number];
export type PartyHeight = [bottom: number, top: number];
type Segment = { start: number; end: number; hidden?: PartyHeight };

/** Splits a surveyed wall wherever a neighbouring podium starts or ends along its frontage. */
export function partyFaces(
	cells: readonly QuadCell[],
	frontage: ReadonlySet<string>,
	podiums: ReadonlyMap<string, PartyHeight>,
	datum: PartyHeight
) {
	const edges = cells.flatMap((c) =>
		c.neighbors.flatMap((id, i) => {
			if (!id || !frontage.has(id)) return [];
			const neighbour = podiums.get(id);
			if (!neighbour) return [];
			const hidden: PartyHeight = [
				Math.max(datum[0], neighbour[0]),
				Math.min(datum[1], neighbour[1])
			];
			return hidden[1] > hidden[0]
				? [{ a: c.corners[i], b: c.corners[(i + 1) % c.corners.length], hidden }]
				: [];
		})
	);
	return (a: XY, b: XY): Segment[] => {
		const dx = b[0] - a[0],
			dy = b[1] - a[1],
			length = Math.hypot(dx, dy);
		const distance = (p: readonly number[]) => (dx * (p[1] - a[1]) - dy * (p[0] - a[0])) / length;
		const along = (p: readonly number[]) =>
			((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (length * length);
		const seams = edges
			.flatMap((edge) => {
				if (Math.max(Math.abs(distance(edge.a)), Math.abs(distance(edge.b))) > 1e-6) return [];
				const u = along(edge.a),
					v = along(edge.b);
				const start = Math.max(0, Math.min(u, v)),
					end = Math.min(1, Math.max(u, v));
				return end - start > 1e-8 ? [{ start, end, hidden: edge.hidden }] : [];
			})
			.sort((x, y) => x.start - y.start);
		const spans: Segment[] = [];
		let cursor = 0;
		for (const seam of seams) {
			if (seam.start - cursor > 1e-8) spans.push({ start: cursor, end: seam.start });
			spans.push(seam);
			cursor = seam.end;
		}
		if (1 - cursor > 1e-8) spans.push({ start: cursor, end: 1 });
		return spans;
	};
}
