import type { RoofSeat, RoofBuilder, Roof } from '../building-envelope';
import { hash } from '../hash-random';
import type { Primitive } from '../parametrik/types';
import { sideLength, type QuadCell } from '../quad-grid';
import { stockRoofDirection } from './stock-roof-axis';
import { CHANNEL } from './form';

const roofs: readonly Roof[] = ['gable', 'hip', 'shed', 'sawtooth'];
const fascia = 0.12;

/** A closed roof seated on the last terrace. Ridge axes use the longest side and its cross axis. */
export function stockRoof(
	builder: RoofBuilder,
	seat: RoofSeat,
	cell: QuadCell,
	level: number,
	seed: number,
	top: number,
	inset: number
): Primitive | undefined {
	const polygon = cell.corners.map(([x, y]): [number, number] => [x, y]);
	const direction = stockRoofDirection(cell, seed);
	const chosen = roofs[Math.floor(hash(seed, cell.index, CHANNEL.roof) * roofs.length)];
	const lengths = cell.corners.map((_, side) => sideLength(cell, side));
	const elongated = Math.max(...lengths) > 1.2 * Math.min(...lengths);
	const roof = chosen === 'sawtooth' && !elongated ? 'gable' : chosen;
	const across = polygon.map(([x, y]) => -x * Math.sin(direction) + y * Math.cos(direction));
	const width = Math.max(...across) - Math.min(...across);
	const pitch = Math.min(0.36, Math.atan((roof === 'shed' ? 0.85 : 2.4) / width));
	const id = cell.id + '@' + level + ':roof';
	try {
		const form = builder.build(
			{
				polygon,
				roof,
				base: top,
				storeys: [{ height: fascia, offset: -inset }],
				params: { direction, teeth: 2, pitch }
			},
			seat
		);
		if (!form.triangles.length) throw new Error('Empty roof mesh');
		return {
			id,
			role: 'bestand',
			roofCell: cell.id,
			token: '--paper',
			material: 'paper',
			...form
		};
	} catch (error) {
		builder.reportFailure(id, error);
		return undefined;
	}
}
