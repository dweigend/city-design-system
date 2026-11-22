import { expect, test } from 'bun:test';
import {
	assetRegistry,
	buildObject,
	ribbonDimensions,
	ribbonPierGeometry,
	type RibbonSection
} from './index';
import { edgePath } from '../movement-network';
import { openingScene } from '../sandbox';
import { cityCorridorPlan } from '../sandbox/city-corridors';
import { edgeSections } from '../walkway-network/edge-sections';
import { column, ribbonProfile } from '../walkway-network/ribbon-column';
import { pathSurfaces } from '../walkway-network/town-palette';

const sampleSections: RibbonSection[] = [
	{ centre: [0, 0, 3], left: [0, 0.9, 3], right: [0, -0.9, 3] },
	{ centre: [5, 0, 3], left: [5, 0.9, 3], right: [5, -0.9, 3] },
	{ centre: [10, 0, 3], left: [10, 0.9, 3], right: [10, -0.9, 3] }
];

function unitPlanTangent(
	from: readonly [number, number, number],
	to: readonly [number, number, number]
) {
	const dx = to[0] - from[0];
	const dy = to[1] - from[1];
	const len = Math.hypot(dx, dy);
	return [dx / len, dy / len] as const;
}

test('ribbon-segment is registered as a site-parametric access object with a stock preview', () => {
	const entry = assetRegistry.find((a) => a.id === 'ribbon-segment');
	expect(entry).toBeDefined();
	expect(entry?.category).toBe('access');
	expect(entry?.siteParametric).toBe(true);
	expect(entry?.variants).toEqual(['supported', 'paired', 'tunnel']);
	expect(entry?.slotNames).toEqual(['walking', 'bearing']);
	expect(entry?.footprint).toEqual([6, 1.8]);
	expect(entry?.anchors).toEqual([{ attachment: 'deck', position: [0, 0, 0], normal: [0, 0, 1] }]);
});

test('ribbon-segment projects colour-free site geometry, swept footprint and outward port anchors', () => {
	const ports = {
		start: { id: 'a', position: [0, 0, 3] as const, heading: Math.PI },
		end: { id: 'b', position: [10, 0, 3] as const, heading: 0 }
	};
	const built = buildObject('ribbon-segment', 'supported', 7, {
		instanceId: 'town-walk/a>b',
		site: { sections: sampleSections, ground: () => 0, ports }
	});
	expect(built.footprint).toEqual([10, 1.8]);
	expect(built.anchors).toHaveLength(2);
	expect(built.anchors[0].position).toEqual([0, 0, 3]);
	expect(built.anchors[0].normal[0]).toBeCloseTo(-1, 10);
	expect(built.anchors[1].position).toEqual([10, 0, 3]);
	expect(built.anchors[1].normal[0]).toBeCloseTo(1, 10);
	expect(built.geometry[0].id).toBe('town-walk/a>b/ramp');
	expect(built.geometry[0].slot).toBe('walking');
	for (const part of built.geometry) {
		expect(part).not.toHaveProperty('token');
		expect(part).not.toHaveProperty('finish');
		expect(part).not.toHaveProperty('material');
	}
	expect(built.parts[0]).toMatchObject({
		id: 'town-walk/a>b/ramp',
		role: 'neu',
		material: 'acrylic',
		token: '--cat-business',
		finish: 'kunststoff-formteil'
	});
	expect(built.parts.slice(1).every((p) => p.id.startsWith('town-walk/a>b/pier/'))).toBe(true);
});

test('inward-facing port headings and reversed edges still yield outward segment anchor normals', () => {
	// Host-facing dock ports: start heading points +x (into segment), end heading points -x (into segment).
	const inwardPorts = {
		start: { id: 'a', position: [0, 0, 3] as const, heading: 0 },
		end: { id: 'b', position: [10, 0, 3] as const, heading: Math.PI }
	};
	const forward = buildObject('ribbon-segment', 'supported', 0, {
		instanceId: 'dock/forward',
		site: { sections: sampleSections, ground: () => 0, ports: inwardPorts }
	});
	expect(forward.anchors[0].normal[0]).toBeCloseTo(-1, 10);
	expect(forward.anchors[1].normal[0]).toBeCloseTo(1, 10);

	// Reversing the edge swaps start and end while keeping the same surveyed port headings.
	const reversedSections: RibbonSection[] = [...sampleSections]
		.reverse()
		.map(({ centre, left, right }) => ({ centre, left: right, right: left }));
	const reversed = buildObject('ribbon-segment', 'supported', 0, {
		instanceId: 'dock/reversed',
		site: {
			sections: reversedSections,
			ground: () => 0,
			ports: { start: inwardPorts.end, end: inwardPorts.start }
		}
	});
	expect(reversed.anchors[0].position).toEqual([10, 0, 3]);
	expect(reversed.anchors[0].normal[0]).toBeCloseTo(1, 10);
	expect(reversed.anchors[1].position).toEqual([0, 0, 3]);
	expect(reversed.anchors[1].normal[0]).toBeCloseTo(-1, 10);
});

