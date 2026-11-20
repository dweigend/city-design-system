import { expect, test } from 'bun:test';
import { resolveFinish } from '../material/surface';
import { printPatterns } from '../../data/materialPrint';
import { bounds } from '../ansicht/geometrie';
import { circulation, houseSurfaces, sectionParts } from '../composed-house';
import { specimen, minimumGauge } from './specimens';
import { wideTypologies as typologies, type Typology } from './families';

type Part = ReturnType<typeof sectionParts>[number];
type XY = [number, number];

function stockThickness(p: Part) {
	switch (p.kind) {
		case 'prism':
			return p.height;
		case 'box':
			return Math.min(...p.size);
		case 'cylinder':
			return Math.min(p.radius * 2, p.height);
		case 'pipe':
		case 'capsule':
			return p.radius * 2;
	}
}
test('stock gauges and service pipe runs hold across the sixteen typologies', () => {
	for (const type of typologies)
		for (const cells of type === 'courtyard-house' ? [4] : [1, 2, 4]) {
			checkStockGauges(specimen(cells, type));
		}
});
function checkStockGauges(section: ReturnType<typeof specimen>) {
	const parts = sectionParts(section);
	for (const p of parts.filter((p) => !p.source.objectId.startsWith('person-'))) {
		const thickness = stockThickness(p);
		if (thickness !== undefined)
			expect(thickness, p.id).toBeGreaterThanOrEqual(minimumGauge(section, p) - 1e-8);
	}
	const pipes = parts.filter((p) => p.id.includes('/service/pipe/'));
	expect(pipes.length).toBeLessThanOrEqual(2);
	for (const p of pipes) {
		if (p.kind !== 'pipe') throw Error('Expected a supply pipe');
		expect(p.radius * 2).toBeWithin(0.3, 0.5);
		const length = p.points
			.slice(1)
			.reduce((sum, b, i) => sum + Math.hypot(...b.map((v, k) => v - p.points[i][k])), 0);
		expect(length).toBeLessThanOrEqual(section.top - section.base[2]);
	}
}
function edgeDistance(a: XY, b: XY, p: XY) {
	const dx = b[0] - a[0],
		dy = b[1] - a[1];
	const t = Math.max(
		0,
		Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1))
	);
	return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
