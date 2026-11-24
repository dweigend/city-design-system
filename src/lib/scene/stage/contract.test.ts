import { expect, test } from 'bun:test';
import {
	BufferGeometry,
	Color,
	Float32BufferAttribute,
	Group,
	Mesh,
	MeshBasicMaterial,
	Object3D
} from 'three/webgpu';
import { dotProduct, displacement, type Vec3 } from '../../core/geometry';
import type { Drawable } from '../surface';
import {
	Stage,
	projectFocus,
	stageExample,
	stageNavigation,
	type Display,
	type View,
	type ViewFit
} from './index';
import {
	anchoredPan,
	cameraFrame,
	fitCamera,
	groundAt,
	readView,
	type CameraFrame
} from './camera';
import { createContent, detachChildren, hasSameGeometry, rayHit } from './content';
import { strokeMaterials } from './edges';
import { chunkKey } from './batch';
import { projectPart, segmentData } from './part';
import { createRows } from './rows';
import { drawingPalette } from './tone';

function contentOf() {
	return { content: createContent(strokeMaterials(true), drawingPalette(), true) };
}
import { edgeGeometry } from './edges';
import { shapeArrays } from './geometry';
import { shadowPolygon } from './ground';
import { readDisplay } from './material';
import { stageState } from './state';

test('frames the same metric bounds in iso, plan and a portrait viewport', () => {
	const { bounds } = stageExample();
	const wide = fitCamera('iso', bounds, 2);
	const narrow = fitCamera('iso', bounds, 0.4);
	const plan = fitCamera('plan', bounds, 2);
	expect(wide.center).toEqual([0, 0, 2.3]);
	expect(narrow.center).toEqual(wide.center);
	expect(narrow.halfHeight).toBeGreaterThan(wide.halfHeight);
	expect(wide.eye[0]).toBeGreaterThan(0);
	expect(wide.eye[1]).toBeLessThan(0);
	expect(wide.eye[2]).toBeGreaterThan(wide.center[2]);
	expect(plan.up).toEqual([0, 1, 0]);
	expect(displacement(plan.center, plan.eye).slice(0, 2)).toEqual([0, 0]);
	expect(plan.halfHeight).toBeGreaterThan(1.5);
	for (const [x, y] of shadowPolygon(bounds)) {
		expect(Math.abs(x - plan.center[0])).toBeLessThan(plan.halfWidth);
		expect(Math.abs(y - plan.center[1])).toBeLessThan(plan.halfHeight);
	}
	expect(dotProduct(readView('iso').eye, readView('iso').eye)).toBeCloseTo(1);
});

test('fits every corner of kilometer-scale bounds in both landscape views', () => {
	const bounds = { min: [-1000, -1000, -3], max: [1000, 1000, 20] } as const;
	for (const view of ['iso', 'plan'] as const) {
		const camera = fitCamera(view, bounds, 16 / 9, true, {
			bearing: 0.384,
			elevation: 0.75,
			fill: 0.96
		});
		const depth = Math.hypot(...displacement(camera.center, camera.eye));
		expect(camera.halfWidth).toBeGreaterThan(1000);
		expect(camera.halfHeight).toBeGreaterThan(view === 'plan' ? 1000 : 820);
		expect(camera.near).toBeGreaterThan(0);
		expect(camera.near).toBeLessThan(depth);
		expect(camera.far).toBeGreaterThan(depth);
	}
});

test('zooms about the same orthographic center without changing bearing or elevation', () => {
	const { bounds } = stageExample();
	const regular = fitCamera('iso', bounds, 16 / 9, true);
	const zoomed = fitCamera('iso', bounds, 16 / 9, true, { zoom: 1.27 });
	expect(zoomed.center).toEqual(regular.center);
	expect(zoomed.eye).toEqual(regular.eye);
	expect(zoomed.halfWidth * 1.27).toBeCloseTo(regular.halfWidth);
	expect(zoomed.halfHeight * 1.27).toBeCloseTo(regular.halfHeight);
});

