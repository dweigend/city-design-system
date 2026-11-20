import { chartPoint, type TerrainCell } from '../terrain-grid';

// Four chart intervals per parcel resolve a roughly metre-wide riser. Court banks
// subdivide the same chart three times further and use this same piecewise plane.
export const shelfDivisions = 4;

/** Additional fill above the graded carrier. Broad planted treads meet battered
 * risers at one-metre contour courses and taper out at walking and court edges. */
export function terraceShelf(cell: TerrainCell) {
	const weights = cell.landform;
	if (!weights?.some((p) => p[1] > 0)) return;
	const n = shelfDivisions,
		stride = n + 1;
	const fill = Array.from({ length: stride * stride }, (_, k) => {
		const u = (k % stride) / n,
			v = Math.floor(k / stride) / n;
		const z = chartPoint(cell.corners, u, v)[2],
			shoulder = chartPoint(weights, u, v)[1];
		const fraction = z - Math.floor(z),
			riser = Math.min(1, fraction / 0.22);
		return shoulder * Math.max(0, riser * riser * (3 - 2 * riser) - fraction);
	});
	return (u: number, v: number) => {
		const x = u * n,
			y = v * n,
			i = Math.min(n - 1, Math.floor(x)),
			j = Math.min(n - 1, Math.floor(y));
		const a = j * stride + i,
			du = x - i,
			dv = y - j,
			b = du >= dv ? a + 1 : a + stride;
		return (
			fill[a] +
			Math.abs(du - dv) * (fill[b] - fill[a]) +
			Math.min(du, dv) * (fill[a + stride + 1] - fill[a])
		);
	};
}
