import { assetRegistry } from '../assets';
import type { HouseSurfaces } from './surfaces';
import { houseObject } from './house-object';
import type { HouseUse } from '../../data/house-body';
import type { Body } from '../house-typology';
import { place } from './asset-fit';

const stock = new Map(assetRegistry.map((asset) => [asset.id, asset]));
/** Dresses every declared registry slot from the caller's palette. */
export function members(
	id: string,
	variant: string,
	seed: number,
	address: string,
	surfaces: HouseSurfaces,
	use?: HouseUse
) {
	const asset = stock.get(id);
	if (!asset) throw new RangeError('Unknown house stock ' + id);
	const roles = {
		frame: id === 'kit-crown-lantern-2p5m' && use ? surfaces[use] : surfaces.frame,
		body: use ? surfaces.shell : surfaces.frame,
		shell: surfaces.shell,
		glass: surfaces.pane,
		planting: surfaces.food,
		deck: surfaces.deck,
		accent: surfaces[use ?? 'frame'],
		channel: surfaces[use ?? 'water'],
		highlight: surfaces[use ?? 'frame']
	};
	const slots = Object.fromEntries(
		asset.slotNames.map((slot) => [slot, roles[slot as keyof typeof roles] ?? surfaces.frame])
	);
	return houseObject(id, variant, seed, { instanceId: address + '/' + id, slots }).parts;
}
/** Uses the measured registry origin and the composition's single rigid transform. */
export function bodyParts(b: Body, surfaces: HouseSurfaces) {
	return place(
		members(b.objectId, b.variant, b.seed, b.id, surfaces, b.use),
		b.nativeCenter,
		b.position,
		[b.scale, b.scale, b.scale],
		b.rotation
	);
}
