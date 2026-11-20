import { assetRegistry } from '../assets';
import {
	shellSurface,
	roleSurface,
	type SectionSurfaces,
	type Surface,
	type BandAccent
} from './surfaces';
import { houseObject } from './house-object';
import type { HouseUse } from '../../data/house-body';
import type { Body } from '../house-typology';
import { bandParts } from './band-parts';
import { place } from './asset-fit';

const stock = new Map(assetRegistry.map((asset) => [asset.id, asset]));
function stockSurface(id: string, address: string, surface: Surface) {
	if (address.endsWith('/crown') || /capsule|lantern|bell/.test(id))
		return roleSurface(surface, 'shell');
	if (/parapet|screen|railing/.test(id)) return roleSurface(surface, 'screen');
	if (id.includes('column-foot')) return roleSurface(surface, 'base');
	return surface;
}
function stockSurfaces(
	id: string,
	paint: Surface,
	finish: Surface,
	surfaces: SectionSurfaces,
	use?: HouseUse
) {
	return {
		frame: finish,
		body: finish,
		shell: use ? finish : surfaces.shell,
		glass: surfaces.pane,
		edge: roleSurface(paint, 'fitting'),
		liquid: paint,
		fabric: finish,
		planting: paint,
		deck: id.includes('parapet') ? finish : surfaces.deck,
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
	surfaces: SectionSurfaces,
	use?: HouseUse,
	body?: Surface,
	pane = surfaces.pane
) {
	const asset = stock.get(id);
	if (!asset) throw new RangeError('Unknown house stock ' + id);
	const paint = use ? surfaces[use] : surfaces.frame;
	const finish = stockSurface(id, address, paint);
	const roles = stockSurfaces(id, paint, finish, surfaces, use);
	if (body) {
		roles.shell = shellSurface(surfaces.shell, body);
		roles.edge = roleSurface(paint, 'frame');
		roles.accent = body;
		roles.highlight = body;
		roles.body = body;
		roles.frame = body;
		roles.glass = pane;
	}
	const slots = Object.fromEntries(
		asset.slotNames.map((slot) => [
			slot,
			id.startsWith('person-')
				? surfaces.frame
				: (roles[slot as keyof typeof roles] ?? surfaces.frame)
		])
	);
	return houseObject(id, variant, seed, { instanceId: address + '/' + id, slots }).parts;
}
/** Uses the measured registry origin and the composition's single rigid transform. */
function bodyStock(b: Body, surfaces: SectionSurfaces, accent: BandAccent) {
	if (b.band) return bandParts(b, surfaces, accent);
	const paint = surfaces[b.use];
	const shell = roleSurface(paint, 'shell');
	const stock = members(
		b.objectId,
		b.variant,
		b.seed,
		b.id,
		surfaces,
		b.use,
		/\/body\/\d+$/.test(b.id) ? shell : undefined
	);
	return place(
		stock.map((p) => (capsuleLine(p, b) ? p : weatherSkin(recess(p, b), b.scale))),
		b.nativeCenter,
		b.position,
		[b.scale, b.scale, b.scale],
		b.rotation
	);
}

/** Mounts the body stock with the load path assigned by the composition. */
export function bodyParts(b: Body, surfaces: SectionSurfaces, accent: BandAccent = 'none') {
	return bodyStock(b, surfaces, accent).map((p) => ({
		...p,
		structuralRole: b.structuralRole
	}));
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
