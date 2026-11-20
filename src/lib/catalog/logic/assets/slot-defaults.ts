import { graphiteFigure } from './production/activities/action-figure';
import { finishMaterial } from '../material/surface';
import type { ColorToken, FinishId } from '../parametrik/types';
import type { AssetRecipe, AssetSurface } from './definition';

const dress: Record<string, [FinishId, ColorToken]> = {
	body: ['kunststoff-formteil', '--paper'],
	figure: [graphiteFigure.finish, graphiteFigure.token],
	plaza: ['beton-terrazzo', '--cat-business-2'],
	accent: ['keramik-glasiert', '--body-living'],
	glass: ['clear-acrylic', '--cat-health-3'],
	channel: ['metall-lackiert', '--cat-health'],
	highlight: ['metall-messing', '--cat-mobility'],
	planting: ['planted-mat', '--cat-nature'],
	trim: ['metall-messing', '--cat-living'],
	deck: ['holz-natur', '--cat-business'],
	edge: ['metall-graphit', '--ink'],
	frame: ['metall-lackiert', '--blueprint'],
	basin: ['keramik-glasiert', '--cat-health-3'],
	funnel: ['keramik-glasiert', '--cat-health']
};

const categoryDress: Partial<Record<AssetRecipe['category'], Record<string, FinishId>>> = {
	waterworks: { channel: 'wasser-ruhig', body: 'beton-terrazzo' },
	planting: { trim: 'holz-natur', body: 'beton-terrazzo' },
	gardens: { body: 'beton-terrazzo', trim: 'holz-natur' },
	structure: { body: 'beton-schalung' },
	'roof-pieces': { body: 'corrugated-metal' },
	capsules: { body: 'metall-lackiert' },
	facades: { body: 'metall-gebuerstet' }
};

// Slots remain independently addressable when the initial dressing uses one material across a joint.
const sharedDress: readonly [string, string][] = [
	['frame', 'shell'],
	['body', 'shell'],
	['edge', 'body'],
	['trim', 'highlight'],
	['body', 'foot'],
	['shell', 'foot'],
	['frame', 'body'],
	['accent', 'body'],
	['deck', 'body'],
	['planting', 'channel']
];
function defaultSlot(recipe: AssetRecipe, slot: string) {
	const names = new Set(
		recipe.slotNames.filter((name) => !recipe.legacyFigureSlot || name !== 'figure')
	);
	let selected = slot;
	for (const [from, to] of sharedDress) {
		if (names.size <= 3) break;
		if (!names.has(to) || !names.delete(from)) continue;
		if (selected === from) selected = to;
	}
	return selected;
}

/** Resolves a recipe's authored slot suggestion, using each component's physical finish. */
export function suggestedSurface(recipe: AssetRecipe, variant: string, slot: string): AssetSurface {
	const name =
		recipe.slotNames.length > 3 && !recipe.id.startsWith('person-')
			? defaultSlot(recipe, slot)
			: slot;
	const preset = recipe.finishes?.[variant] ?? recipe.suggestions?.[name];
	if (preset) return { ...preset };
	const surface = dress[name];
	if (!surface) throw new RangeError('Missing slot suggestion: ' + recipe.id + '/' + slot);
	const [standard, token] = surface;
	if (recipe.category === 'ceramics' || slot === 'basin' || slot === 'funnel')
		return { token, material: 'glaze', finish: 'keramik-glasiert' };
	const finish = categoryDress[recipe.category]?.[name] ?? standard;
	return {
		token,
		material: name === 'glass' && finish === 'clear-acrylic' ? 'glass' : finishMaterial(finish),
		finish
	};
}