function inside(point: XY, ring: XY[]) {
	const [x, y] = point;
	const crossings = ring.filter(([a, b], i) => {
		const [c, d] = ring[(i + 1) % ring.length];
		return b > y !== d > y && x < a + ((c - a) * (y - b)) / (d - b);
	});
	return crossings.length % 2 === 1;
}
function onDeck(point: XY, deck: Extract<Part, { kind: 'prism' }>) {
	const rings = [deck.polygon, ...(deck.holes ?? [])];
	if (
		rings.some((r) => r.some((a, i) => edgeDistance(a, r[(i + 1) % r.length], point) <= 0.020001))
	)
		return true;
	return inside(point, deck.polygon) && !(deck.holes ?? []).some((h) => inside(point, h));
}
test('every floor and roof exit meets its physical deck within two centimetres', () => {
	for (const type of [
		'deck-tower',
		'rack',
		'cluster-mast',
		'terrace-house',
		'plinth-house',
		'round-tower',
		'courtyard-house',
		'water-house',
		'tree-house',
		'portal-house',
		'lattice-head',
		'slab-house',
		'bridge-house',
		'twin-stack',
		'capsule-stack',
		'bell-house'
	] as const) {
		const cells =
			type === 'courtyard-house'
				? 4
				: ['terrace-house', 'portal-house', 'twin-stack', 'bridge-house', 'slab-house'].includes(
							type
					  )
					? 2
					: 1;
		const s = specimen(cells, type),
			floors = sectionParts(s).filter((p) => p.kind === 'prism' && p.roofCell !== undefined);
		for (const {
			door: [x, y, z]
		} of circulation(s).docks)
			expect(
				floors.some(
					(p) => p.kind === 'prism' && Math.abs(p.z + p.height - z) <= 0.02 && onDeck([x, y], p)
				),
				type + ' at ' + z
			).toBe(true);
	}
});
test('each ladder flight starts on a physical landing shared by both ladder lanes', () => {
	for (const t of typologies) {
		const s = specimen(2, t),
			parts = sectionParts(s);
		const landings = parts.filter((p) => p.kind === 'prism' && p.id.includes('/stair/landing/'));
		const route = circulation(s);
		for (const flight of route.legs.filter((l) => l.kind === 'ladder')) {
			const [x, y, z] = flight.from;
			expect(
				landings.some(
					(p) => p.kind === 'prism' && Math.abs(p.z + p.height - z) <= 0.02 && onDeck([x, y], p)
				)
			).toBe(true);
		}
	}
});
test('a thirteen-storey envelope carries a structural wall from grade to its crest', () => {
	const s = specimen(1, 'deck-tower', 13);
	const exterior = s.composition.exterior;
	if (!exterior) throw Error('Missing structural envelope');
	expect(exterior.system).toBe(s.composition.signature.support);
	expect(exterior.stations).toHaveLength(14);
	const walls = sectionParts(s).filter((p) => p.source.objectId === 'full-height-shell');
	expect(walls.length).toBeGreaterThan(3);
	for (const wall of walls) {
		if (wall.kind !== 'mesh') throw Error('Expected bearing mesh');
		expect(wall.source.variant).toBe(exterior.system);
		expect(Math.min(...wall.points.map((p) => p[2]))).toBeCloseTo(s.composition.ground);
		expect(Math.max(...wall.points.map((p) => p[2]))).toBeCloseTo(s.top);
	}
});
test('four-cell housing exposes programme stock and an open bay, terrace or courtyard', () => {
	const uses = new Set(
		['living', 'food', 'water', 'material', 'energy'].map(
			(k) => houseSurfaces[k as keyof typeof houseSurfaces].token
		)
	);
	for (const type of [
		'plinth-house',
		'terrace-house',
		'courtyard-house',
		'round-tower',
		'rack',
		'bell-house'
	] as Typology[]) {
		const s = specimen(4, type),
			h = s.composition,
			parts = sectionParts(s);
		for (const level of h.levels)
			expect(
				level.bodies.some((b) =>
					parts.some(
						(p) =>
							p.id.startsWith(b.id + '/' + b.objectId + '/') &&
							(uses.has(p.token) || p.token === houseSurfaces.shell.token)
					)
				),
				type
			).toBe(true);
		const open = h.levels.some(
			(l) =>
				l.court ||
				l.well ||
				l.void ||
				l.field ||
				l.width * l.depth < h.bay.width * h.bay.depth * 0.75
		);
		expect(open, type).toBe(true);
	}
});

test('registry groups have unscaled feet on terraces, landings or roofs', () => {
	for (const type of typologies) {
		const s = specimen(type === 'courtyard-house' ? 4 : 2, type),
			parts = sectionParts(s);
		const floors = parts.filter(
			(p): p is Extract<Part, { kind: 'prism' }> =>
				p.kind === 'prism' && (p.roofCell !== undefined || p.id.endsWith('/landing'))
		);
		const groups = Map.groupBy(
			parts.filter((p) => p.source.objectId.startsWith('person-')),
			(p) => p.id.split('/person-')[0]
		);
		expect(groups.size, type).toBe(s.composition.people.length);
		for (const [id, figure] of groups) {
			const feet = figure.map(bounds).sort((a, b) => a.min[2] - b.min[2])[0];
			const point: XY = [(feet.min[0] + feet.max[0]) / 2, (feet.min[1] + feet.max[1]) / 2];
			expect(
				floors.some((p) => Math.abs(feet.min[2] - p.z - p.height) < 0.02 && onDeck(point, p)),
				type + ' ' + id
			).toBe(true);
		}
	}
});
test('glazing and sill follow the surveyed inner weather line and share a horizontal joint', () => {
	for (const t of typologies) {
		const house = specimen(2, t),
			parts = sectionParts(house);
		for (const b of house.slots.filter((b) => b.band?.footprint)) {
			const courses = parts.filter((p) => p.id.startsWith(b.id + '/primitive-slab/'));
			const pane = courses.find((p) => p.id.includes('/window')),
				sill = courses.find((p) => p.id.includes('/sill'));
			if (pane?.kind !== 'prism' || sill?.kind !== 'prism') throw Error('Missing glazing or sill');
			expect(b.band?.lining).toEqual(pane.polygon);
			expect(sill.polygon).toEqual(pane.polygon);
			expect(sill.z + sill.height).toBeCloseTo(pane.z);
		}
	}
});