test('tilts the camera at close metric framing without moving the frame center', () => {
	const bounds = { min: [-2000, -1000, 0], max: [2000, 1000, 200] } as const;
	const fit = {
		width: 2000,
		elevation: 1,
		elevationAtWidth: (width: number) => (width <= 500 ? 0.3 : 1)
	};
	const overview = fitCamera('iso', bounds, 16 / 9, false, fit);
	const quarter = fitCamera('iso', bounds, 16 / 9, false, { ...fit, zoom: 4 });
	expect(quarter.center).toEqual(overview.center);
	expect(quarter.halfWidth).toBe(250);
	expect(quarter.eye[2] - quarter.center[2]).toBeLessThan(overview.eye[2] - overview.center[2]);
});

test('frames a focus box while retaining depth coverage for its surroundings', () => {
	const scene = { min: [-400, -200, -10], max: [400, 200, 130] } as const;
	const focus = { min: [120, -80, 0], max: [280, 80, 90] } as const;
	const { center, eye, near, far, halfWidth } = fitCamera('plan', scene, 2, true, { focus });
	expect(center).toEqual([200, 0, 45]);
	expect(halfWidth).toBeLessThan(fitCamera('plan', scene, 2, true).halfWidth);
	expect(eye[2] - near).toBeGreaterThan(scene.max[2]);
	expect(eye[2] - far).toBeLessThan(scene.min[2]);
});

test('builds a rotated box, triangulates both prism windings and preserves indexed meshes', () => {
	const box = shapeArrays({
		kind: 'box',
		center: [2, 3, 1],
		size: [4, 2, 2],
		rotation: Math.PI / 2
	});
	expect(box.positions).toHaveLength(24);
	expect(box.positions[0]).toBeCloseTo(3);
	expect(box.positions[1]).toBeCloseTo(1);
	expect(box.indices).toHaveLength(36);
	const triangle = [
		[0, 0],
		[2, 0],
		[0, 1]
	] as const;
	const prism = { kind: 'prism', polygon: triangle, base: 2, top: 3 } as const;
	expect(shapeArrays(prism)).toEqual(shapeArrays({ ...prism, polygon: [...triangle].reverse() }));
	expect(shapeArrays({ ...prism, polygon: [...triangle, triangle[0]] })).toEqual(
		shapeArrays(prism)
	);
	expect(shapeArrays(prism).indices).toHaveLength(24);
	expect(shapeArrays({ ...prism, top: prism.base }).indices).toHaveLength(3);

	const { shape } = stageExample().drawables[2];
	if (shape.kind !== 'mesh') throw new Error('Expected a mesh fixture');
	expect(shapeArrays(shape)).toEqual({ positions: shape.positions, indices: shape.indices });
});

test('applies one translucent paper treatment to every fill and preserves line-only parts', () => {
	const normal = readDisplay('normal');
	const transparency = readDisplay('transparency');
	const hull = 0.3;
	expect(normal('matte', hull).opacity).toBe(1);
	expect(normal('glass', hull).opacity).toBeLessThan(1);
	expect(normal('line', hull).opacity).toBe(0);
	expect(transparency('line', hull).opacity).toBe(0);
	expect(transparency('glass', hull)).toEqual(transparency('matte', hull));
	expect(transparency('gloss', hull)).toEqual(transparency('matte', hull));
	expect(transparency('matte', hull)).toEqual({ opacity: hull, paper: true });
});

test('rejects unknown view and display IDs, including inherited names', () => {
	const state = stageState(true, 'Test adapter');
	expect(() => state.setView('terrain' as View)).toThrow(RangeError);
	expect(() => readView('toString' as View)).toThrow(RangeError);
	expect(() => state.setDisplay('wireframe' as Display)).toThrow(RangeError);
});

