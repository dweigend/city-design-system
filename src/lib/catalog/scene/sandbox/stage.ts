/**
 * Stage of the sandbox: one renderer per canvas, the view, light, the terrain and everything
 * built on it. Owns every GPU resource it creates (A-52) and renders on demand. The stage
 * projects sandbox worlds; it never changes them (PP-2).
 */
import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';
import { LineSegments2 } from 'three/examples/jsm/lines/webgpu/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { STRICHE, type Kontext } from '../../data/leitstil';
import { grammatik } from '../leitstil';
import { nearestZoom, sandboxStyle } from './drafting-style';
import { STRUCTURE_VARIANTS, type StructureVariant } from './view-params';
import type { Palette3D } from '../../data/city3d';
import { bindSceneTheme } from '../themeBinding';
import type { Primitive, Vec3 } from '../../logic/parametrik/types';
import type { FocusId } from '../../logic/presentation';
import { stilFuer } from '../../logic/leitstil';
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
type StageOptions = {
	/** Optional study window in world meters, from its low corner to its high corner. */
	frame?: readonly [Vec3, Vec3];
	/** Retain additions from these epochs in their full drafting treatment for comparison. */
	earliestFullYear?: number;
	/** Fixed additions to the study outside the editable sandbox state. */
	additions?: Primitive[];
};

const CURSOR_DASH_PX = 4;
const CURSOR_GAP_PX = 3;
const planned = stilFuer({ zoom: 'nah', modus: 'bauen', situation: 'normal' }).rollen.geplant;

export type SandboxStage = ReturnType<typeof createSandboxStage>;

/**
 * Creates the stage on a canvas. `onError` fires once if no GPU backend starts.
 * The caller feeds sizes through `resize` and releases everything with `dispose`.
 */
