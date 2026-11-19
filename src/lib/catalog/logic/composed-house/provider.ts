import { assetRegistry } from '../assets';
import { roleSurface, type HouseSurfaces, type Surface } from './surfaces';
import { houseObject } from './house-object';
import type { HouseUse } from '../../data/house-body';
import type { Body } from '../house-typology';
import { bandParts } from './band-parts';
import { place } from './asset-fit';

const stock = new Map(assetRegistry.map((asset) => [asset.id, asset]));
function stockCoating(id: string, address: string, paint: Surface) {
	if (address.endsWith('/crown')) return roleSurface(paint, 'roof');
	if (/parapet|screen|railing/.test(id)) return roleSurface(paint, 'screen');
	if (/capsule|crown-lantern|glass-bell/.test(id)) return roleSurface(paint, 'capsule');
	if (id.includes('column-foot')) return roleSurface(paint, 'base');
	return paint;
}
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
	const paint = use ? surfaces[use] : surfaces.frame;
	const finish = stockCoating(id, address, paint);
	const roles = {
		frame: finish,
		body: finish,
		shell: use ? finish : surfaces.shell,
		glass: id.includes('solar-sail') ? finish : surfaces.pane,
		edge: roleSurface(paint, 'fitting'),
		liquid: paint,
		fabric: finish,
		planting: paint,
		deck: use ? finish : surfaces.deck,
		accent: surfaces[use ?? 'frame'],
		channel: surfaces[use ?? 'water'],
		highlight: surfaces[use ?? 'frame']
	};
	const slots = Object.fromEntries(
		asset.slotNames.map((slot) => [slot, roles[slot as keyof typeof roles] ?? surfaces.frame])
	);
	return houseObject(id, variant, seed, { instanceId: address + '/' + id, slots }).parts;
}
function drumPanels(b: Body, stock: ReturnType<typeof members>, surfaces: HouseSurfaces) {
	const panels = members(
		b.objectId,
		b.variant,
		b.seed,
		b.id,
		{ ...surfaces, pane: roleSurface(surfaces[b.use], 'capsule') },
		b.use
	);
	return stock.flatMap((p, i): typeof stock => {
		if (p.source.slot !== 'glass') return [p];
		const panel = panels[i];
		if (p.kind !== 'cylinder' || panel.kind !== 'cylinder') return [panel];
		const sill = p.height * 0.72;
		return [
			{ ...panel, id: p.id + '/sill', height: sill },
			{
				...p,
				position: [p.position[0], p.position[1], p.position[2] + sill],
				radius: Math.max(0.12, p.radius - 0.35 / b.scale),
				height: p.height - sill
			}
		];
	});
}
/** Uses the measured registry origin and the composition's single rigid transform. */
export function bodyParts(b: Body, surfaces: HouseSurfaces) {
	if (b.band) return bandParts(b, surfaces);
	const stock = members(b.objectId, b.variant, b.seed, b.id, surfaces, b.use);
	const painted =
		b.objectId.includes('crown-lantern') || b.objectId === 'glass-bell'
			? drumPanels(b, stock, surfaces)
			: stock;
	return place(
		painted.map((p) => weatherSkin(recess(p, b), b.scale)),
		b.nativeCenter,
		b.position,
		[b.scale, b.scale, b.scale],
		b.rotation
	);
}

function recess(p: ReturnType<typeof members>[number], b: Body) {
	if (!b.objectId.includes('capsule-ribbon')) return p;
	const inset = 0.35 / b.scale;
	if (p.kind === 'prism' && p.source.slot === 'glass') {
		const factor = (b.nativeSize[1] / 2 - inset) / (b.nativeSize[1] / 2 - 0.05);
		return { ...p, polygon: p.polygon.map(([x, y]): [number, number] => [x, y * factor]) };
	}
	if (p.kind === 'box' && p.source.slot === 'edge') {
		const position = [...p.position] as typeof p.position;
		position[1] -= Math.sign(position[1]) * (inset - 0.05);
		return { ...p, position };
	}
	return p;
}
function weatherSkin(p: ReturnType<typeof members>[number], scale: number) {
	if (p.kind === 'pipe') return { ...p, radius: Math.max(0.06 / scale, p.radius) };
	if (p.kind === 'box') {
		const size = p.size.map((d) => Math.max(d, 0.15)) as typeof p.size;
		// Mullions thicken toward the glazing while their exterior plane stays on the registered envelope.
		const position = p.position.map(
			(v, k) => v - (v >= 0 ? size[k] - p.size[k] : 0)
		) as typeof p.position;
		return { ...p, size, position };
	}
	return p;
}