test('replaces the drawable count and counts builds only on show', () => {
	const state = stageState(true, 'Test adapter');
	const { drawables } = stageExample();
	state.show(drawables, drawables.length);
	const before = state.read();
	state.setView('plan');
	state.setDisplay('transparency');
	expect(state.read()).toEqual({ ...before, view: 'plan', display: 'transparency' });
	state.show(drawables.slice(0, 1), 0);
	expect(state.read()).toMatchObject({ drawableCount: 1, geometryBuildCount: 6 });
	state.show([], 0);
	expect(state.read()).toMatchObject({ drawableCount: 0, geometryBuildCount: 6 });
	expect(before).toMatchObject({
		drawableCount: 6,
		geometryBuildCount: 6,
		geometryBatchCount: 1,
		view: 'iso'
	});
	expect(state.read().geometryBatchCount).toBe(1);
});

test('reports a missing WebGPU adapter through the public entry', async () => {
	await expect(Stage.create({ canvas: {} as HTMLCanvasElement })).rejects.toThrow(
		/WebGPU stage initialisation failed/
	);
});

test('retains geometry for the same ordered IDs and shape references', () => {
	const { drawables, newDrawables } = stageExample();
	const parts = drawables.map((drawable) => ({ drawable }));
	expect(hasSameGeometry(parts, newDrawables)).toBe(true);
	expect(
		hasSameGeometry(
			parts,
			drawables.map((drawable) => ({ ...drawable, visible: false }))
		)
	).toBe(true);
	expect(hasSameGeometry(parts, [...newDrawables].reverse())).toBe(false);
	expect(hasSameGeometry(parts, newDrawables.slice(1))).toBe(false);
	expect(hasSameGeometry(parts, structuredClone(newDrawables))).toBe(false);
});

test('keeps the gable ridge and drops the coplanar roof triangle seams', () => {
	const { positions, indices } = shapeArrays(stageExample().drawables[2].shape);
	const edges = edgeGeometry(positions, indices);
	expect(edges.instanceCount).toBe(9);
	expect(edges.attributes.edgeFront.count).toBe(9);
	edges.dispose();
});

test('casts the bounds outline 60 percent of its height away from the sun', () => {
	const { bounds } = stageExample();
	const projected = shadowPolygon(bounds);
	const corner = projected[3];
	const offset = Math.hypot(corner[0] - bounds.max[0], corner[1] - bounds.max[1]);
	expect(offset).toBeCloseTo(2.76);
	expect(projected.every((point) => point[2] === projected[0][2])).toBe(true);
});

test('keeps the world point under the wheel and releases its listener on deletion', () => {
	const target = Object.assign(new EventTarget(), {
		getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 200 })
	});
	let fit: ViewFit | undefined;
	const navigation = stageNavigation(
		target as unknown as HTMLCanvasElement,
		() => 2,
		(next) => {
			fit = next;
		}
	);
	const wheel = () =>
		Object.assign(new Event('wheel', { cancelable: true }), {
			clientX: 150,
			clientY: 100,
			deltaMode: 0,
			deltaY: -Math.log(2) / 0.0017
		});
	target.dispatchEvent(wheel());
	expect(fit?.zoom).toBeCloseTo(2);
	expect(fit?.offset?.[0]).toBeCloseTo(50);
	expect(fit?.offset?.[1]).toBeCloseTo(0);
	navigation.reset();
	expect(fit).toEqual({});
	navigation.delete();
	target.dispatchEvent(wheel());
	expect(fit).toEqual({});
	expect(projectFocus('iso', {}, [])).toBeUndefined();
});

