import { fitting, mountFitting } from './asset-fit';
import type { AssetKind, HouseSlot } from './types';
import type { HouseSurfaces, SurfaceSlot } from './surfaces';

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
function surfaceSlot(slot: HouseSlot, kind: string, index: number): SurfaceSlot {
	switch (slot.kind) {
		case 'capsule':
			return kind === 'box' && index > 0 ? 'pane' : 'shell';
		case 'dome':
			return index === 1 || index === 2 ? 'pane' : 'frame';
		case 'grove':
			return kind === 'sphere' || index === 1 ? 'food' : 'frame';
		case 'panels':
			return kind === 'wedge' ? 'pane' : 'frame';
		case 'rack':
		case 'reservoir':
			return kind === 'dome' || kind === 'cylinder' ? slot.use : 'frame';
		case 'window':
			return index === 1 ? 'pane' : 'frame';
		case 'solar':
		case 'workshop':
			return index === 0 ? slot.use : 'pane';
		default:
			return slot.use;
	}
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
		slot.kind === 'reservoir' ? 'single-vessel' : undefined
	);
	const angle =
		attachment === 'facade'
			? Math.atan2(slot.facing[1], slot.facing[0]) -
				Math.atan2(asset.anchor.normal[1], asset.anchor.normal[0])
			: 0;
	return mountFitting(asset, { position: slot.position, size: slot.size, angle }).map((p, i) => ({
		...p,
		...surfaces[surfaceSlot(slot, p.kind, i)]
	}));
}