export function createSandboxStage(
	canvas: HTMLCanvasElement,
	onError: () => void,
	study: StageOptions = {}
) {
	const renderer = new THREE.WebGPURenderer({ canvas, antialias: true, alpha: false });
	const gpu = startRenderer(renderer, canvas, { ready: () => render(), failed: onError });

	const scene = new THREE.Scene();
	const view = createView();
	const light = createLight();
	const structures = createStructures();
	const studyAdditions = study.additions ?? [];
	scene.add(...light.objects, structures.group);

	const ink = new THREE.Color();
	const blueprint = new THREE.Color();
	const baseOutline = new THREE.Line2NodeMaterial({ color: ink, linewidth: STRICHE.kontur });
	const cursorMaterial = new THREE.Line2NodeMaterial({
		color: blueprint,
		linewidth: planned.strichPx,
		dashed: planned.gestrichelt,
		depthWrite: false
	});
	const pixelsPerMeter = uniform(1);
	cursorMaterial.dashScaleNode = pixelsPerMeter;
	cursorMaterial.dashSizeNode = uniform(CURSOR_DASH_PX);
	cursorMaterial.gapSizeNode = uniform(CURSOR_GAP_PX);
	let baseLines: LineSegments2 | undefined;
	let cursor: LineSegments2 | undefined;
	let terrain: TerrainMesh | undefined;
	/** The world the stage currently shows; the next one is drawn as a difference to it. */
	let focus: FocusId = 'all';
	let shown: World | undefined;
	let palette: Palette3D | undefined;
	let planView = false;
	let variant: StructureVariant = STRUCTURE_VARIANTS[0];
	let refreshTones = true;

	function updateStyle() {
		const scale = 1 / view.metersPerPixel();
		const zoom = nearestZoom(scale);
		const thema = document.documentElement.dataset.theme === 'dark' ? 'dunkel' : 'hell';
		const context: Kontext = { zoom, modus: 'ansehen', situation: 'normal', thema };
		const style = sandboxStyle(context, variant);
		const tones = refreshTones ? grammatik(canvas, style) : undefined;
		structures.setStyle(style, variant, scale, tones);
		if (tones) light.setTone(tones.schatten, tones.paper);
		canvas.dataset.zoom = zoom;
		canvas.dataset.structureVariant = variant;
		refreshTones = false;
	}
	let pending = 0;
	/** At most one image per animation frame, however many inputs arrive. */
	function render() {
		if (!gpu.isLive() || pending) return;
		pending = requestAnimationFrame(() => {
			pending = 0;
			if (!gpu.isLive()) return;
			light.aim(view.target, view.span());
			pixelsPerMeter.value = 1 / view.metersPerPixel();
			updateStyle();
			renderer.render(scene, view.camera);
			canvas.dataset.frame = String(Number(canvas.dataset.frame ?? 0) + 1);
		});
	}

	function applyPalette(next: Palette3D) {
		palette = next;
		refreshTones = true;
		ink.set(next.ink);
		blueprint.set(next.blueprint);
		baseOutline.color.copy(ink);
		cursorMaterial.color.copy(blueprint);
		terrain?.setPalette(next);

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

	function frameTerrain(mesh: TerrainMesh) {
		const bounds = new THREE.Box3();
		if (study.frame) {
			for (const [x, y, z] of study.frame) bounds.expandByPoint(new THREE.Vector3(x, z, -y));
		} else bounds.setFromObject(mesh.surface);
		view.frameBox(bounds, OPENING_MARGIN);
	}

	/** Starts over on a new terrain: fresh surface, nothing built, opening view. */
	function open(world: World): World {
		if (terrain) {
			scene.remove(terrain.group);
			terrain.dispose();
		}
		structures.clear();
		structures.set('study', studyAdditions);
		terrain = createTerrainMesh(world.grid, undefined, light.shade);
		scene.add(terrain.group);
		terrain.setGridVisible(planView ? 1 : 0);
		drawBaseLines(terrain);
		frameTerrain(terrain);
		if (palette) terrain.setPalette(palette);
		return { ...world, state: EMPTY_STATE, lines: [] };
	}

	function alreadyShown(world: World, nextFocus: FocusId) {
		return world === shown && nextFocus === focus;
	}
	function previousWorld(world: World): World {
		return shown && shown.seed === world.seed ? shown : open(world);
	}

	function updateWorld(mesh: TerrainMesh, before: World, after: World, nextFocus: FocusId) {
		projectChanges(
			{ terrain: mesh, structures, earliestFullYear: study.earliestFullYear },
			before,
			after,
			nextFocus,
			nextFocus !== focus
		);
		if (before.grid !== after.grid) drawBaseLines(mesh);
	}

	const raycaster = new THREE.Raycaster();

	function hitAt(surface: TerrainMesh['surface'], xPx: number, yPx: number) {
		raycaster.setFromCamera(view.ndc(xPx, yPx), view.camera);
		const built = [...structures.solids(KEY.house), ...structures.solids(KEY.forest)];
		return raycaster.intersectObjects([surface, ...built], false)[0];
	}

	function cellIndexAtHit(
		hit: THREE.Intersection,
		surface: TerrainMesh['surface'],
		grid: World['grid']
	) {
		if (hit.object === surface) return (hit.faceIndex ?? NaN) >> 1;
		return cellAtPoint(grid, hit.point.x, -hit.point.z)?.index;
	}

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
		show(world: World, nextFocus: FocusId) {
			if (alreadyShown(world, nextFocus)) return;
			const before = previousWorld(world);
			if (!terrain) return;
			updateWorld(terrain, before, world, nextFocus);
			focus = nextFocus;
			shown = world;
			canvas.dataset.updates = String(Number(canvas.dataset.updates ?? 0) + 1);
			render();
		},
		/** Canvas size in CSS pixels. */
		resize(width: number, height: number) {
			renderer.setSize(width, height, false);
			view.resize(width, height);
			if (study.frame && terrain) frameTerrain(terrain);
			render();
		},
		/** Switches the structural line treatment without replaying interventions. */
		setStructureVariant(next: StructureVariant) {
			variant = next;
			render();
		},
		/** Axonometric view, or the plan seen from above. */
		setPlan(plan: boolean) {
			planView = plan;
			view.setPlan(plan);
			terrain?.setGridVisible(plan ? 1 : 0);
			if (terrain) frameTerrain(terrain);
			render();
		},
		/**
		 * Index of the grid cell under a canvas pixel, or undefined off the terrain. A hit on a
		 * house or a tree picks the cell it stands on.
		 */
		pickCell(xPx: number, yPx: number): number | undefined {
			if (!terrain || !shown) return undefined;
			const hit = hitAt(terrain.surface, xPx, yPx);
			return hit && cellIndexAtHit(hit, terrain.surface, shown.grid);
		},
		/** Shows the area grid around a lattice position (in cells); strength 0 hides it. */
		setLens(column: number, row: number, strength: number) {
			terrain?.setLens(column, row, strength);
			render();
		},
		/** Draws planned outlines in world meters. An empty list hides them. */
		setCursor(polylines: readonly (readonly Vec3[])[]) {
			removeLines(cursor);
			cursor = polylineObject(polylines, cursorMaterial);
			if (cursor) {
				cursor.computeLineDistances();
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
			light.dispose();
			baseOutline.dispose();
			cursorMaterial.dispose();
			gpu.dispose();
		}
	};
}
