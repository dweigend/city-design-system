import type { Vec2 } from '../../core/geometry';
import { distance } from '../../core/geometry';
import { Random } from '../../core/random';

// Meter offsets from the fixed plan datum; no draw depends on the number or order of cells.
export function heightField(seed: number, origin: Vec2, bearing: number) {
	if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)
		throw new RangeError('Expected an unsigned 32-bit city volume seed');
	const random = Random.create({ seed }).derive('city-volume');
	const cos = Math.cos(bearing);
	const sin = Math.sin(bearing);
	const centers = [-125, 125].map((offset, index) => {
		const stream = random.derive(String(index));
		const along = offset + stream.number({ min: -20, max: 20 });
		const across = stream.number({ min: -20, max: 20 });
		return {
			position: [
				origin[0] + along * cos - across * sin,
				origin[1] + along * sin + across * cos
			] as Vec2,
			radius: stream.number({ min: 205, max: 240 }),
			peak: stream.number({ min: 0.95, max: 1.03 })
		};
	});
	return (point: Vec2) =>
		Math.min(
			1,
			Math.max(
				...centers.map(({ position, radius, peak }) => {
					const t = Math.min(1, distance(point, position) / radius);
					return peak * (1 - t * t * (3 - 2 * t));
				})
			)
		);
}
