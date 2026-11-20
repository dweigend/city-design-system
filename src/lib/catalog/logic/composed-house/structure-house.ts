import { GROUND_TOKEN, type HouseUse } from '../../data/house-body';
import {
	structureParts,
	type HouseStructure,
	type SkinSolver,
	type StructurePart
} from '../house-structure';
import { houseObject, type HousePart, type StockPart } from './house-object';
import { pipeBetween, slabOver } from './parts';
import { tensionSkin } from './structure-skin';
import { houseSurfaces, roleSurface, type HouseSurfaces, type Surface } from './surfaces';

/** A skin takes the calm ground tone of its use unless the caller supplies a shell surface. */
function shellSurface(surfaces: HouseSurfaces, use: HouseUse): Surface {
	if (surfaces.shell !== houseSurfaces.shell) return surfaces.shell;
	return { colourRole: 'ensemble-ground', token: GROUND_TOKEN[use], finish: surfaces.shell.finish };
}

/** Assigns the palette surface of one colour-agnostic role slot. */
function slotSurface(part: StructurePart, surfaces: HouseSurfaces): Surface {
	const { slot, use } = part.surface;
	if (part.element === 'access') return surfaces.access;
	if (part.element === 'room') return roleSurface(surfaces[use], 'shell');
	const bySlot: Record<typeof slot, Surface> = {
		frame: surfaces.frame,
		fitting: roleSurface(surfaces.frame, 'fitting'),
		base: roleSurface(surfaces.deck, 'base'),
		deck: surfaces.deck,
		screen: roleSurface(surfaces.shell, 'screen'),
		pane: surfaces.pane,
		shell: shellSurface(surfaces, use)
	};
	return bySlot[slot];
}

function cloth(part: Extract<StructurePart, { kind: 'mesh' }>, surface: Surface): StockPart {
	// The tensile variant has no random dimensions; only its registry address is kept.
	const stock = houseObject('full-height-shell', 'tensile-sail', 0, {
		instanceId: part.id,
		slots: { body: surface }
	}).parts[0];
	if (stock.kind !== 'mesh') throw new Error('Expected a shell mesh');
	return { ...stock, id: part.id, points: part.points, triangles: part.triangles, lines: [] };
}

function stock(part: StructurePart, surface: Surface): StockPart {
	if (part.kind === 'rod') return pipeBetween(part.id, part.from, part.to, part.radius, surface);
	if (part.kind === 'plate') return slabOver(part.id, part, surface);
	return cloth(part, surface);
}

const BEARING: ReadonlySet<StructurePart['element']> = new Set(['strut', 'platform', 'room']);

/**
 * Projects a house stated in the shared structure contract to the same registry stock and
 * palette slots as a layered house, in world metres and in the contract's part order. Struts,
 * platforms and rooms bear; ties, skins and access are carried. Every part but access carries
 * its role slot as `buildingSurface`. `solve` tensions the skins and defaults to the shared
 * membrane solver. Throws on a structure `checkHouseStructure` rejects by
 * reference. The result is detached.
 */
export function structureHouse(
	structure: HouseStructure,
	surfaces: HouseSurfaces = houseSurfaces,
	solve: SkinSolver = tensionSkin
): HousePart[] {
	return structureParts(structure, solve).map((part) => ({
		...stock(part, slotSurface(part, surfaces)),
		// Ways keep the access colour; every other element is coloured by its role slot.
		...(part.element === 'access' ? {} : { buildingSurface: part.surface }),
		structuralRole: BEARING.has(part.element) ? 'bearing' : 'cantilever'
	}));
}
