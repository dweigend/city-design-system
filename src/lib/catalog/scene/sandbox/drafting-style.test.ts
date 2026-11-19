// @ts-expect-error Bun provides this test API at runtime; the app only includes Node types.
import { expect, test } from 'bun:test';
import { Mesh, SphereGeometry, type Group, type Material } from 'three/webgpu';
import { MASSSTAB, STRICHE } from '../../data/leitstil';
import { translate } from '../../logic/ansicht/geometrie';
import { pruefeStil, stilFuer } from '../../logic/leitstil';
import { tag } from '../../logic/ansicht/tags';
import { forestChunk } from '../../logic/land-cover';
import { explode, shiftZ, type Primitive } from '../../logic/parametrik/types';
import { focuses } from '../../logic/presentation';
import { acceptanceScene, currentStacks, houseView } from '../../logic/sandbox';
import { lineParts } from '../../logic/transit-line';
import { nearestZoom, sandboxStyle } from './drafting-style';

const context = { zoom: 'quartier', modus: 'ansehen', situation: 'normal' } as const;

test('the sandbox uses the nearest bible zoom', () => {
	expect(nearestZoom(1)).toBe('stadt');
	expect(nearestZoom(8)).toBe('quartier');
	expect(nearestZoom(20)).toBe('haus');
	expect(nearestZoom(65)).toBe('nah');
	expect(nearestZoom(MASSSTAB.quartier)).toBe(context.zoom);
});

test('the Leitstil variant passes the style contract in both themes', () => {
	for (const thema of ['hell', 'dunkel'] as const) {
		const k = { ...context, thema };
		const style = sandboxStyle(k, 'leitstil');
		expect(style).toEqual(stilFuer(k));
		expect(pruefeStil(style, k)).toEqual([]);
		expect(style.rollen.huelle.strichPx).toBe(STRICHE.kontur);
		expect(style.rollen.bestand.schatten).toBe(false);
	}
});

test('the hairline exception is limited to the structural stroke and contrast', () => {
	const normal = sandboxStyle(context, 'leitstil');
	const hairline = sandboxStyle(context, 'hairline');
	const violations = pruefeStil(hairline, context).map((entry) => entry.id);
	expect(violations.sort()).toEqual(['INV-02', 'INV-03', 'INV-09']);
	expect(hairline.rollen.traeger.strichPx).toBe(STRICHE.bestand);
	expect({ ...hairline, rollen: { ...hairline.rollen, traeger: normal.rollen.traeger } }).toEqual(
		normal
	);
});

test('the fixed plate retains three eras, two rail stops, two walkway landings and a forest', () => {
	const first = acceptanceScene();
	const { world, additions } = first;
	const stories = [...world.state.storyParts.values()].flat();
	expect(world.seed).toBe(7);
	expect(world.state.storyParts.get('79/44')?.map(({ built }) => built)).toEqual([2026, 2026]);
	expect(world.state.storyParts.get('82/41')?.at(-1)?.built).toBe(2027);
	expect(world.state.storyParts.get('83/44')?.at(-1)?.built).toBe(2028);
	expect(stories.filter(({ built }) => built === 2026)).toHaveLength(10);
	expect(stories.filter(({ built }) => built === 2028)).toHaveLength(6);
	expect(world.lines[0].stops).toHaveLength(2);
	expect([...world.state.cover.values()].filter((kind) => kind === 'forest')).toHaveLength(9);
	expect(additions.filter((part) => /^acceptance-walkway:[05]$/.test(part.id))).toHaveLength(2);
	expect(acceptanceScene().additions).toEqual(additions);
});

async function loadStructureModules() {
	// Bun loads the Leitstil entry point without compiling the theme's Svelte rune.
	const shim = !('$state' in globalThis);
	if (shim)
		Object.defineProperty(globalThis, '$state', {
			configurable: true,
			value: (value: unknown) => value
		});
	return Promise.all([import('./structure-materials'), import('./structure-parts')]).finally(() => {
		if (shim) Reflect.deleteProperty(globalThis, '$state');
	});
}