test('every typology exposes its specified catalogue finishes', () => {
	for (const type of typologies) {
		const s = specimen(type === 'courtyard-house' ? 4 : 2, type);
		const parts = sectionParts(s);
		expect(new Set(parts.map((p) => p.finish)).size, type).toBeGreaterThanOrEqual(3);
		parts.forEach(checkFinish);
		for (const b of s.composition.levels.flatMap((l) => l.bodies)) {
			const skin = parts.filter(
				(p) =>
					p.id.startsWith(b.id + '/' + b.objectId + '/') &&
					!['glass', 'edge', 'trim'].includes(p.source.slot) &&
					!p.id.includes('/ladder-housing/') &&
					!p.id.endsWith('/attic') &&
					!p.id.includes('/window-')
			);
			expect(skin.length).toBeGreaterThan(0);
			expect(new Set(skin.map((p) => p.token + '/' + p.finish)).size, b.id).toBe(1);
			if (Math.max(...b.size) > 2)
				for (const part of skin) expect(linePattern(part), part.id).toBe(false);
		}
	}
});
// The scene dispatches architectural prints by catalogue code. Physical corrugation and
// moulded ribs also carry repeating lines. Frosted acrylic has only grazing colour and microrelief.
function linePattern(p: Part) {
	if (!p.finish) throw Error('Missing body finish');
	const recipe = resolveFinish(p.finish, p.token);
	if (recipe.kind === 'pattern') return [1, 2, 6].includes(printPatterns[recipe.id]);
	if (recipe.kind === 'diagram')
		return !recipe.coating && ['lamelle', 'welle', 'naht'].includes(recipe.pattern ?? '');
	return (
		recipe.kind === 'physical' && ['corrugated-metal', 'kunststoff-gerippt'].includes(recipe.id)
	);
}
function checkFinish(p: Part) {
	if (p.id.endsWith('/roof')) expect(p.finish).toBe('corrugated-metal');
	if (p.source.objectId.includes('parapet'))
		expect(p.finish).toBe(p.source.slot === 'edge' ? 'metall-messing' : 'perforated-metal');
	if (
		p.id.includes('/body/') &&
		p.source.objectId.startsWith('kit-capsule') &&
		p.source.slot === 'shell'
	)
		expect(p.finish).toBe('acryl-matt');
	if (p.id.endsWith('/deck')) expect(p.finish).toBe(houseSurfaces.deck.finish);
}
test('the roof ornament sits on the final deck of the supported volume', () => {
	for (const t of typologies) {
		const house = specimen(2, t),
			crown = house.composition.crown;
		expect(house.composition.sharedRoof).toBe('head');
		expect(crown.position[2]).toBeCloseTo(house.top);
		expect(sectionParts(house).some((p) => p.id.startsWith(crown.id + '/'))).toBe(true);
	}
});

test('public flights span two 1.25 m stock plates at each riser', () => {
	for (const type of typologies) {
		const s = specimen(type === 'courtyard-house' ? 4 : 2, type);
		if (s.compact) continue;
		expect(circulation(s).width, type).toBe(2.5);
		const parts = sectionParts(s),
			halves = parts.filter((p) => p.id.includes('/stair/') && p.id.endsWith('/tread/outer'));
		expect(halves.length, type).toBeGreaterThan(0);
		for (const second of halves) checkTreadPair(parts, second);
	}
});
function checkTreadPair(parts: Part[], second: Part) {
	if (second.kind !== 'prism') throw Error('Expected a second registered tread');
	expect(second.height).toBeLessThanOrEqual(0.25);
	const spine = parts.find(
		(p) => p.id === second.id.replace(/(?:\/stairs)?\/tread\/outer$/, '/stringer')
	);
	if (spine?.kind !== 'prism') throw Error('Missing tread spine ' + second.id);
	expect(spine.height).toBeGreaterThanOrEqual(0.3);
	expect(
		Math.hypot(spine.polygon[0][0] - spine.polygon[3][0], spine.polygon[0][1] - spine.polygon[3][1])
	).toBeCloseTo(0.3);
	expect(spine.z + spine.height).toBeCloseTo(second.z);

	const first = parts.find((p) => p.id === second.id.slice(0, -6));
	if (first?.kind !== 'prism') throw Error('Missing inside tread');
	const span = Math.hypot(
		first.polygon[0][0] - second.polygon[3][0],
		first.polygon[0][1] - second.polygon[3][1]
	);
	expect(span).toBeCloseTo(2.5);
}
