import { ridge } from './roof-axis';
import { roomOnDeck } from '../house-typology';
import { vaultRoof } from './vault-roof';
import { roundFootprint } from '../building-envelope';
import { interpolatePoint, type Vec3 } from '../parametrik/types';
import { ringArea } from '../quad-grid';
import { houseObject, type StockPart } from './house-object';
import type { Section } from './types';
import type { SectionSurfaces } from './surfaces';

type XY = [number, number];
type Form = 'taper' | 'capsule';
type Mesh = Extract<StockPart, { kind: 'mesh' }>;
const forms: Readonly<Partial<Record<string, Form | 'vault'>>> = {
	'buttressed-spire': 'taper',
	'diagonal-sail': 'taper',
	'tiered-ziggurat': 'taper',
	barrel: 'vault',
	vessel: 'capsule',
	'orbital-nodes': 'capsule',
	longhouse: 'capsule'
};

function convex(ring: XY[]) {
	return ring.every(([x, y], i) => {
		const a = ring[(i + 1) % ring.length],
			b = ring[(i + 2) % ring.length];
		return (a[0] - x) * (b[1] - y) - (a[1] - y) * (b[0] - x) >= -1e-8;
	});
}

function quad(mesh: Mesh, a: Vec3, b: Vec3, c: Vec3, d: Vec3) {
	const base = mesh.points.length;
	mesh.points.push(a, b, c, d);
	mesh.triangles.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

function loft(mesh: Mesh, ring: XY[], form: Form, z: number, rise: number) {
	const target = ridge(ring, form);
	const steps = form === 'taper' ? 1 : 14;
	const at = (p: XY, i: number): Vec3 => {
		const angle = (i * Math.PI) / (2 * steps),
			toward = target(p);
		const inset = 1 - Math.cos(angle);
		return [
			p[0] + inset * (toward[0] - p[0]),
			p[1] + inset * (toward[1] - p[1]),
			z + rise * Math.sin(angle)
		];
	};
	for (let i = 0; i < steps; i++)
		for (const [j, p] of ring.entries()) {
			const q = ring[(j + 1) % ring.length];
			quad(mesh, at(p, i), at(q, i), at(q, i + 1), at(p, i + 1));
		}
}

// Four wall returns carry the eaves. The open bays between them keep the roof terrace accessible.
function returns(mesh: Mesh, ring: XY[], z: number, clear: number, head = ring) {
	const lengths = ring.map((p, i) =>
		Math.hypot(p[0] - ring[(i + 1) % ring.length][0], p[1] - ring[(i + 1) % ring.length][1])
	);
	const bay = lengths.reduce((a, b) => a + b, 0) / 4;
	let at = 0;
	for (const [i, length] of lengths.entries()) {
		const a: Vec3 = [...ring[i], z],
			b: Vec3 = [...ring[(i + 1) % ring.length], z];
		for (let k = 0; k < 4; k++) {
			const lo = Math.max(0, (k * bay - at) / length),
				hi = Math.min(1, ((k + 0.38) * bay - at) / length);
			if (hi <= lo) continue;
			const p = interpolatePoint(a, b, lo),
				q = interpolatePoint(a, b, hi);
			const topA: Vec3 = [...head[i], z + clear],
				topB: Vec3 = [...head[(i + 1) % ring.length], z + clear];
			quad(mesh, p, q, interpolatePoint(topA, topB, hi), interpolatePoint(topA, topB, lo));
		}
		at += length;
	}
}

function roofMesh(
	section: Section,
	name: string,
	surface: SectionSurfaces['shell'],
	smooth = false
): Mesh {
	const stock = houseObject('primitive-mesh', 'short', section.seed, {
		instanceId: section.id + '/roof/' + name,
		slots: { body: surface }
	}).parts[0];
	if (stock.kind !== 'mesh') throw Error('Expected a roof mesh');
	return { ...stock, points: [], triangles: [], lines: [], edges: false, smooth };
}

function capsuleBelt(
	mesh: Mesh,
	ring: XY[],
	z: number,
	pane: SectionSurfaces['pane'],
	section: Section
) {
	const glass = roofMesh(section, 'clerestory', pane);
	const target = ridge(ring, 'capsule');
	const at = (p: XY, t: number, h: number): Vec3 => {
		const q = target(p);
		return [p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1]), h];
	};
	for (const [i, a] of ring.entries()) {
		const b = ring[(i + 1) % ring.length];
		quad(mesh, at(a, 0.26, z), at(b, 0.26, z), at(b, 0, z + 0.55), at(a, 0, z + 0.55));
		quad(
			mesh,
			at(a, 0, z + 0.55),
			at(b, 0, z + 0.55),
			at(b, 0.08, z + 0.55),
			at(a, 0.08, z + 0.55)
		);
		quad(
			glass,
			at(a, 0.08, z + 0.55),
			at(b, 0.08, z + 0.55),
			at(b, 0.08, z + 1.15),
			at(a, 0.08, z + 1.15)
		);
		quad(
			mesh,
			at(a, 0.08, z + 1.15),
			at(b, 0.08, z + 1.15),
			at(b, 0, z + 1.15),
			at(a, 0, z + 1.15)
		);
	}
	return glass;
}

function roofDeck(section: Section) {
	const deck = section.composition.parts.find((p) => p.id.endsWith('/roof-walk'));
	if (deck?.kind !== 'prism' || !convex(deck.polygon)) return;
	if ((deck.holes?.length ?? 0) <= 1) return deck;
}

type Roof = NonNullable<ReturnType<typeof roofDeck>>;
function eaveRing(form: Form, deck: Roof, span: number) {
	if (form !== 'capsule' || deck.polygon.length >= 12) return deck.polygon;
	const rounded = roundFootprint(deck.polygon, span * 0.45);
	return deck.holes?.flat().every((p) => roomOnDeck(rounded, [], ...p, 0, 0))
		? rounded
		: deck.polygon;
}

/** Spans the walkable roof of a layered ensemble member with its surveyed silhouette in metres. */
export function profileRoof(section: Section, surfaces: SectionSurfaces): StockPart[] {
	const h = section.composition,
		form = forms[h.signature.body];
	if (!form || !section.slottedSkin || h.ensembleSize < 2) return [];
	const deck = roofDeck(section);
	if (!deck) return [];
	const clear = Math.max(2.15, h.sharedRoof === 'head' ? h.crown.size[2] + 0.15 : 0);
	if (form === 'vault') return vaultRoof(section, deck.polygon, surfaces, clear);
	return loftRoof(section, surfaces, form, deck, clear);
}

function loftRoof(
	section: Section,
	surfaces: SectionSurfaces,
	form: Form,
	deck: Roof,
	clear: number
): StockPart[] {
	const span = Math.sqrt(Math.abs(ringArea(deck.polygon)));
	const ring = eaveRing(form, deck, span);
	const mesh = roofMesh(section, 'envelope', surfaces.shell, form === 'capsule');
	let spring = section.top + clear;
	const panes: Mesh[] = [];
	if (form === 'capsule') {
		const target = ridge(ring, form);
		const seat = ring.map((p): XY => {
			const q = target(p);
			return [0.74 * p[0] + 0.26 * q[0], 0.74 * p[1] + 0.26 * q[1]];
		});
		returns(mesh, ring, section.top, clear, seat);
		panes.push(capsuleBelt(mesh, ring, spring, surfaces.pane, section));
		spring += 1.15;
	} else returns(mesh, ring, section.top, clear);
	loft(mesh, ring, form, spring, span * { taper: 0.95, capsule: 0.42 }[form]);
	return [mesh, ...panes];
}