test('keeps the ground point under the cursor when a zoom also lowers the camera', () => {
	// A 1,000 × 800 canvas zooms from a 2,400 m to a 1,200 m span; the camera pitch follows the span.
	const bounds = { min: [-1500, -1000, 0], max: [1500, 1000, 40] } as const;
	const base: ViewFit = {
		width: 2400,
		bearing: -0.42,
		elevationAtWidth: (width) =>
			((18 + 44 * Math.min(1, Math.max(0, (width - 500) / 1800))) * Math.PI) / 180
	};
	const frameOf = (value: Readonly<{ zoom: number; offset: readonly [number, number] }>) =>
		cameraFrame(fitCamera('iso', bounds, 1000 / 800, true, { ...base, ...value }), 1000);
	const target = Object.assign(new EventTarget(), {
		getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 800 })
	});
	let fit: ViewFit = {};
	stageNavigation(
		target as unknown as HTMLCanvasElement,
		() => 2.4,
		(next) => (fit = next),
		frameOf
	);
	const anchor = groundAt(frameOf({ zoom: 1, offset: [0, 0] }), [0, 100]);
	target.dispatchEvent(
		Object.assign(new Event('wheel', { cancelable: true }), {
			clientX: 500,
			clientY: 500,
			deltaMode: 0,
			deltaY: -Math.log(2) / 0.0017
		})
	);
	const after = frameOf({
		zoom: fit.zoom ?? 1,
		offset: [fit.offset?.[0] ?? 0, fit.offset?.[1] ?? 0]
	});
	expect(fit.zoom).toBeCloseTo(2);
	// The anchor projects back to the cursor pixel: no residual pan is needed.
	const [dx, dy] = anchoredPan(after, anchor, [0, 100]);
	expect(Math.abs(dx / after.metersPerPixel)).toBeLessThan(0.01);
	expect(Math.abs(dy / after.metersPerPixel)).toBeLessThan(0.01);
	// The earlier image-plane rule, offset −(100 px × 2.4 m) + 100 px × 1.2 m, drifts by many pixels.
	const naive = frameOf({ zoom: 2, offset: [0, -100 * 2.4 + 100 * 1.2] });
	const [, drift] = anchoredPan(naive, anchor, [0, 100]);
	expect(Math.abs(drift / naive.metersPerPixel)).toBeGreaterThan(5);
});

test('keeps a terrain point above the frame plane under the cursor through a tilting zoom', () => {
	// At relief 1 the cursor sees ground 100 m above the plane through the frame centre.
	const bounds = { min: [-1500, -1000, 0], max: [1500, 1000, 200] } as const;
	const base: ViewFit = {
		width: 2400,
		bearing: -0.42,
		elevationAtWidth: (width) =>
			((18 + 44 * Math.min(1, Math.max(0, (width - 500) / 1800))) * Math.PI) / 180
	};
	const raised = new Mesh(
		new BufferGeometry()
			.setAttribute(
				'position',
				new Float32BufferAttribute(
					[-5000, -5000, 200, 5000, -5000, 200, 5000, 5000, 200, -5000, 5000, 200],
					3
				)
			)
			.setIndex([0, 1, 2, 0, 2, 3]),
		new MeshBasicMaterial()
	);
	const planeOf = (value: Readonly<{ zoom: number; offset: readonly [number, number] }>) =>
		cameraFrame(fitCamera('iso', bounds, 1000 / 800, true, { ...base, ...value }), 1000);
	const frameOf = (value: Readonly<{ zoom: number; offset: readonly [number, number] }>) => ({
		...planeOf(value),
		hit: (point: Vec3, direction: Vec3) => rayHit([raised], point, direction)
	});
	const drift = (frames: (value: Parameters<typeof frameOf>[0]) => CameraFrame) => {
		const target = Object.assign(new EventTarget(), {
			getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 800 })
		});
		let fit: ViewFit = {};
		stageNavigation(
			target as unknown as HTMLCanvasElement,
			() => 2.4,
			(next) => (fit = next),
			frames
		);
		const anchor = groundAt(frameOf({ zoom: 1, offset: [0, 0] }), [0, 100]);
		expect(anchor[2]).toBeCloseTo(200, 6);
		target.dispatchEvent(
			Object.assign(new Event('wheel', { cancelable: true }), {
				clientX: 500,
				clientY: 500,
				deltaMode: 0,
				deltaY: -Math.log(2) / 0.0017
			})
		);
		const after = frameOf({
			zoom: fit.zoom ?? 1,
			offset: [fit.offset?.[0] ?? 0, fit.offset?.[1] ?? 0]
		});
		const [dx, dy] = anchoredPan(after, anchor, [0, 100]);
		return Math.hypot(dx, dy) / after.metersPerPixel;
	};
	expect(drift(frameOf)).toBeLessThan(0.01);
	// Anchoring on the centre plane instead lets the raised ground slide away from the cursor.
	expect(drift(planeOf)).toBeGreaterThan(5);
});