test('the renderer applies role widths and switches both structural strokes', async () => {
	const [{ structureMaterials }] = await loadStructureModules();
	const finishes = structureMaterials();
	const { materials } = finishes;
	const scale = MASSSTAB.quartier;
	try {
		finishes.setStyle(sandboxStyle(context, 'leitstil'), 'leitstil', scale);
		expect(materials.pencil.linewidth).toBe(STRICHE.bestand);
		expect(materials.perimeter.linewidth).toBe(STRICHE.kontur);
		expect(materials.primary.linewidth).toBeCloseTo(0.18 * scale);
		expect(materials.secondary.linewidth).toBe(STRICHE.detail);
		finishes.setStyle(sandboxStyle(context, 'hairline'), 'hairline', scale);
		expect(materials.primary.linewidth).toBe(STRICHE.bestand);
		expect(materials.secondary.linewidth).toBe(STRICHE.bestand);
	} finally {
		finishes.dispose();
	}
});

function seedRoofCarrier() {
	const { world, earliestFullYear } = acceptanceScene();
	const chunk = world.grid.cellsById.get('82/41')?.chunk;
	if (!chunk) throw new Error('Expected the roof carrier anchor');
	const parts = houseView(world, currentStacks(world.state), chunk, focuses.all, earliestFullYear);
	return parts.filter((part) => part.id.startsWith('82/41@1:span/') && part.role === 'traeger');
}

test('the seed-7 roof carrier is in the bible frame layer', () => {
	const frame = seedRoofCarrier();
	expect(frame.filter(({ id }) => id.includes('/bent/'))).toHaveLength(3);
	expect(frame.map(({ id }) => id)).toContain('82/41@1:span/upper');
	expect(frame.map(({ id }) => id)).toContain('82/41@1:span/lower');
	for (const part of frame) expect(tag(part)).toMatchObject({ schicht: 'geruest', phase: 1 });
});

function seedCarrierBent() {
	const bent = seedRoofCarrier().find((part) => part.id === '82/41@1:span/bent/82/40');
	if (bent?.kind !== 'polyline') throw new Error('Expected the carrier bent over roof 82/40');
	return bent;
}

test('a vertical shift keeps the seed-7 bearing on its carrier', () => {
	const bent = seedCarrierBent();
	const raised = shiftZ(bent, 4);
	if (raised.kind !== 'polyline') throw new Error('Expected the same carrier geometry');
	expect(bent.bearings).toEqual([bent.points[0]]);
	expect(bent.bearings?.[0][2]).toBe(10.5);
	expect(raised.bearings).toEqual([raised.points[0]]);
	expect(raised.bearings?.[0][2]).toBe(14.5);
	expect(shiftZ(bent, 0)).toBe(bent);
});

test('translation moves the seed-7 bearing in all three axes', () => {
	const bent = seedCarrierBent();
	const moved = translate(bent, [2, -3, 4]);
	const [x, y, z] = bent.points[0];
	expect(moved).toMatchObject({ bearings: [[x + 2, y - 3, z + 4]] });
	expect(moved.kind === 'polyline' && moved.points[0]).toEqual(moved.bearings?.[0]);
	expect(bent.bearings).toEqual([bent.points[0]]);
});

test('explosion raises the carrier bearing by its rank', () => {
	const bent = seedCarrierBent();
	const [x, y, z] = bent.points[0];
	expect(explode([{ ...bent, rank: 2 }], 3)[0].bearings).toEqual([[x, y, z + 6]]);
});

test('the seed-7 rail pillars and station shafts are in the bible frame layer', () => {
	const [line] = acceptanceScene().world.lines;
	const parts = lineParts(line);
	const supports = parts.filter(({ id }) => id.includes('/pillar/') || id.endsWith('/shaft'));
	expect(supports).toHaveLength(6);
	for (const part of supports) expect(tag(part)).toMatchObject({ schicht: 'geruest', phase: 1 });
	expect(tag(parts[0]).schicht).toBe('netz');
});

