import { hashUnit } from '../../core/random';
import type { HouseUse } from '../../data/house-body';
import type { ObjectSurface } from '../assets';
import { houseSurfaces, type SurfaceSlot } from '../material/house-surfaces';
import type { BuildingSurface } from '../parametrik/types';
import type { Section } from './types';

export { houseSurfaces };
export type BandAccent = 'none' | 'window' | 'wall' | 'storey' | 'anchor';
export type Surface = ObjectSurface;
export type HouseSurfaces = Readonly<Record<SurfaceSlot, Surface>>;

/**
 * The use whose colour a house wears as its envelope field: one of the uses the house itself
 * contains, drawn by a stateless hash of the house seed and id. Neighbours in one ensemble so
 * take different fields while every field names a use that is really inside.
 */
export function fieldUse(section: Section): HouseUse {
	const uses = [...new Set(section.decks.flatMap((deck) => deck.programme))].sort();
	if (!uses.length) return section.composition.shellUse;
	return uses[Math.floor(hashUnit(section.seed, section.id, 'house/field') * uses.length)];
}

/** Binds construction slots to the ensemble and retains explicit caller assignments. */
export function sectionSurfaces(section: Section, palette = houseSurfaces): HouseSurfaces {
	const { shellUse } = section.composition;
	const field = fieldUse(section);
	const assign = (key: SurfaceSlot, slot: BuildingSurface['slot'], use = shellUse) => ({
		buildingSurface: { use, ensemble: section.ensemble, slot },
		override: palette[key] === houseSurfaces[key] ? undefined : palette[key]
	});
	return {
		frame: assign('frame', 'frame'),
		deck: assign('deck', 'deck'),
		shell: assign('shell', 'shell', field),
		pane: assign('pane', 'pane'),
		access: assign('access', 'deck'),
		living: assign('living', 'shell', 'living'),
		water: assign('water', 'shell', 'water'),
		energy: assign('energy', 'shell', 'energy'),
		food: assign('food', 'shell', 'food'),
		material: assign('material', 'shell', 'material')
	};
}

/** Assigns a construction role while preserving any explicit override. */
export function roleSurface(surface: Surface, slot: BuildingSurface['slot']): Surface {
	return 'buildingSurface' in surface
		? { ...surface, buildingSurface: { ...surface.buildingSurface, slot } }
		: surface;
}

/** Gives an explicit shell assignment precedence over programme stock. */
export function shellSurface(shell: Surface, body: Surface): Surface {
	if (!('buildingSurface' in shell)) return shell;
	if (shell.override && 'buildingSurface' in body) return { ...body, override: shell.override };
	return body;
}
