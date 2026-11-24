import { Random } from '../../core/random';
import type { HouseStyleName } from '../../domain/house-court';
import type { ModelMaterial } from '../surface';

/** The material roles of a house (MAT-10): the dominant body, a contrasting second body, a small
 * accent and the flat roof tone. */
export type MaterialRole = 'main' | 'second' | 'accent' | 'roof';

/** A style row's materials: for each role the model materials a house draws one from, and the
 * role of each body slot. A slot without a role keeps its function colour (paths, planting,
 * services). Variety across a row comes from which house draws which material (MAT-7). */
export type HouseMaterials = Readonly<{
	roles: Readonly<Record<MaterialRole, readonly ModelMaterial[]>>;
	slots: Readonly<Partial<Record<string, MaterialRole>>>;
}>;

const board = (tone: ModelMaterial['tone']): ModelMaterial => ({ family: 'board', tone });
const cork: ModelMaterial = { family: 'cork' };
const card: ModelMaterial = { family: 'card' };
const stripe: ModelMaterial = { family: 'stripe' };
const perforated: ModelMaterial = { family: 'perforated', tone: 'orange' };
const acrylic: ModelMaterial = { family: 'acrylic' };
const roof = [board('roof')];
const signal = [board('orange'), board('red')];

/** The material assignment of every style row. Neutral is the calm model house in warm neutrals;
 * Memphis a saturated main body beside cork, stripes or chocolate; Archigram white or grey
 * capsules with one coloured, perforated or lit capsule; organic shells in one matte tone. */
export const houseMaterials = Object.freeze({
	neutral: {
		roles: {
			main: [board('cream'), board('white'), card, board('cream'), board('white'), cork],
			second: [],
			accent: signal,
			roof
		},
		slots: { wall: 'main', accent: 'accent' }
	},
	memphis: {
		roles: {
			main: [board('blue'), board('yellow'), board('pink'), board('blue'), board('red')],
			second: [cork, stripe, board('chocolate'), board('cream'), stripe],
			accent: [board('orange'), board('chocolate'), board('blue')],
			roof
		},
		slots: {
			wall: 'main',
			'body-main': 'main',
			'body-second': 'second',
			roof: 'roof',
			accent: 'accent'
		}
	},
	archigram: {
		roles: {
			main: [board('white'), card, board('white')],
			second: [board('yellow'), perforated, acrylic, board('red')],
			accent: [],
			roof
		},
		slots: { capsule: 'main', 'capsule-accent': 'second' }
	},
	organic: {
		roles: {
			main: [board('cream'), cork, board('pink'), board('white')],
			second: [],
			accent: signal,
			roof
		},
		slots: { 'body-shell': 'main', accent: 'accent' }
	}
} as const satisfies Record<HouseStyleName, HouseMaterials>);

/** One house's draw of materials: one per role that has choices, keyed by the house so the same
 * house always wears the same materials. The accent never repeats the main material. */
export function planHouseMaterials(
	materials: HouseMaterials,
	house: string,
	seed = 0
): Readonly<Partial<Record<MaterialRole, ModelMaterial>>> {
	const random = Random.create({ seed }).derive(house);
	const plan: Partial<Record<MaterialRole, ModelMaterial>> = {};
	for (const role of ['main', 'second', 'accent', 'roof'] as const) {
		const same = (choice: ModelMaterial) =>
			choice.family === plan.main?.family && choice.tone === plan.main?.tone;
		const choices = materials.roles[role].filter((choice) => role === 'main' || !same(choice));
		if (choices.length)
			plan[role] = choices[Math.floor(random.derive(role).number() * choices.length)];
	}
	return plan;
}
