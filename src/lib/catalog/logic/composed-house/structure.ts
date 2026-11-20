import { bounds, union } from '../ansicht/geometrie';
import type { Solid } from '../house-typology';
import type { Section } from './types';
import type { Vec3 } from '../parametrik/types';
import { members } from './provider';
import { place } from './asset-fit';
import { houseObject, type HousePart, type StockPart } from './house-object';
import { roleSurface, type HouseSurfaces } from './surfaces';
import { pipeBetween } from './parts';

/** A cradle belongs to the capsule it holds and takes the living surface. Column feet, shafts and
 * heads are structure and stay on the frame surface. */
function bearingSurfaces(p: Solid, surfaces: HouseSurfaces) {
	return p.joint === 'socket' ? { ...surfaces, frame: surfaces.living } : surfaces;
}
function bearingStock(s: Section, p: Extract<Solid, { kind: 'box' }>, surfaces: HouseSurfaces) {
	const socket = p.joint === 'socket';
	const id = socket
		? 'kit-capsule-cradle-2p5m'
		: 'kit-column-' + p.joint + (p.joint === 'shaft' ? '-2m' : '-0p5m');
	return members(
		p.source?.objectId ?? id,
		p.source?.variant ?? (socket ? 'shallow' : 'light'),
		s.seed,
		p.id,
		bearingSurfaces(p, surfaces)
	);
}
function bearing(s: Section, p: Extract<Solid, { kind: 'box' }>, surfaces: HouseSurfaces) {
	const socket = p.joint === 'socket';
	const stock = bearingStock(s, p, surfaces);
	const box = union(stock.map(bounds));
	const scale = p.size.map((v, i) => v / (box.max[i] - box.min[i])) as Vec3;
	const fitted = place(stock, box.min, p.position, scale, 0);
	if (socket) return fitted.map((m) => socketLip(m, p));
	return p.joint === 'beam' ? fitted : columnSections(fitted, p);
}
function socketLip(member: StockPart, p: Extract<Solid, { kind: 'box' }>): StockPart {
	if (member.kind !== 'box') return member;
	const size = member.size.map((d) => Math.max(d, 0.12)) as Vec3;
	const position = member.position.map((v, k) =>
		Math.min(v, p.position[k] + p.size[k] - size[k])
	) as Vec3;
	return { ...member, position, size };
}
function columnSections(stock: StockPart[], p: Extract<Solid, { kind: 'box' }>): StockPart[] {
	const lip = Math.max(0.12, Math.min(p.size[2] / 2, 0.15));
	return stock.flatMap((part, i): StockPart[] => {
		if (part.kind !== 'cylinder') return [part];
		const single = p.size[2] < 0.24 || p.joint === 'foot';
		if (single && i) return [];
		const h = single ? p.size[2] : i ? lip : p.size[2] - lip;
		return [
			{
				...part,
				radius: Math.max(0.15, part.radius),
				height: h,
				position: [part.position[0], part.position[1], p.position[2] + (i ? p.size[2] - lip : 0)]
			}
		];
	});
}
function slabStock(s: Section, p: Solid, surfaces: HouseSurfaces) {
	const stock = houseObject(
		p.source?.objectId ?? 'primitive-slab',
		p.source?.variant ?? 'square',
		s.seed,
		{
			instanceId: p.id,
			slots: { body: surfaces.deck }
		}
	).parts[0];
	if (stock.kind !== 'prism') throw new Error('Expected slab stock');
	return stock;
}
function floor(s: Section, p: Solid, surfaces: HouseSurfaces): StockPart {
	const stock = slabStock(s, p, surfaces);
	const h = p.size[2];
	if (p.kind === 'prism')
		return {
			...stock,
			id: p.id,
			polygon: p.polygon,
			holes: p.holes,
			z: p.z,
			height: p.height,
			roofCell: s.cells[0].id
		};
	if (p.kind !== 'box' && p.kind !== 'cylinder') throw new Error('Expected floor');
	return {
		...stock,
		id: p.id,
		polygon: floorRing(s, p),
		z: p.position[2],
		height: h,
		roofCell: s.cells[0].id
	};
}
function floorRing(s: Section, p: Extract<Solid, { kind: 'box' | 'cylinder' | 'cone' }>) {
	const [w, d] = p.size;
	const [x, y] = p.position;
	const level = s.composition.levels.find(
		(l) => Math.abs(l.position[2] - p.position[2] - p.size[2]) < 1e-8
	);
	const polygon: [number, number][] =
		p.kind === 'cylinder' && level
			? level.outline.map(([u, v]) => [u, v])
			: [
					[x, y],
					[x + w, y],
					[x + w, y + d],
					[x, y + d]
				];
	return polygon;
}
function deckParts(s: Section, p: Solid, surfaces: HouseSurfaces) {
	if (p.slot === 'base')
		return [floor(s, p, { ...surfaces, deck: roleSurface(surfaces[s.decks[0].use], 'base') })];
	const painted = ['/roof', '/roof-walk', '/entry'].some((suffix) => p.id.endsWith(suffix));
	const deck = floor(
		s,
		p,
		painted
			? { ...surfaces, deck: roleSurface(surfaces.shell, p.id.endsWith('/roof') ? 'roof' : 'deck') }
			: surfaces
	);
	if (deck.kind !== 'prism' || deck.height < 0.42) return [deck];
	const level = s.decks.find((l) => Math.abs(l.position[2] - deck.z - deck.height) < 1e-7);
	if (!level) return [deck];
	const apron = floor(s, p, { ...surfaces, deck: roleSurface(surfaces[level.use], 'deck') });
	return [
		{ ...deck, z: deck.z + deck.height - 0.12, height: 0.12 },
		{ ...apron, id: p.id + '/apron', height: deck.height - 0.12 }
	];
}
/** Fits manufactured columns and sockets to their surveyed joints, and cuts plates to their outlines. */
function structuralStock(s: Section, p: Solid, surfaces: HouseSurfaces): StockPart[] {
	if (p.joint === 'attic') {
		const use = s.composition.levels[s.composition.levels.length - 1].use;
		return [
			floor(s, p, {
				...surfaces,
				deck: roleSurface(surfaces[p.slot === 'shell' ? 'shell' : use], 'capsule')
			})
		];
	}
	if (p.id.endsWith('/socle/body/0'))
		return [floor(s, p, { ...surfaces, deck: surfaces[s.decks[0].use] })];
	if (p.joint === 'deck') return deckParts(s, p, surfaces);
	if (p.joint === 'brace' && p.kind === 'mesh') {
		const centre = (i: number): Vec3 =>
			p.points[i].map((v, k) => (v + p.points[i + 2][k]) / 2) as Vec3;
		const lower = centre(0),
			upper = centre(4);
		const radius = Math.min(p.size[1] / 2, (upper[2] - lower[2]) / 2);
		const inset = radius / (upper[2] - lower[2]);
		const at = (t: number): Vec3 => lower.map((v, k) => v + t * (upper[k] - v)) as Vec3;
		return [pipeBetween(p.id, at(inset), at(1 - inset), radius, surfaces.frame)];
	}
	if (p.kind === 'box' && ['socket', 'foot', 'shaft', 'head', 'beam'].includes(p.joint))
		return bearing(s, p, surfaces);
	return [];
}
/** Projects each solid with its declared load path on every registry member. */
export function houseStructure(s: Section, surfaces: HouseSurfaces): HousePart[] {
	return s.composition.parts.flatMap((p) =>
		structuralStock(s, p, surfaces).map((member) => ({
			...member,
			structuralRole: p.structuralRole
		}))
	);
}
