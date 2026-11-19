import { required } from '../required';
import type { HouseUse } from '../../data/house-body';
import { defineRules, weightedForm, type NeighbourCell } from '../../core/neighbourhood';
import type { EnsembleDistrict } from './ensemble-policy';

export type TierKind =
	'solar' | 'capsule' | 'dome' | 'lookout' | 'gallery' | 'rack' | 'grove' | 'workshop' | 'void';
export type HousePlan = 'rectangular' | 'round';
export type LinkKind = 'skyway' | 'stair-bridge' | 'platform';
export type CrownKind = 'panels' | 'lantern' | 'chimney';
type Form = CrownKind | TierKind | HousePlan | LinkKind | 'deck' | 'pending';
type Node = { id: string; choices: readonly Form[] };
const forms: Form[] = [
	'solar',
	'capsule',
	'dome',
	'rack',
	'grove',
	'workshop',
	'void',
	'gallery',
	'rectangular',
	'round',
	'skyway',
	'stair-bridge',
	'platform',
	'deck',
	'pending',
	'panels',
	'lantern',
	'chimney',
	'lookout'
];
const links: Form[] = ['skyway', 'stair-bridge', 'platform'];
const contacts = Object.fromEntries(
	forms.map((form) => [
		form,
		forms.filter((other) =>
			links.includes(form) ? other === 'deck' : form !== 'void' || other !== 'void'
		)
	])
);
const preferences: Record<EnsembleDistrict, Partial<Record<Form, number>>> = {
	bank: { round: 4, grove: 3, skyway: 3 },
	slope: { rectangular: 4, 'stair-bridge': 3 },
	infill: { rectangular: 2, capsule: 2 }
};

/** Collapses a vertical section in order, or a lateral span between two fixed deck nodes.
 * Each node has its surveyed candidate domain. Null sides face the exterior. */
function solveHouseSection(nodes: Node[], district: EnsembleDistrict, seed: number): Form[] {
	const state = new Map<string, NeighbourCell>();
	const domains = Object.fromEntries(
		nodes.map(({ id, choices }, i) => {
			state.set(id, {
				id,
				district: id,
				form: choices.length === 1 ? choices[0] : 'pending',
				neighbors: [nodes[i - 1]?.id ?? null, nodes[i + 1]?.id ?? null, null],
				protected: true
			});
			return [
				id,
				Object.fromEntries(
					forms.map((f) => [f, choices.includes(f) ? (preferences[district][f] ?? 1) : 0])
				)
			];
		})
	);
	const rules = defineRules({ contacts, districts: domains }, { budget: forms.length });
	return nodes.map(({ id }) => {
		const cell = required(state.get(id), 'section node');
		state.set(id, { ...cell, protected: false });
		const form = required(rules.solve([id], state, seed).get(id), 'section decision')
			.target as Form;
		state.set(id, { ...cell, form });
		return form;
	});
}

/** Selects the single open terrace among eligible interior levels by stable house address. */
function voidLevel(id: string, seed: number, count: number) {
	const choices = Array.from({ length: Math.max(1, count - 2) }, (_, i) => ({
		form: String(count === 2 ? 0 : i + 1),
		end: i + 1
	}));
	return Number(weightedForm(choices, seed, id, 'composed-open-tier-v1'));
}
function domain(uses: HouseUse[], crown: boolean, low: boolean): TierKind[] {
	const kinds: Record<HouseUse, TierKind[]> = {
		living: ['capsule'],
		water: [low ? 'rack' : 'lookout'],
		energy: [crown ? 'solar' : 'workshop'],
		material: [crown ? 'solar' : 'workshop'],
		food: [crown ? 'dome' : 'grove']
	};
	return [...new Set(uses.flatMap((use) => kinds[use]))];
}
function tierUse(kind: TierKind, uses: HouseUse[]) {
	return (
		uses.find(
			(use) =>
				domain([use], true, false).includes(kind) || domain([use], false, true).includes(kind)
		) ?? uses[0]
	);
}

/** Compiles the painted tier domains, then solves the plan, vertical contacts and crown together. */
export function houseProgramme(
	id: string,
	stories: number,
	uses: HouseUse[][],
	district: EnsembleDistrict,
	seed: number,
	fixedPlan?: HousePlan
) {
	const open = stories >= 4 ? voidLevel(id, seed, uses.length) : -1;
	const nodes = uses.map((u, i) => {
		const crown = i === uses.length - 1;
		// Consecutive bands of one painted use reserve a single occupied volume.
		const repeated = !crown && new Set(u).size === 1 && uses[i + 1]?.every((use) => use === u[0]);
		const choices: TierKind[] =
			i === open ? ['void'] : repeated ? ['gallery'] : domain(u, crown, i === 0);
		return { id: id + '/tier/' + i, choices };
	});
	const [variant, ...kinds] = solveHouseSection(
		[
			{
				id: id + '/plan',
				choices: fixedPlan ? [fixedPlan] : stories >= 6 ? ['rectangular', 'round'] : ['rectangular']
			},
			...nodes,
			{
				id: id + '/crown',
				choices: required(uses.at(-1), 'crown programme').some(
					(u) => u === 'energy' || u === 'material'
				)
					? ['panels', 'chimney']
					: ['lantern', 'chimney']
			}
		],
		district,
		seed
	);

	return {
		plan: variant as HousePlan,
		crown: kinds.at(-1) as CrownKind,
		kinds: uses.map((u, i) => {
			const kind = kinds[i] as TierKind;
			return { kind, use: tierUse(kind, u) };
		})
	};
}
/** Both fixed endpoint nodes must present a surveyed deck to the span node. */
export function bridgeForm(
	a: string,
	b: string,
	id: string,
	choices: LinkKind[],
	district: EnsembleDistrict,
	seed: number
) {
	return solveHouseSection(
		[
			{ id: a, choices: ['deck'] },
			{ id, choices },
			{ id: b, choices: ['deck'] }
		],
		district,
		seed
	)[1] as LinkKind;
}
