import { loadStructureModules } from './fixtures/structure-modules';
import { forms } from './fixtures/primitive-forms';
import { expect, test } from 'bun:test';
import { Mesh, SphereGeometry, type Group, type Material } from 'three/webgpu';
import { BLICK, MASSSTAB, STRICHE } from '../../data/leitstil';
import { translate } from '../../logic/ansicht/geometrie';
import { pruefeStil, stilFuer } from '../../logic/leitstil';
import { tag } from '../../logic/ansicht/tags';
import { forestChunk } from '../../logic/land-cover';
import { explode, shiftZ, type Primitive } from '../../logic/parametrik/types';
import { focuses, present } from '../../logic/presentation';
import { acceptanceScene, applyEdit, currentStacks, houseView } from '../../logic/sandbox';
import { lineParts } from '../../logic/transit-line';
import { distanceDrawing } from './distance-drawing';
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
		const style = sandboxStyle(k);
		expect(style).toEqual(stilFuer(k));
		expect(pruefeStil(style, k)).toEqual([]);
		expect(style.rollen.huelle.strichPx).toBe(STRICHE.kontur);
		expect(style.rollen.bestand.schatten).toBe(false);
	}
});

test('the fixed plate retains growing seams in 2026, two rail stops, two walkway landings and a forest', () => {
	const first = acceptanceScene();
	const { world, additions } = first;
	const stories = [...world.state.storyParts.values()].flat();
	expect(world.seed).toBe(7);
	const current = stories.filter(({ built }) => built === world.state.year);
	expect(world.state.year).toBe(2026);
	expect(world.state.storyParts.get('79/44')?.map(({ style }) => style)).toEqual([
		'collage',
		'collage'
	]);
	expect([...(world.state.frameBays?.values() ?? [])].some((b) => b.built)).toBe(true);
	expect(world.state.storyParts.get('83/44')?.at(-1)?.style).toBe('totem');
	expect(current.filter(({ style }) => style === 'collage')).toHaveLength(10);
	expect(current.filter(({ style }) => style === 'megastructure')).toHaveLength(0);
	expect(current.filter(({ style }) => style === 'totem')).toHaveLength(6);
	expect(world.lines[0].stops).toHaveLength(2);
	expect([...world.state.cover.values()].filter((kind) => kind === 'forest')).toHaveLength(9);
	expect(additions.filter((part) => /^acceptance-walkway:[05]$/.test(part.id))).toHaveLength(2);
	expect(acceptanceScene().additions).toEqual(additions);
});

test('the renderer applies role widths and switches both structural strokes', async () => {
	const [{ structureMaterials }] = await loadStructureModules();
	const finishes = structureMaterials();
	const { materials } = finishes;
	const scale = MASSSTAB.quartier;
	try {
		finishes.setStyle(sandboxStyle(context), 'primary', scale);
		expect(materials.pencil.linewidth).toBe(STRICHE.bestand);
		expect(materials.perimeter.linewidth).toBe(STRICHE.kontur);
		expect(materials.primary.linewidth).toBeCloseTo(0.18 * scale);
		expect(materials.secondary.linewidth).toBeCloseTo(0.1 * scale);
		finishes.setStyle(sandboxStyle(context), 'all', scale);
		expect(materials.primary.linewidth).toBeCloseTo(0.18 * scale);
		expect(materials.secondary.linewidth).toBe(STRICHE.minimumTraeger);
	} finally {
		finishes.dispose();
	}
});

test('distance redraws update seated pick targets and preserve an active drop', async () => {
	const [, , { createStructures }] = await loadStructureModules();
	const structures = createStructures();
	const part: Primitive = {
		id: 'near-only-detail',
		kind: 'box',
		position: [0, 0, 0],
		size: [3, 3, 3],
		role: 'neu',
		material: 'concrete',
		token: '--cat-nature',
		cityForm: false
	};
	const key = 'house:lod';
	const minimum = 'all';
	const style = (zoom: 'stadt' | 'nah') =>
		sandboxStyle({ zoom, modus: 'ansehen', situation: 'normal', thema: 'hell' });
	try {
		structures.set(key, [part], undefined, 0);
		expect(structures.step(30, false)).toBe(true);
		const offset = Math.max(...structures.group.children.map((batch) => batch.position.y));
		expect(offset).toBeGreaterThan(0);
		const near = structures.solids(key);
		expect(near.length).toBeGreaterThan(0);
		expect(near.every((target) => target.position.y === 0)).toBe(true);

		structures.setStyle([style('stadt'), minimum, 2.5], Math.PI / 2);
		expect(structures.solids(key)).toEqual([]);
		structures.setStyle([style('nah'), minimum, 40], Math.PI / 2);
		const returned = structures.solids(key);
		expect(returned.length).toBe(near.length);
		expect(returned[0]).not.toBe(near[0]);
		expect(returned.every((target) => target.position.y === 0)).toBe(true);
		expect(Math.max(...structures.group.children.map((batch) => batch.position.y))).toBe(offset);
		expect(structures.step(1000, false)).toBe(false);
	} finally {
		structures.dispose();
	}
});

