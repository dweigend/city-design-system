import { finishMaterial } from '../material/surface';
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
function stockSurfaces(
	id: string,
	paint: Surface,
	finish: Surface,
	surfaces: HouseSurfaces,
	use?: HouseUse
) {
	return {
		frame: id.includes('parapet-rail') ? surfaces.frame : finish,
		body: finish,
		shell: use ? finish : surfaces.shell,
		glass: id.includes('solar-sail') ? finish : surfaces.pane,
		edge: id.includes('parapet') || id.includes('deck') ? roleSurface(paint, 'fitting') : finish,
		liquid: paint,
		fabric: finish,
		planting: paint,
		deck: use ? finish : surfaces.deck,
		accent: paint,
		channel: surfaces[use ?? 'water'],
		highlight: paint
	};
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
	const roles = stockSurfaces(id, paint, finish, surfaces, use);
	const body = /\/body\/\d+$/.test(address);
	const slots = Object.fromEntries(
		asset.slotNames.map((slot) => [
			slot,
			body
				? slot === 'glass' && /^kit-capsule-(ribbon|porthole|door)-/.test(id)
					? roleSurface(surfaces.pane, 'glazing')
					: roleSurface(paint, 'capsule')
				: id.startsWith('person-')
					? paint
					: (roles[slot as keyof typeof roles] ?? surfaces.frame)
		])
	);
	return houseObject(id, variant, seed, { instanceId: address + '/' + id, slots }).parts;
}
function bodyStock(b: Body, surfaces: HouseSurfaces) {
	if (b.band) return bandParts(b, surfaces);
	const stock = members(b.objectId, b.variant, b.seed, b.id, surfaces, b.use);
	const rim = roleSurface(surfaces[b.use], 'rim');
	return place(
		stock.map((p) =>
			capsuleLine(p, b)
				? { ...p, ...rim, material: finishMaterial(rim.finish) }
				: weatherSkin(recess(p, b), b.scale)
		),
		b.nativeCenter,
		b.position,
		[b.scale, b.scale, b.scale],
		b.rotation
	);
}

/** Mounts the body stock with the load path assigned by the composition. */
export function bodyParts(b: Body, surfaces: HouseSurfaces) {
	return bodyStock(b, surfaces).map((p) => ({ ...p, structuralRole: b.structuralRole }));
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

// Older capsule kits also assign the edge slot to full-width mounting pads.
function capsuleLine(p: ReturnType<typeof members>[number], b: Body) {
	if (b.kind !== 'capsule' || p.source.slot !== 'edge') return false;
	if (p.kind === 'ring') return (p.radius - p.innerRadius) * b.scale < 0.15;
	if (p.kind === 'pipe') return 2 * p.radius * b.scale < 0.15;
	if (p.kind === 'torus') return 2 * p.tube * b.scale < 0.15;
	if (p.kind === 'box') return p.size.filter((d) => d * b.scale < 0.15).length >= 2;
	return false;
}
