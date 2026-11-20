import { surveyGround } from '../../logic/structural-joints';
import type { Primitive, Vec3 } from '../../logic/parametrik/types';
import type { TerrainGrid } from '../../logic/terrain-grid';
import type { WashSeat } from './contact-wash';

function footprint(p: Primitive) {
	if (p.planned || p.material === 'ghost') return;
	if (p.kind === 'cylinder') return { point: p.position, diameter: p.radius * 2, height: p.height };
	if (p.kind !== 'box') return;
	const [x, y, z] = p.position;
	const [w, d, height] = p.size;
	return { point: [x + w / 2, y + d / 2, z] as Vec3, diameter: Math.min(w, d), height };
}

/** Surveys vertical columns and their coaxial plinths. Unsupported feet cast no contact patch. */
export function columnSeats(parts: readonly Primitive[], grid: TerrainGrid): WashSeat[] {
	const feet = parts.map(footprint).filter((p) => p !== undefined);
	const top = new Map(
		feet.map((p) => [[p.point[0], p.point[1], p.point[2] + p.height].join(','), p])
	);
	const seats: WashSeat[] = [];
	for (const column of feet) {
		if (column.height < 2.5 || column.height < column.diameter * 1.5) continue;
		const base = top.get(column.point.join(','));
		if (base && base.diameter >= column.diameter)
			seats.push({ point: column.point, normal: [0, 0, 1], diameter: column.diameter });
		const foot = base && base.diameter >= column.diameter ? base : column;
		const [x, y, z] = foot.point;
		const ground = surveyGround(grid, { point: [x, y, z - 0.3], axis: [0, 0, 1], length: 0.6 });
		if (ground)
			seats.push({ point: ground.point, normal: ground.supportNormal, diameter: foot.diameter });
	}
	return seats;
}