test('moves warped fills with their normals and bounds', () => {
	const { content } = contentOf();
	const warp = { fill: [0, 0, 0, 0, 1, 0], amount: 0 };
	const wall: Drawable = {
		id: 'wall',
		color: '--paper',
		finish: 'matte',
		shape: { kind: 'mesh', positions: [0, 0, 0, 0, 1, 0, 0, 0, 1], indices: [0, 1, 2] },
		warp
	};
	content.show([wall]);
	content.style([{ ...wall, warp: { ...warp, amount: 1 } }]);
	const [part] = content.parts;
	expect(content.clippingBounds.max[0]).toBeCloseTo(1);
	if (!part.fill) throw new Error('Expected a dedicated warped fill');
	const geometry = part.fill.mesh.geometry;
	expect(geometry.boundingBox?.max.x).toBeCloseTo(1);
	const normal = geometry.getAttribute('normal');
	expect(Math.abs(normal.getX(0))).toBeLessThan(0.99);
	expect(Math.abs(normal.getZ(0))).toBeGreaterThan(0.5);
	content.delete();
});

const ink = new Color();
function appearance({ vertical, fillAlpha, visible, occlude }: Drawable) {
	const scale = vertical?.scale ?? 1;
	return {
		color: ink,
		strokeColor: ink,
		opacity: visible === false ? 0 : (fillAlpha ?? 1),
		strokeOpacity: 1,
		width: 1,
		hidden: 0,
		recede: 0,
		visible: visible !== false,
		veil:
			occlude === true &&
			visible !== false &&
			fillAlpha !== undefined &&
			fillAlpha > 0 &&
			fillAlpha < 1,
		scale,
		offset: (vertical?.pivot ?? 0) * (1 - scale)
	};
}

function boxAt(id: string, x: number): Drawable {
	return {
		id,
		color: '--paper',
		finish: 'matte',
		creaseAngleRad: 0,
		shape: { kind: 'box', center: [x, 0, 1], size: [2, 2, 2], rotation: 0 }
	};
}

test('one edit repacks only its tile and retains the terrain and its hit surface', () => {
	const { content } = contentOf();
	const terrain = { ...boxAt('terrain', 0), finish: 'terrain' } as const;
	const left = boxAt('left', 10);
	const right = boxAt('right', 400);
	content.show([terrain, left, right]);
	content.update(appearance, true);
	const [oldTerrain] = content.parts;
	const oldChunks = content.group.children.filter((child) => child instanceof Group);
	const before = content.chunkBuilds;
	expect(content.show([terrain, boxAt('edited', 12), right])).toBe(1);
	content.update(appearance, false);
	expect(content.chunkBuilds - before).toBe(1);
	expect(content.group.children.filter((child) => child instanceof Group)).toHaveLength(
		oldChunks.length
	);
	for (const chunk of oldChunks) expect(chunk.parent).toBe(content.group);
	expect(content.parts[0]).toBe(oldTerrain);
	expect(content.hit([0, 0, 0], [0, 0, -1])).toEqual([0, 0, 2]);
	content.delete();
});

