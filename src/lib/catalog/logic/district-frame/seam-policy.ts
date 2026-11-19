import { defineParams, numberParam, resolveParams, type ParamOverrides } from '../../core/params';
import { weightedForm } from '../../core/neighbourhood';

export type FrameRole = 'main' | 'secondary' | 'gap';
export type EdgeUse = 'court' | 'shore' | 'slope' | 'land' | 'frontage' | 'step' | 'houses';
export type Character = 'core' | 'shore' | 'slope' | 'quiet';
type Pair = readonly [main: number, secondary: number];
type RoleTable<K extends string> = Readonly<Record<K, Pair>>;
export const pairWeights: RoleTable<EdgeUse> = {
	court: [1, 0],
	shore: [1, 0],
	slope: [1, 0],
	land: [0.6, 0],
	frontage: [0.4, 0],
	step: [0.6, 0.2],
	houses: [0, 0.15]
};
export const characterWeights: RoleTable<Character | 'coreCourt' | 'quietCourt'> = {
	shore: [1, 0.5],
	slope: [1, 0.5],
	core: [0.5, 1],
	coreCourt: [1, 1],
	quiet: [0, 0],
	quietCourt: [0.5, 0]
};
export const seamParams = defineParams({
	quietDistrictShare: numberParam('Quiet district tendency', 'fraction', 0.33, [0, 1, 0.01]),
	spineWeight: numberParam('Shore and slope spine weight', '', 2, [0, 100, 0.1]),
	gateWeight: numberParam('Transverse gate weight', '', 0.15, [0, 100, 0.05]),
	gapWeight: numberParam('Unbuilt alternative', '', 0.25, [0, 100, 0.05]),
	maxFramedSides: numberParam('Framed sides per house', 'sides', 2, [1, 4, 1], 'integer'),
	maxBranchSeams: numberParam('Maximum spur reach', 'seams', 2, [0, 2, 1], 'integer'),
	frameDelayTicks: numberParam('Frame development delay', 'ticks', 2, [1, 100, 1], 'integer'),
	roofStepMin: numberParam('Roof step', 'm', 3.5, [0.1, 50, 0.1]),
	groundStepMin: numberParam('Terrain step', 'm', 2, [0.1, 50, 0.1])
});
export type FrameSeam = Readonly<{
	id: string;
	vertices: readonly [string, string];
	houses: readonly string[];
	district: string;
	character: Character;
	use: EdgeUse;
	districtEdge: boolean;
	opening?: string;
	blocker?: string;
	attachment?: boolean;
	gate?: boolean;
	intent?: FrameRole;
}>;
/** Validated numeric settings and detached pair and district tables for a solve. */
export function seamPolicy(
	options?: ParamOverrides<typeof seamParams>,
	pairs = pairWeights,
	characters = characterWeights
) {
	const table = <K extends string>(defaults: RoleTable<K>, values: RoleTable<K>) => {
		const copy = new Map<K, Pair>();
		for (const key of Object.keys(defaults) as K[]) {
			const [main, secondary] = values[key];
			if (![main, secondary].every((w) => Number.isFinite(w) && w >= 0 && w <= 1e6))
				throw new RangeError('Invalid placement weight: ' + key);
			copy.set(key, [main, secondary]);
		}
		return copy;
	};
	return {
		...resolveParams(seamParams, options),
		pairs: table(pairWeights, pairs),
		characters: table(characterWeights, characters)
	};
}
export type SeamPolicy = ReturnType<typeof seamPolicy>;

/** Draws from eligible seam roles. Compatible intent bypasses the draw, a veto preserves the gap. */
export function seamProposal(
	s: FrameSeam,
	seed: number,
	policy: SeamPolicy
): { role: FrameRole; reason: string } {
	if (s.opening || !s.houses.length) return { role: 'gap', reason: s.opening ?? 'unoccupied' };
	const key =
		s.use === 'court' && (s.character === 'quiet' || s.character === 'core')
			? (`${s.character}Court` as const)
			: s.character;
	const [dm, ds] = policy.characters.get(key) ?? [1, 1];
	const [pm, ps] = policy.pairs.get(s.use) ?? [0, 0];
	const spine = s.use === 'shore' || s.use === 'slope' ? policy.spineWeight : 1;
	const main = (s.districtEdge ? 1 : pm) * dm * spine * (s.gate ? policy.gateWeight : 1);
	const secondary = s.attachment ? ps * ds : 0;
	if (s.intent) {
		const allowed = s.intent === 'gap' || (s.intent === 'main' ? main : secondary) > 0;
		return allowed
			? { role: s.intent, reason: 'intent' }
			: { role: 'gap', reason: 'incompatible-intent' };
	}
	const total = main + secondary + policy.gapWeight;
	if (!total) return { role: 'gap', reason: 'empty-domain' };
	return {
		role: weightedForm(
			[
				{ form: 'main', end: main },
				{ form: 'secondary', end: main + secondary },
				{ form: 'gap', end: total }
			],
			seed,
			s.id,
			'tg-role-v1'
		),
		reason: s.use
	};
}