const base = { role: 'neu', token: '--cat-nature', material: 'wood', edges: false } as const;
const origin = [0, 0, 2] as const;
const forms = {
	box: { ...base, id: 'box', kind: 'box', position: [...origin], size: [2, 2, 2] },
	prism: {
		...base,
		id: 'prism',
		kind: 'prism',
		polygon: [
			[0, 0],
			[2, 0],
			[0, 2]
		],
		z: 2,
		height: 2
	},
	wedge: { ...base, id: 'wedge', kind: 'wedge', position: [...origin], size: [2, 2, 2] },
	cylinder: {
		...base,
		id: 'cylinder',
		kind: 'cylinder',
		position: [...origin],
		radius: 1,
		height: 2
	},
	cone: { ...base, id: 'cone', kind: 'cone', position: [...origin], radius: 1, height: 2 },
	sphere: { ...base, id: 'sphere', kind: 'sphere', position: [...origin], radius: 1 },
	dome: { ...base, id: 'dome', kind: 'dome', position: [...origin], radius: 1 },
	ring: {
		...base,
		id: 'ring',
		kind: 'ring',
		position: [...origin],
		radius: 1,
		innerRadius: 0.5,
		depth: 0.2
	},
	torus: { ...base, id: 'torus', kind: 'torus', position: [...origin], radius: 1, tube: 0.2 },
	capsule: {
		...base,
		id: 'capsule',
		kind: 'capsule',
		from: [...origin],
		to: [0, 2, 2],
		radius: 0.5
	},
	pipe: { ...base, id: 'pipe', kind: 'pipe', points: [[...origin], [0, 2, 2]], radius: 0.3 },
	polyline: { ...base, id: 'polyline', kind: 'polyline', points: [[...origin], [0, 2, 2]] },
	arch: { ...base, id: 'arch', kind: 'arch', position: [...origin], width: 2, length: 2, rise: 1 },
	vault: {
		...base,
		id: 'vault',
		kind: 'vault',
		position: [...origin],
		width: 2,
		length: 2,
		rise: 1
	},
	halfpipe: {
		...base,
		id: 'halfpipe',
		kind: 'halfpipe',
		position: [...origin],
		width: 2,
		length: 2,
		rise: 1
	},
	frame: {
		...base,
		id: 'frame',
		kind: 'frame',
		position: [...origin],
		size: [2, 2, 2],
		cells: [1, 1, 1],
		bar: 0.1
	},
	helix: {
		...base,
		id: 'helix',
		kind: 'helix',
		position: [...origin],
		radius: 1,
		innerRadius: 0.2,
		height: 3,
		turns: 1,
		thickness: 0.2
	},
	membrane: {
		...base,
		id: 'membrane',
		kind: 'membrane',
		corners: [[...origin], [2, 0, 2], [2, 2, 3], [0, 2, 2]]
	}
} satisfies Record<Primitive['kind'], Primitive>;

function expectFormContour(part: Primitive, group: Group, hulls: Material[]) {
	const meshes = group.children.filter((object) => object instanceof Mesh);
	const casters = meshes.filter((mesh) => mesh.castShadow);
	const contours = meshes.filter((mesh) => hulls.some((hull) => hull === mesh.material));
	const count = part.kind === 'frame' || part.kind === 'polyline' ? 0 : 1;
	try {
		expect(casters, part.id).toHaveLength(count);
		expect(contours, part.id).toHaveLength(count);
		expect(contours[0]?.geometry.getAttribute('position').array, part.id).toEqual(
			casters[0]?.geometry.getAttribute('position').array
		);
	} finally {
		for (const mesh of meshes) mesh.geometry.dispose();
	}
}

test('every shadow-casting form has a Leitstil contour in paper and in color', async () => {
	const [{ structureMaterials }, { populateStructures }] = await loadStructureModules();
	const finishes = structureMaterials();
	const bearing = new SphereGeometry();
	try {
		const { world } = acceptanceScene();
		const chunk = world.grid.cellsById.get('103/42')?.chunk ?? '';
		const spiral = forestChunk(world.grid, world.state.cover, chunk, world.seed).find(
			(part) => part.id === '103/42:tree0'
		);
		if (spiral?.kind !== 'helix') throw new Error('Expected the seed-7 spiral crown');
		const samples: Primitive[] = [
			...Object.values(forms).flatMap((part) => [part, { ...part, token: '--paper' as const }]),
			spiral,
			{ ...forms.membrane, sag: 0.5 },
			{ ...forms.ring, glass: true }
		];
		const hulls = [finishes.materials.hull, finishes.materials.sheetHull];
		for (const part of samples)
			expectFormContour(part, populateStructures([part], finishes, bearing), hulls);
	} finally {
		finishes.dispose();
		bearing.dispose();
	}
});