test('material-only slot assignments dress ribbon segments without token or finish', () => {
	const paper = { role: 'bestand', material: 'paper' } as const;
	const built = buildObject('ribbon-segment', 'paired', 0, {
		instanceId: 'study/link',
		slots: { walking: paper, bearing: paper },
		site: { sections: sampleSections, ground: () => 0 }
	});
	expect(built.parts.length).toBeGreaterThan(1);
	for (const part of built.parts) {
		expect(part.role).toBe('bestand');
		expect(part.material).toBe('paper');
		expect(part.token).toBeUndefined();
		expect(part.finish).toBeUndefined();
	}
	expect(built.parts.some((p) => p.id === 'study/link/pier/0/0')).toBe(true);
	expect(built.parts.some((p) => p.id === 'study/link/pier/1/0')).toBe(true);
});

test('tunnel variant omits piers and invalid site inputs throw RangeError', () => {
	const tunnel = buildObject('ribbon-segment', 'tunnel', 0, {
		instanceId: 'town-walk/tunnel',
		site: { sections: sampleSections, ground: () => 0 }
	});
	expect(tunnel.parts).toHaveLength(1);
	expect(tunnel.parts[0].id).toBe('town-walk/tunnel/ramp');
	expect(() =>
		buildObject('ribbon-segment', 'supported', 0, {
			site: { sections: [sampleSections[0]], ground: () => 0 }
		})
	).toThrow(RangeError);
	expect(() =>
		buildObject('porthole', 'round', 0, {
			site: { sections: sampleSections, ground: () => 0 }
		})
	).toThrow(RangeError);
});

test('site footprint encloses piers even when the deck is narrower than a pier diameter', () => {
	const narrowSections: RibbonSection[] = [
		{ centre: [0, 0, 3], left: [0, 0.1, 3], right: [0, -0.1, 3] },
		{ centre: [4, 0, 3], left: [4, 0.1, 3], right: [4, -0.1, 3] }
	];
	const supported = buildObject('ribbon-segment', 'supported', 0, {
		instanceId: 'narrow/supported',
		site: { sections: narrowSections, ground: () => 0 }
	});
	expect(supported.footprint[0]).toBeCloseTo(4, 10);
	expect(supported.footprint[1]).toBeCloseTo(ribbonDimensions.columnRadius * 2, 10);

	const tunnel = buildObject('ribbon-segment', 'tunnel', 0, {
		instanceId: 'narrow/tunnel',
		site: { sections: narrowSections, ground: () => 0 }
	});
	expect(tunnel.footprint[0]).toBeCloseTo(4, 10);
	expect(tunnel.footprint[1]).toBeCloseTo(0.2, 10);
});

test('buildObject detaches returned stock and site geometry from internal and caller state', () => {
	const firstStock = buildObject('ribbon-segment', 'supported', 0);
	const mesh0 = firstStock.geometry[0];
	const part0 = firstStock.parts[0];
	expect(mesh0.kind).toBe('mesh');
	expect(part0.kind).toBe('mesh');
	if (mesh0.kind === 'mesh') mesh0.points[2][0] = 999;
	if (part0.kind === 'mesh') part0.points[3][1] = -999;
	(firstStock.footprint as [number, number])[0] = 777;
	firstStock.anchors[0].position[0] = 555;

	const secondStock = buildObject('ribbon-segment', 'paired', 0);
	expect(secondStock.footprint).toEqual([6, 1.8]);
	expect(secondStock.anchors).toEqual([
		{ attachment: 'deck', position: [0, 0, 0], normal: [0, 0, 1] }
	]);
	const mesh1 = secondStock.geometry[0];
	expect(mesh1.kind).toBe('mesh');
	if (mesh1.kind === 'mesh') {
		expect(mesh1.points[2][0]).toBe(-3);
		expect(mesh1.points[3][1]).toBe(-0.9);
	}

	const siteSections: RibbonSection[] = [
		{ centre: [0, 0, 3], left: [0, 0.9, 3], right: [0, -0.9, 3] },
		{ centre: [5, 0, 3], left: [5, 0.9, 3], right: [5, -0.9, 3] }
	];
	const siteBuilt = buildObject('ribbon-segment', 'supported', 0, {
		instanceId: 'site/copy',
		site: { sections: siteSections, ground: () => 0 }
	});
	if (siteBuilt.geometry[0].kind === 'mesh') siteBuilt.geometry[0].points[2][0] = 888;
	if (siteBuilt.parts[0].kind === 'mesh') siteBuilt.parts[0].points[3][1] = -888;
	expect(siteSections[0].left[0]).toBe(0);
	expect(siteSections[0].right[1]).toBe(-0.9);
});

test('walkway-network pier helper delegates to the single headless ribbon pier owner', () => {
	expect(ribbonProfile.width).toBe(ribbonDimensions.width);
	expect(ribbonProfile.depth).toBe(ribbonDimensions.depth);
	expect(ribbonProfile.columnRadius).toBe(ribbonDimensions.columnRadius);
	expect(ribbonProfile.bay).toBe(ribbonDimensions.bay);

	const ground = () => 0.5;
	const p = [2, 3, 2.4] as const;
	const headless = ribbonPierGeometry('pier/0', [...p], ground);
	const dressed = column('pier/0', [...p], ground);
	expect(headless).toHaveLength(1);
	expect(dressed).toHaveLength(1);
	const { slot, ...shape } = headless[0];
	expect(slot).toBe('bearing');
	expect(dressed[0]).toEqual({ ...pathSurfaces.bearing, ...shape });
});

