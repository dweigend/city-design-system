import type { Vec2 } from '../../core/geometry';
import type { Random } from '../../core/random';
import { valueNoise } from './value-noise';

/** Origin and bearing of the city core in world meters and radians. Aspect is the ratio of the
 * city's short to long axis; distances across the long axis count 1 / aspect times. */
export type CityCore = Readonly<{ origin: Vec2; bearing: number; aspect: number }>;

/** Wavelength of the district boundary noise in meters, about five coarse cells. */
const noiseWavelength = 320;

/** Returns a rank in meters for a world point: the elliptic distance to the nearer of two
 * cores, distorted by smooth noise. The seed moves the main core up to 450 m along the long
 * axis and 60 m across. The second core lies a further 0.7–1.1 km along the long axis and
 * counts a gap of 900 m at complexity 0, falling to 250 m at complexity 1, so a complex city
 * grows a secondary center. Equal inputs give equal ranks, whatever the plan extent. */
export function districtRank(core: CityCore, random: Random, complexity: number) {
	const noise = valueNoise(random.derive('boundary'), noiseWavelength);
	const amplitude = 0.08 + 0.3 * complexity;
	const shift = random.derive('core');
	const [ox, oy] = core.origin;
	const offset: Vec2 = [shift.number({ min: -450, max: 450 }), shift.number({ min: -60, max: 60 })];
	const side = shift.number() < 0.5 ? -1 : 1;
	const secondary = side * shift.number({ min: 700, max: 1100 });
	const gap = 250 + 650 * (1 - complexity);
	const cos = Math.cos(core.bearing);
	const sin = Math.sin(core.bearing);
	return ([x, y]: Vec2) => {
		const dx = x - ox;
		const dy = y - oy;
		const u = dx * cos + dy * sin - offset[0];
		const v = (dy * cos - dx * sin - offset[1]) / core.aspect;
		const primary = Math.hypot(u, v);
		const second = Math.hypot(u - secondary, v) + gap;
		return Math.min(primary, second) * (1 + amplitude * noise(x, y));
	};
}