test('moving to sorted alpha and back retains the geometry and tile build count', () => {
	const { content } = contentOf();
	const part = boxAt('body', 4);
	content.show([part]);
	content.update(appearance, true);
	const before = content.chunkBuilds;
	const chunk = content.group.children.find((child) =>
		child.children.some((object) => object instanceof Mesh)
	);
	if (!chunk) throw new Error('Expected a packed tile');
	const [opaque] = chunk.children;
	const triangleBuffer = (opaque as Mesh).geometry.index;
	expect(content.show([{ ...part, fillAlpha: 0.5 }])).toBe(0);
	content.update(appearance, true);
	const alpha = chunk.children.find(
		(object) =>
			object.visible &&
			object instanceof Mesh &&
			object.material.transparent &&
			object.geometry.index === triangleBuffer
	);
	expect(alpha).toBeDefined();
	expect((alpha as Mesh).geometry.index).toBe(triangleBuffer);
	expect(content.show([part])).toBe(0);
	content.update(appearance, true);
	expect(content.chunkBuilds).toBe(before);
	expect(alpha?.visible).toBe(false);
	content.delete();
});

test('warped and vertically scaled terrain is picked at its displayed height', () => {
	const { content } = contentOf();
	const body = boxAt('body', 4);
	const warp = { fill: [4, 0, 4, 0, 4, 0], amount: 0 };
	const terrain: Drawable = {
		id: 'terrain',
		color: '--paper',
		finish: 'terrain',
		shape: { kind: 'mesh', positions: [-1, -1, 2, 1, -1, 2, 0, 1, 2], indices: [0, 1, 2] },
		warp
	};
	content.show([terrain, body]);
	content.update(appearance, true);
	const before = content.chunkBuilds;
	expect(content.hit([4, 0, 0], [0, 0, -1])).toBeUndefined();
	content.style([
		{ ...terrain, warp: { ...warp, amount: 1 }, vertical: { scale: 3, pivot: 1 } },
		body
	]);
	expect(content.clippingBounds.max[2]).toBe(4);
	content.update(appearance, false);
	expect(content.hit([4, 0, 0], [0, 0, -1])).toEqual([4, 0, 4]);
	expect(content.chunkBuilds).toBe(before);
	content.delete();
});

test('detaches large child lists and closes repeatedly without spreading them into remove', () => {
	for (let run = 0; run < 2; run++) {
		const { content } = contentOf();
		const children = Array.from({ length: 130_000 }, () => new Object3D());
		content.group.children = children;
		for (const child of children) child.parent = content.group;
		const last = children.at(-1);
		detachChildren(content.group);
		expect(last?.parent).toBeNull();
		expect(content.group.children).toHaveLength(0);
		content.delete();
	}
});

test('extracts the same strokes from touching bodies when their crease groups are merged', () => {
	const left = boxAt('left', -1);
	const right = boxAt('right', 1);
	const a = shapeArrays(left.shape);
	const b = shapeArrays(right.shape);
	const project = (part: Drawable) =>
		projectPart(part, strokeMaterials(true), drawingPalette(), true);
	const merged = project({
		...left,
		creaseGroups: [a.indices.length, a.indices.length + b.indices.length],
		shape: {
			kind: 'mesh',
			positions: [...a.positions, ...b.positions],
			indices: [...a.indices, ...b.indices.map((i) => i + a.positions.length / 3)]
		}
	});
	const sources = [project(left), project(right)];
	for (const key of ['segments', 'fronts', 'backs'] as const)
		expect(merged.sources[0].edges[key]).toEqual(
			sources.flatMap(({ sources }) => sources[0].edges[key])
		);
});

test('style rows retain earlier data through growth and recycle released indices', () => {
	const rows = createRows();
	const part = boxAt('body', 1);
	const first = rows.allocate();
	rows.write(first, part, { ...appearance(part), opacity: 0.5 });
	const before = rows.buffer.value;
	const snapshot = [...before.array.slice(0, 20)];
	const second = rows.allocate();
	expect(rows.buffer.value).not.toBe(before);
	const hidden = { ...part, visible: false };
	rows.write(second, hidden, appearance(hidden));
	expect([...rows.buffer.value.array.slice(0, 20)]).toEqual(snapshot);
	expect(rows.buffer.value.array[23]).toBe(0);
	expect(rows.buffer.value.array[39]).toBe(0);
	rows.release(second);
	expect(rows.allocate()).toBe(second);
	rows.write(second, part, appearance(part));
	expect(rows.buffer.value.array[39]).toBe(1);
	expect([...rows.buffer.value.array.slice(0, 20)]).toEqual(snapshot);
	rows.delete();
});