test('live seed-7 sandbox corridor segments place outward anchors and enclosing footprints', () => {
	const plan = cityCorridorPlan(openingScene(7).world);
	expect(plan).toBeDefined();
	if (!plan) return;
	const { graph } = plan.plan;
	const ground = plan.ground;
	const ports = new Map(graph.ports.map((p) => [p.id, p]));
	const landings = new Set(
		graph.edges
			.filter((e) => e.kind === 'dock' && ports.get(e.to)?.groundLanding)
			.map((e) => e.from)
	);
	const checkedIds: string[] = [];

	for (const e of graph.edges) {
		if (
			e.mode !== 'walk' ||
			e.kind === 'dock' ||
			e.kind === 'junction' ||
			e.kind === 'court' ||
			e.kind === 'stair'
		)
			continue;
		const path = edgePath(e, ports);
		const sections = edgeSections(e, path);
		const variant = e.kind === 'tunnel' ? 'tunnel' : landings.has(e.to) ? 'paired' : 'supported';
		const startPort = ports.get(e.from);
		const endPort = ports.get(e.to);
		const built = buildObject('ribbon-segment', variant, 0, {
			instanceId: e.id,
			site: { sections, ground, ports: { start: startPort, end: endPort } }
		});
		checkedIds.push(e.id);

		// Preserved surveyed positions and outward normals at both endpoints.
		expect(built.anchors).toHaveLength(2);
		if (startPort) expect(built.anchors[0].position).toEqual([...startPort.position]);
		if (endPort) expect(built.anchors[1].position).toEqual([...endPort.position]);

		const startOut = unitPlanTangent(sections[1].centre, sections[0].centre);
		const endOut = unitPlanTangent(
			sections[sections.length - 2].centre,
			sections[sections.length - 1].centre
		);
		const startDot =
			built.anchors[0].normal[0] * startOut[0] + built.anchors[0].normal[1] * startOut[1];
		const endDot = built.anchors[1].normal[0] * endOut[0] + built.anchors[1].normal[1] * endOut[1];
		expect(Math.hypot(built.anchors[0].normal[0], built.anchors[0].normal[1])).toBeCloseTo(1, 10);
		expect(Math.hypot(built.anchors[1].normal[0], built.anchors[1].normal[1])).toBeCloseTo(1, 10);
		expect(startDot).toBeGreaterThan(0.5);
		expect(endDot).toBeGreaterThan(0.5);
		if (
			e.id === 'town-walk/passage/29/29/approach/1' ||
			e.id === 'town-walk/passage/29/29/descent/0'
		) {
			// Reversing the real surveyed edge must keep both anchor normals pointing outward.
			const revSections = [...sections]
				.reverse()
				.map(({ centre, left, right }) => ({ centre, left: right, right: left }));
			const rev = buildObject('ribbon-segment', variant, 0, {
				instanceId: e.id + '/reversed',
				site: { sections: revSections, ground, ports: { start: endPort, end: startPort } }
			});
			const revStartOut = unitPlanTangent(revSections[1].centre, revSections[0].centre);
			const revEndOut = unitPlanTangent(
				revSections[revSections.length - 2].centre,
				revSections[revSections.length - 1].centre
			);
			expect(
				rev.anchors[0].normal[0] * revStartOut[0] + rev.anchors[0].normal[1] * revStartOut[1]
			).toBeGreaterThan(0.5);
			expect(
				rev.anchors[1].normal[0] * revEndOut[0] + rev.anchors[1].normal[1] * revEndOut[1]
			).toBeGreaterThan(0.5);
		}

		// Footprint encloses all emitted deck mesh points and pier cylinders.
		let minX = Infinity,
			maxX = -Infinity,
			minY = Infinity,
			maxY = -Infinity;
		for (const part of built.geometry) {
			if (part.kind === 'mesh') {
				for (const [x, y] of part.points) {
					minX = Math.min(minX, x);
					maxX = Math.max(maxX, x);
					minY = Math.min(minY, y);
					maxY = Math.max(maxY, y);
				}
			} else if (part.kind === 'cylinder') {
				minX = Math.min(minX, part.position[0] - part.radius);
				maxX = Math.max(maxX, part.position[0] + part.radius);
				minY = Math.min(minY, part.position[1] - part.radius);
				maxY = Math.max(maxY, part.position[1] + part.radius);
			}
		}
		expect(built.footprint[0]).toBeCloseTo(maxX - minX, 10);
		expect(built.footprint[1]).toBeCloseTo(maxY - minY, 10);
	}

	expect(checkedIds).toContain('town-walk/passage/29/29/approach/1');
	expect(checkedIds).toContain('town-walk/passage/29/29/descent/0');
	expect(checkedIds.length).toBeGreaterThanOrEqual(20);
});
