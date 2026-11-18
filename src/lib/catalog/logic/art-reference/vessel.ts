import { hash } from '../hash-random';
import { defineParams, numberParam, resolveParams, type ParamOverrides } from '../params';
import { composeCollage, type Cell } from './packing';
const vesselParams = defineParams({
	height: numberParam('Slenderness', 'height / radius', 2.4, [1, 4, 0.1]),
	lobes: numberParam('Shoulders', 'rings', 2, [1, 4, 1], 'integer'),
	wall: numberParam('Wall thickness', 'radius fraction', 0.14, [0.05, 0.25, 0.01])
});
/** Loft a hollow ceramic body on the first fitted disc. V1 uses 64 height intervals.
 * Sections are circles normal to world Z. Offset follows local X rotated by the base angle.
 * Channel 4 phases the shoulders and 5 controls eccentricity.
 */
export function buildVessel(
	cell: Cell,
	seed: number,
	overrides?: ParamOverrides<typeof vesselParams>
) {
	const { height, lobes, wall } = resolveParams(vesselParams, undefined, overrides);
	const [base] = composeCollage(cell, seed, { count: 1 });
	if (!base) return null;
	const phase = hash(seed, 0, 4) * 0.65,
		lean = (hash(seed, 0, 5) - 0.5) * 0.32;
	const rings = Array.from({ length: 65 }, (_, i) => {
		const t = i / 64,
			shoulder = Math.sin(Math.PI * (t * lobes + phase)) ** 2;
		const envelope = Math.sin(Math.PI * t) ** 0.65;
		const outer = base.radius * (0.38 + 0.46 * shoulder * envelope + 0.09 * t);
		return {
			z: t * base.radius * height,
			offset: lean * base.radius * t,
			outer,
			inner: outer - wall * base.radius
		};
	});
	return { base, rings };
}
