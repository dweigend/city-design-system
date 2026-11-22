import type { ParamOverrides } from '../../core/params';
import type { blockInputs, BlockInputs } from '../../data/block-inputs';
import { translate } from '../ansicht/geometrie';
import type { Primitive, Vec3 } from '../parametrik/types';
import { buildStyleHouse, styleHouseIds, type StyleHouseId } from './house';

/** Clear ground between two neighbouring lots, in metres. */
const LOT_GAP_M = 1.5;

export type ConstructionPhases = {
	inputs: BlockInputs;
	/** Lot centres on the ground in building order, world metres. */
	lots: readonly { id: StyleHouseId; centre: Vec3 }[];
	/** Index of the house under construction, or undefined when all three stand finished. */
	active?: number;
	parts: Primitive[];
};

/**
 * Places the three style houses on neighbouring lots along `axis`, a unit vector in plan.
 *
 * `phase` counts the construction phases already begun (FORM-10): without it all three houses
 * stand finished in their own surfaces; with phase n the house n is new, every earlier house is
 * plain stock without finish and later lots stay empty. Phases outside 0–2 give the finished
 * row. The middle lot is centred on the origin; neighbouring lot centres are one lot diagonal
 * plus a gap apart, so the diamonds of an isometric view do not overlap. Detached result,
 * deterministic, world metres, z up.
 */
export function buildConstructionPhases(
	axis: readonly [number, number],
	phase?: number,
	inputs?: ParamOverrides<typeof blockInputs>
): ConstructionPhases {
	const houses = styleHouseIds.map((id) => buildStyleHouse(id, { inputs }));
	const { width } = houses[0].inputs;
	const pitch = width * Math.SQRT2 + LOT_GAP_M;
	const active = phase !== undefined && phase >= 0 && phase < houses.length ? phase : undefined;
	const lots = houses.map(({ id }, index) => {
		const offset = (index - (houses.length - 1) / 2) * pitch;
		return { id, centre: [axis[0] * offset, axis[1] * offset, 0] as Vec3 };
	});
	const parts = houses.flatMap((house, index) => {
		if (active !== undefined && index > active) return [];
		const placed = house.parts.map((part) => translate(part, lots[index].centre));
		return active !== undefined && index < active ? placed.map(asStock) : placed;
	});
	return { inputs: houses[0].inputs, lots, active, parts };
}

/** An earlier house carries no finish and no use colour; the scene draws it as plain stock. */
function asStock(part: Primitive): Primitive {
	const stock: Primitive = { ...part, role: 'bestand', token: '--paper', material: 'paper' };
	delete stock.finish;
	delete stock.colourRole;
	return stock;
}
