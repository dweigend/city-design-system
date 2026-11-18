/**
 * Stage of the sandbox: one renderer per canvas, the view, light, the terrain and everything
 * built on it. Owns every GPU resource it creates (A-52) and renders on demand. The stage
 * projects sandbox worlds; it never changes them (PP-2).
 */
import * as THREE from 'three/webgpu';
import { LineSegments2 } from 'three/examples/jsm/lines/webgpu/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import type { Palette3D } from '../../data/city3d';
import { bindSceneTheme } from '../themeBinding';
import type { Vec3 } from '../../logic/parametrik/types';
import { EMPTY_STATE, type World } from '../../logic/sandbox';
import { cellAtPoint } from '../../logic/terrain-grid';
import { createLight } from './light';
import { startRenderer } from './renderer';
import { polylineObject } from './polylines';
import { KEY, projectChanges } from './projection';
import { createStructures } from './structures';
import { createTerrainMesh, type TerrainMesh } from './terrain-mesh';
import { createView } from './view';

/** Free margin around the terrain in the opening view, as a factor of its silhouette. */
const OPENING_MARGIN = 1.1;
const STROKE_PX = { base: 1.2, cursor: 2 };

export type CursorTone = 'signal' | 'ink';
export type SandboxStage = ReturnType<typeof createSandboxStage>;

/**
 * Creates the stage on a canvas. `onError` fires once if no GPU backend starts.
 * The caller feeds sizes through `resize` and releases everything with `dispose`.
 */
export function createSandboxStage(canvas: HTMLCanvasElement, onError: () => void) {
	const renderer = new THREE.WebGPURenderer({ canvas, antialias: true, alpha: false });
	const gpu = startRenderer(renderer, canvas, { ready: () => render(), failed: onError });

	const scene = new THREE.Scene();
	const view = createView();
	const light = createLight();
	const structures = createStructures();
	scene.add(...light.objects, structures.group);

	const ink = new THREE.Color();
	const signal = new THREE.Color();
	const baseOutline = new THREE.Line2NodeMaterial({ color: ink, linewidth: STROKE_PX.base });
	const cursorMaterial = new THREE.Line2NodeMaterial({
		color: signal,
		linewidth: STROKE_PX.cursor
	});
	let baseLines: LineSegments2 | undefined;
	let cursor: LineSegments2 | undefined;
	let cursorTone: CursorTone = 'signal';
	let terrain: TerrainMesh | undefined;
	/** The world the stage currently shows; the next one is drawn as a difference to it. */
	let shown: World | undefined;
	let palette: Palette3D | undefined;
	let planView = false;
	let pending = 0;
	/** At most one image per animation frame, however many inputs arrive. */
	function render() {
		if (!gpu.isLive() || pending) return;
		pending = requestAnimationFrame(() => {
			pending = 0;
			if (!gpu.isLive()) return;
			light.aim(view.target, view.span());
			structures.setScale(1 / view.metersPerPixel());
			renderer.render(scene, view.camera);
			canvas.dataset.frame = String(Number(canvas.dataset.frame ?? 0) + 1);
		});
	}

	function applyPalette(next: Palette3D) {
		palette = next;
		ink.set(next.ink);
		signal.set(next.categories['--signal']);
		baseOutline.color.copy(ink);
		cursorMaterial.color.copy(cursorTone === 'signal' ? signal : ink);
		terrain?.setPalette(next);
		structures.setPalette(next);
		render();
	}

	function removeLines(lines: LineSegments2 | undefined) {
		if (!lines) return;
		scene.remove(lines);
		lines.geometry.dispose();
	}

	function drawBaseLines(mesh: TerrainMesh) {
		removeLines(baseLines);
		baseLines = new LineSegments2(
			new LineSegmentsGeometry().setPositions(mesh.baseLines()),
			baseOutline
		);
		scene.add(baseLines);
	}

	/** Starts over on a new terrain: fresh surface, nothing built, opening view. */
	function open(world: World): World {
		if (terrain) {
			scene.remove(terrain.group);
			terrain.dispose();
		}
		structures.clear();
		terrain = createTerrainMesh(world.grid);
		scene.add(terrain.group);
		terrain.setGridVisible(planView ? 1 : 0);
		drawBaseLines(terrain);
		view.frameBox(new THREE.Box3().setFromObject(terrain.surface), OPENING_MARGIN);
		if (palette) terrain.setPalette(palette);
		return { ...world, state: EMPTY_STATE, lines: [] };
	}

	const raycaster = new THREE.Raycaster();
	// Theme colors: the terrain only changes uniforms; structures re-bake their vertex colors.
	const stopTheme = bindSceneTheme(canvas, scene, renderer, applyPalette);

	return {
		ready: gpu.started,
		view,
		render,
		/**
		 * Shows a world. A new seed starts over; otherwise only what differs from the world
		 * shown before is drawn again.
		 */
		show(world: World) {
			if (world === shown) return;
			const before = shown && shown.seed === world.seed ? shown : open(world);
			if (!terrain) return;
			projectChanges({ terrain, structures }, before, world);
			if (before.grid !== world.grid) drawBaseLines(terrain);
			shown = world;
			canvas.dataset.updates = String(Number(canvas.dataset.updates ?? 0) + 1);
			render();
		},
		/** Canvas size in CSS pixels. */
		resize(width: number, height: number) {
			renderer.setSize(width, height, false);
			view.resize(width, height);
			render();
		},
		/** Axonometric view, or the plan seen from above. */
		setPlan(plan: boolean) {
			planView = plan;
			view.setPlan(plan);
			terrain?.setGridVisible(plan ? 1 : 0);
			if (terrain) view.frameBox(new THREE.Box3().setFromObject(terrain.surface), OPENING_MARGIN);
			render();
		},
		/**
		 * Index of the grid cell under a canvas pixel, or undefined off the terrain. A hit on a
		 * house or a tree picks the cell it stands on.
		 */
		pickCell(xPx: number, yPx: number): number | undefined {
			if (!terrain || !shown) return undefined;
			raycaster.setFromCamera(view.ndc(xPx, yPx), view.camera);
			const built = [...structures.solids(KEY.house), ...structures.solids(KEY.forest)];
			const hit = raycaster.intersectObjects([terrain.surface, ...built], false)[0];
			if (!hit) return undefined;
			if (hit.object === terrain.surface) return (hit.faceIndex ?? NaN) >> 1;
			return cellAtPoint(shown.grid, hit.point.x, -hit.point.z)?.index;
		},
		/** Shows the area grid around a lattice position (in cells); strength 0 hides it. */
		setLens(column: number, row: number, strength: number) {
			terrain?.setLens(column, row, strength);
			render();
		},
		/** Draws polylines in world meters as the cursor; an empty list hides it. */
		setCursor(polylines: readonly (readonly Vec3[])[], tone: CursorTone = 'signal') {
			removeLines(cursor);
			cursorTone = tone;
			cursorMaterial.color.copy(tone === 'signal' ? signal : ink);
			cursor = polylineObject(polylines, cursorMaterial);
			if (cursor) {
				cursor.renderOrder = 10;
				scene.add(cursor);
			}
			render();
		},
		dispose() {
			stopTheme();
			cancelAnimationFrame(pending);
			removeLines(baseLines);
			removeLines(cursor);
			if (terrain) terrain.dispose();
			structures.dispose();
			baseOutline.dispose();
			cursorMaterial.dispose();
			gpu.dispose();
		}
	};
}
