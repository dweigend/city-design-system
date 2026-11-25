import { move } from '../../core/object';
import { Random } from '../../core/random';
import {
	createHouseAssembly,
	type AdjoiningWall,
	type HouseDetail,
	type StoreyProgram
} from '../../domain/house-court';
import type { PlacedParcelHouse } from '../../world/house-site';
import { defaults } from '../../../config/house-projection';
import { readDisplayPresentation, stockPencilShare } from '../focus';
import { resolveSurfaces, type Drawable, type Surface } from '../surface';
import { mergeHouseDrawables, type HousePlacement } from './clad';
import { houseLevels } from './levels';
import { fullSurfaces } from './surfaces';

const useColors = {
	public: '--path',
	workshop: '--cat-living',
	office: '--cat-mobility',
	housing: '--body-living',
	'city-farm': '--cat-nature',
	greenhouse: '--cat-foliage'
} as const satisfies Record<StoreyProgram['use'], Surface['color']>;

const bodySlots = new Set([
	'mass',
	'wall',
	'body-main',
	'body-second',
	'body-shell',
	'capsule',
	'capsule-accent'
]);

/** Draws each addressed body in its build phase (COLOR-5). Keeps use colors for focus (COLOR-8). */
export function projectProgrammedHouse(
	{ space, house, style }: PlacedParcelHouse,
	detail: HouseDetail,
	walls: readonly AdjoiningWall[],
	placement: HousePlacement
): Drawable[] {
	const { object, addresses } = createHouseAssembly(space, house, detail, style, walls);
	const local = move(object, placement.translation, placement.radians);
	const surfaces: Readonly<Record<string, Surface>> = fullSurfaces;
	const draw = Random.create({ seed: house.inputs.seed }).derive('stock');
	const retained = draw.number() < stockPencilShare ? 'pencil' : 'transparent';
	const treatment = readDisplayPresentation(retained).treatment;
	const stock = houseLevels[retained];
	const drawings = resolveSurfaces(
		local,
		Object.fromEntries(local.slots.map((slot) => [slot, surfaces[slot]]))
	).map((drawable, index): Drawable => {
		const { slot, program } = addresses[index];
		if (!bodySlots.has(slot) || !program) return drawable;
		const body = { ...drawable, creaseAngleRad: defaults.plainCreaseRad };
		const useColor = useColors[program.use];
		if (program.phase === 'retained')
			return {
				...body,
				...stock.surfaces.mass,
				useColor,
				...(treatment === 'pencil'
					? { hatch: stock.hatch }
					: { fillAlpha: stock.fillAlpha, occlude: true })
			};
		if (program.use === 'greenhouse')
			return { ...body, color: '--model-acrylic', finish: 'glass', useColor };
		const color = style.id === 'archigram' ? '--model-grey' : '--model-cream';
		return { ...body, color, useColor };
	});
	if (detail === 'full') return drawings;
	const groups = new Map<string, Drawable[]>();
	for (const [index, drawable] of drawings.entries()) {
		const { slot, storeySpan, program } = addresses[index];
		const key = JSON.stringify([
			slot,
			drawable.useColor && storeySpan,
			program?.phase,
			drawable.useColor
		]);
		const group = groups.get(key) ?? [];
		group.push(drawable);
		groups.set(key, group);
	}
	return Array.from(groups.values(), mergeHouseDrawables);
}

/** Applies the house function palette to existing drawables without rebuilding them. */
export function paintHouseUse(drawable: Drawable): Drawable {
	const { useColor } = drawable;
	return useColor
		? {
				...drawable,
				color: useColor,
				preserveColor: true,
				fillAlpha: /* Exact arithmetic: remove the stock veil during use analysis. */ 1,
				finish: 'matte'
			}
		: drawable;
}
