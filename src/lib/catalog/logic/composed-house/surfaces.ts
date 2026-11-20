import type { ObjectSurface } from '../assets';
import { houseSurfaces, type SurfaceSlot } from '../material/house-surfaces';
import type { BuildingSurface } from '../parametrik/types';
import type { Section } from './types';

export { houseSurfaces };
export type BandAccent = 'none' | 'window' | 'wall' | 'storey' | 'anchor';
export type Surface = ObjectSurface;
export type HouseSurfaces = Readonly<Record<SurfaceSlot, Surface>>;

/** Binds construction slots to the ensemble and retains explicit caller assignments. */
export function sectionSurfaces(section: Section, palette = houseSurfaces): HouseSurfaces {
	const { shellUse } = section.composition;
	const assign = (key: SurfaceSlot, slot: BuildingSurface['slot']) => ({
		buildingSurface: { use: shellUse, ensemble: section.ensemble, slot },
		override: palette[key] === houseSurfaces[key] ? undefined : palette[key]
	});
	return {
		frame: assign('frame', 'frame'),
		deck: assign('deck', 'deck'),
		shell: assign('shell', 'shell'),
		pane: assign('pane', 'pane'),
		access: assign('access', 'deck'),
		living: assign('living', 'shell'),
		water: assign('water', 'shell'),
		energy: assign('energy', 'shell'),
		food: assign('food', 'shell'),
		material: assign('material', 'shell')
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