test('a mixed tile retains the visible stroke pass and disposes a removed veil independently', () => {
	const { content } = contentOf();
	const tinted = { ...boxAt('tinted', 5), fillAlpha: 0.5, occlude: true };
	const hidden = { ...boxAt('hidden', 10), visible: false };
	content.show([tinted, hidden]);
	content.update(appearance, true);
	const tile = content.parts[0].chunk?.group;
	if (!tile) throw new Error('Expected a packed tile');
	const passes = tile.children.slice();
	const veil = passes.find((child) => child.renderOrder === 6);
	if (!(veil instanceof Mesh)) throw new Error('Expected a depth-only mesh');
	expect(
		passes.filter((child) => [2, 3].includes(child.renderOrder) && child.visible)
	).toHaveLength(2);
	let released = 0;
	veil.addEventListener('dispose', () => released++);
	const builds = content.chunkBuilds;
	content.style([{ ...tinted, occlude: false }, hidden]);
	content.update(appearance, false);
	expect(released).toBe(1);
	expect(veil.parent).toBeNull();
	expect(content.chunkBuilds).toBe(builds);
	for (const child of tile.children) child.addEventListener('dispose', () => released++);
	content.show([tinted, boxAt('changed', 11)]);
	content.update(appearance, false);
	expect(released).toBe(passes.length);
	content.delete();
});

test('removing a veil from an individually drawn surface releases it and keeps the fill', () => {
	const { content } = contentOf();
	const terrain = {
		...boxAt('terrain', 0),
		finish: 'terrain',
		fillAlpha: 0.5,
		occlude: true
	} as const;
	content.show([terrain]);
	content.update(appearance, true);
	const fill = content.parts[0].fill;
	const veil = fill?.veil;
	if (!fill || !veil) throw new Error('Expected a depth-only terrain veil');
	let released = 0;
	veil.addEventListener('dispose', () => released++);
	content.style([{ ...terrain, occlude: false }]);
	content.update(appearance, false);
	expect(released).toBe(1);
	expect(veil.parent).toBeNull();
	expect(content.parts[0].fill).toBe(fill);
	expect(fill.veil).toBeUndefined();
	content.delete();
});

test.each([true, false])(
	'warps generated stroke endpoints with their fill (landscape %s)',
	(landscape) => {
		const content = createContent(strokeMaterials(landscape), drawingPalette(), landscape);
		const shape = {
			kind: 'mesh',
			positions: [0, 0, 0, 0, 1, 0, 0, 0, 1],
			indices: [0, 1, 2]
		} as const;
		const warp = { fill: [4, 0, 1, 2, -1, 0], amount: 0 };
		const part = { ...boxAt('wall', 0), shape, warp };
		content.show([part]);
		const { fill, individual } = content.parts[0];
		if (!fill) throw new Error('Expected a dedicated warped fill');
		const data = segmentData(individual[0].line.geometry);
		content.style([{ ...part, warp: { ...warp, amount: 1 } }]);
		const positions = [...fill.mesh.geometry.attributes.position.array];
		expect([...data.array]).toEqual([
			...positions.slice(0, 6),
			...positions.slice(3, 9),
			...positions.slice(6, 9),
			...positions.slice(0, 3)
		]);
		content.delete();
	}
);

test('routes wide stroke-only overlays to the background and local strokes by their midpoint', () => {
	const line = {
		...boxAt('outline', 0),
		shape: { kind: 'mesh', positions: [], indices: [] },
		finish: 'line'
	} as const;
	const tile = (strokeSegments: number[]) =>
		chunkKey(projectPart({ ...line, strokeSegments }, strokeMaterials(), drawingPalette(), true));
	expect(tile([10, 20, 0, 410, 20, 0])).toBe('background');
	expect(tile([180, 20, 0, 220, 20, 0])).toBe('1/0');
});
