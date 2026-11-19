import { fitting, mountFitting } from './asset-fit';
import type { AssetKind, HouseSlot } from './types';
import type { HouseSurfaces } from './surfaces';

const fittings: Record<AssetKind, string> = {
	solar: 'plug-box',
	workshop: 'plug-box',
	capsule: 'living-capsule',
	dome: 'glass-bell',
	lookout: 'drum-house',
	grove: 'tree-trough',
	rack: 'tank-frame',
	reservoir: 'tank-frame',
	panels: 'solar-roof',
	window: 'window-band',
	chimney: 'chimney',
	lantern: 'observatory'
};
function objectSlots(slot: HouseSlot, surfaces: HouseSurfaces) {
	const programme = surfaces[slot.use];
	return {
		body: slot.kind === 'capsule' ? surfaces.shell : surfaces.frame,
		accent: programme,
		glass: surfaces.pane,
		channel: slot.kind === 'panels' ? surfaces.pane : programme,
		planting: surfaces.food,
		trim: surfaces.frame,
		edge: surfaces.frame
	};
}
/** Mounts a registered object and assigns its named surfaces after geometry generation. */
export function registryElements(slot: HouseSlot, seed: number, surfaces: HouseSurfaces) {
	const id = fittings[slot.kind],
		attachment = slot.anchor === 'ground' ? 'deck' : slot.anchor;
	const asset = fitting(
		id,
		slot.id,
		seed,
		attachment,
		objectSlots(slot, surfaces),
		slot.kind === 'reservoir' ? 'single-vessel' : undefined
	);
	const angle =
		attachment === 'facade'
			? Math.atan2(slot.facing[1], slot.facing[0]) -
				Math.atan2(asset.anchor.normal[1], asset.anchor.normal[0])
			: 0;
	return mountFitting(asset, { position: slot.position, size: slot.size, angle });
}
