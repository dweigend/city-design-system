import { DataTexture, DataUtils, HalfFloatType, LinearFilter, RGBAFormat } from 'three/webgpu';
import { positionWorld, texture, vec2 } from 'three/tsl';
import type { TerrainField } from '../surface';

export function projectTerrainField(field: TerrainField) {
	const { samples, columns, rows, width, depth } = field;
	const data = Uint16Array.from(samples, (value) => DataUtils.toHalfFloat(value));
	const image = new DataTexture(data, columns, rows, RGBAFormat, HalfFloatType);
	image.minFilter = LinearFilter;
	image.magFilter = LinearFilter;
	image.needsUpdate = true;
	const size = vec2(columns, rows);
	const point = positionWorld.xy
		.div(vec2(width, depth))
		.add(/* Exact arithmetic: shift centered XY to normalized UV. */ 0.5)
		.mul(size.sub(/* Exact arithmetic: last texel index is count less one. */ 1));
	const cell = point.floor();
	const fraction = point.fract();
	const inverse = fraction.oneMinus();
	const a = inverse
		.mul(inverse, inverse)
		.div(/* Exact arithmetic: cubic B-spline denominator. */ 6);
	const b = fraction
		.mul(
			fraction,
			fraction
				.mul(/* Exact arithmetic: cubic B-spline cubic coefficient. */ 3)
				.sub(/* Exact arithmetic: cubic B-spline quadratic coefficient. */ 6)
		)
		.add(/* Exact arithmetic: cubic B-spline constant coefficient. */ 4)
		.div(/* Exact arithmetic: cubic B-spline denominator. */ 6);
	const d = fraction
		.mul(fraction, fraction)
		.div(/* Exact arithmetic: cubic B-spline denominator. */ 6);
	const c = a.add(b).add(d).oneMinus();
	const first = a.add(b);
	const last = c.add(d);
	// Pair adjacent cubic B-spline weights so each pair needs one bilinear sample.
	const low = cell
		.sub(/* Exact arithmetic: center of the lower texel pair. */ 0.5)
		.add(b.div(first))
		.div(size);
	const high = cell
		.add(/* Exact arithmetic: center of the upper texel pair. */ 1.5)
		.add(d.div(last))
		.div(size);
	const top = texture(image, low)
		.mul(first.x)
		.add(texture(image, vec2(high.x, low.y)).mul(last.x));
	const bottom = texture(image, vec2(low.x, high.y))
		.mul(first.x)
		.add(texture(image, high).mul(last.x));
	return { image, sample: top.mul(first.y).add(bottom.mul(last.y)) };
}
