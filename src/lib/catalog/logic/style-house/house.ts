import { resolveParams, type ParamOverrides } from '../../core/params';
import { blockInputs, type BlockInputs } from '../../data/block-inputs';
import type { SlotAssignment } from '../assets';
import { finishMaterial } from '../material/surface';
import type { Primitive, Vec3 } from '../parametrik/types';
import { drawArchigram } from './archigram';
import { createKit, type Kit, type Shape } from './kit';
import type { Lot } from './lot';
import { drawMemphis } from './memphis';
import { drawOrganic } from './organic';

/** Construction phases in building order (FORM-10). */
export const styleHouseIds = ['memphis', 'archigram-fuller', 'organic'] as const;
export type StyleHouseId = (typeof styleHouseIds)[number];
/** Slot name to palette token and catalogue finish. */
export type StyleSet = Readonly<Record<string, SlotAssignment>>;

/** Block inputs every style house starts from: a 9 m lot, 14 m to the top, most details on. */
export const styleHouseDefaults: BlockInputs = { height: 14, width: 9, complexity: 0.85 };

type Recipe = { draw: (kit: Kit, lot: Lot) => void; styleSet: StyleSet };

const recipes: Record<StyleHouseId, Recipe> = {
	memphis: {
		draw: drawMemphis,
		styleSet: {
			shell: { finish: 'bestand-matt', token: '--paper' },
			aggregate: { finish: 'beton-terrazzo', token: '--paper' },
			board: { finish: 'pressed-chipboard', token: '--ground-sand' },
			timber: { finish: 'holz-natur', token: '--ground-sand' },
			screen: { finish: 'perforated-metal', token: '--cat-mobility' },
			accent: {
				finish: 'kunststoff-formteil',
				token: '--blueprint',
				colourRole: 'ensemble-ground'
			},
			counter: { finish: 'kunststoff-formteil', token: '--signal', colourRole: 'ensemble-ground' },
			stand: {
				finish: 'kunststoff-formteil',
				token: '--cat-nature',
				colourRole: 'ensemble-ground'
			},
			bead: {
				finish: 'kunststoff-formteil',
				token: '--cat-business',
				colourRole: 'ensemble-ground'
			},
			signal: {
				finish: 'kunststoff-formteil',
				token: '--cat-hazard',
				colourRole: 'ensemble-ground'
			},
			frame: { finish: 'metall-graphit', token: '--ink' },
			check: { finish: 'keramik-schachbrett', token: '--ink' },
			pane: { finish: 'acryl-matt', token: '--cat-health-5' }
		}
	},
	'archigram-fuller': {
		draw: drawArchigram,
		styleSet: {
			frame: { finish: 'metall-signalrot', token: '--signal' },
			deck: { finish: 'beton-schalung', token: '--paper' },
			core: { finish: 'metall-graphit', token: '--ink' },
			capsule: { finish: 'kunststoff-formteil', token: '--paper' },
			unit: { finish: 'kunststoff-formteil', token: '--cat-mobility' },
			port: { finish: 'metall-graphit', token: '--ink' },
			pane: { finish: 'glas-klar', token: '--cat-health-5' },
			glazing: { finish: 'glas-klar', token: '--cat-health-3' },
			strut: { finish: 'metall-lackiert', token: '--paper' },
			service: { finish: 'kunststoff-formteil', token: '--cat-health' },
			tank: { finish: 'kunststoff-formteil', token: '--cat-health' },
			tube: { finish: 'kunststoff-formteil', token: '--cat-business' },
			crane: { finish: 'metall-lackiert', token: '--cat-mobility' }
		}
	},
	organic: {
		draw: drawOrganic,
		styleSet: {
			shell: { finish: 'bestand-matt', token: '--paper' },
			limb: { finish: 'bestand-matt', token: '--paper' },
			collar: { finish: 'keramik-ton', token: '--ground-clay' },
			pane: { finish: 'acryl-matt', token: '--cat-health-5' },
			moss: { finish: 'planted-mat', token: '--cat-foliage' },
			foliage: { finish: 'planted-mat', token: '--cat-evergreen' }
		}
	}
};

export type StyleHouseOptions = {
	/** Sparse block inputs in metres; omitted fields keep `styleHouseDefaults`. */
	inputs?: ParamOverrides<typeof blockInputs>;
	/** Sparse style set; a named slot replaces the recipe's suggestion. */
	slots?: StyleSet;
};

export type StyleHouse = {
	id: StyleHouseId;
	inputs: BlockInputs;
	/** Square lot reserved on the ground, metres, centred on the origin. */
	footprint: readonly [number, number];
	/** Deck mount at the lot centre, z up. */
	anchors: readonly { attachment: 'deck'; position: Vec3; normal: Vec3 }[];
	slots: StyleSet;
	geometry: Shape[];
	parts: Primitive[];
};

/**
 * Builds one example house of a construction phase on the shared lot.
 *
 * All three recipes read the same block inputs: `width` is the side of the square lot in
 * metres, `height` the highest point in metres and `complexity` (0–1) the share of secondary
 * parts. The recipes draw no random numbers, so equal inputs give equal houses. The result is
 * detached: `geometry` holds slot-named shapes without any surface, `parts` the same shapes
 * dressed from `slots`, in draw order with ids `<house id>/<index>`. World metres, origin at the
 * lot centre on the ground, x right, y to the back, z up. Throws RangeError for inputs outside
 * the block input bounds and for a slot the recipe does not draw.
 */
export function buildStyleHouse(id: StyleHouseId, options: StyleHouseOptions = {}): StyleHouse {
	const { draw, styleSet } = recipes[id];
	const inputs = resolveParams(blockInputs, styleHouseDefaults, options.inputs);
	for (const slot of Object.keys(options.slots ?? {}))
		if (!Object.hasOwn(styleSet, slot)) throw new RangeError(`Unknown slot: ${id}/${slot}`);
	const slots: StyleSet = { ...styleSet, ...options.slots };
	const kit = createKit();
	draw(kit, inputs);
	const geometry = kit.finish(id);
	return {
		id,
		inputs,
		footprint: [inputs.width, inputs.width],
		anchors: [{ attachment: 'deck', position: [0, 0, 0], normal: [0, 0, 1] }],
		slots,
		geometry,
		parts: geometry.map((shape) => dress(shape, slots))
	};
}

function dress({ slot, ...shape }: Shape, slots: StyleSet): Primitive {
	const { finish, token, colourRole } = slots[slot];
	return {
		...structuredClone(shape),
		finish,
		token,
		material: finishMaterial(finish),
		...(colourRole && { colourRole })
	} as Primitive;
}