function seedRoofCarrier() {
	const { world: base, earliestFullYear } = acceptanceScene();
	const world = applyEdit(base, {
		kind: 'raise',
		cellId: '82/41',
		use: 'living',
		style: 'megastructure'
	});
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
	if (moved.kind !== 'polyline') throw new Error('Expected the same carrier geometry');
	expect(moved.bearings?.[0]).toEqual(moved.points[0]);
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

test('an aged sheet keeps its geometry without using the shadow-casting envelope material', async () => {
	const [{ structureMaterials }, { populateStructures }] = await loadStructureModules();
	const finishes = structureMaterials();
	const bearing = new SphereGeometry();
	const parts = present([{ ...forms.membrane, envelope: true }], 'pencil');
	const group = populateStructures(parts, finishes, bearing);
	const meshes = group.children.filter((object) => object instanceof Mesh);
	try {
		expect(parts[0]).toMatchObject({ kind: 'membrane', role: 'bestand' });
		expect(meshes.some(({ material }) => material === finishes.materials.stockSheet)).toBe(true);
		expect(meshes.every(({ castShadow }) => !castShadow)).toBe(true);
	} finally {
		for (const mesh of meshes) mesh.geometry.dispose();
		finishes.dispose();
		bearing.dispose();
	}
});

test('the city stop retains its colored shadow caster without an outline or bearing nodes', async () => {
	const [{ structureMaterials }, { populateStructures }] = await loadStructureModules();
	const finishes = structureMaterials();
	const bearing = new SphereGeometry();
	const parts: Primitive[] = [
		{ ...forms.torus, role: 'neu', token: '--cat-business-3' },
		{ ...forms.polyline, role: 'traeger', bearings: [[0, 0, 2]] }
	];
	const drawing = distanceDrawing(parts, {
		elevation: BLICK.hoeheRad,
		block: true,
		scale: 2.5,
		minContourPx: 6
	});
	const group = populateStructures(drawing.parts, finishes, bearing, drawing);
	const meshes = group.children.filter((object) => object instanceof Mesh);
	try {
		expect(meshes.filter(({ material }) => material === finishes.materials.signal)).toHaveLength(1);
		expect(meshes.filter(({ castShadow }) => castShadow)).toHaveLength(1);
		expect(meshes.some(({ material }) => material === finishes.materials.hull)).toBe(false);
		expect(meshes.some(({ material }) => material === finishes.materials.bearing)).toBe(false);
	} finally {
		for (const mesh of meshes) mesh.geometry.dispose();
		finishes.dispose();
		bearing.dispose();
	}
});

for (const outline of [true, false])
	test('model-white ceramic remains pickable with outline ' + outline, async () => {
		const [{ structureMaterials }, { populateStructures }] = await loadStructureModules();
		const finishes = structureMaterials();
		const bearing = new SphereGeometry();
		const part: Primitive = { ...forms.mesh, material: 'glaze', token: '--paper' };
		const group = populateStructures([part], finishes, bearing, {
			unoutlined: new Set(outline ? [] : [part])
		});
		const meshes = group.children.filter((part) => part instanceof Mesh);
		try {
			const body = meshes.find((part) => part.castShadow);
			expect(body?.material).toBe(finishes.materials.glaze);
			expect(group.userData.hits).toContain(body);
			expect(meshes.some((part) => part.material === finishes.materials.ceramicHull)).toBe(outline);
		} finally {
			for (const geometry of new Set(meshes.map((mesh) => mesh.geometry))) geometry.dispose();
			finishes.dispose();
			bearing.dispose();
		}
	});
