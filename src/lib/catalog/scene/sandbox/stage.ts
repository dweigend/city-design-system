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
import { createCellPicker } from './house-picker';
import { createLight } from './light';
import { startRenderer } from './renderer';
import { polylineObject } from './polylines';
import { KEY, projectChanges, projectInstallations } from './projection';
import { createStructures } from './structures';
import { createTerrainMesh, type TerrainMesh } from './terrain-mesh';
import { frameOldTown, frameTownSilhouette } from './opening-view';
import { createView, type OpeningArea } from './view';
import { createVehicles } from './vehicles';
import { createTimeline } from './timeline';
import { createFrameLoop } from './frame-loop';

/** Free margin around the terrain in the opening view, as a factor of its silhouette. */
const OPENING_MARGIN = 1.1;
type StageOptions = {
	openingArea?: () => OpeningArea | undefined;
	/** Opens an editable sandbox at the town scale. */
	frameTown?: boolean;
	/** Seed the study additions belong to, if restricted to one terrain. */
	additionSeed?: number;
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
	const gpu = startRenderer(renderer, canvas, { ready: () => loop.render(), failed: onError });

	const scene = new THREE.Scene();
	const view = createView();
	const light = createLight();
	const structures = createStructures();
	const nextFrame = { set: structures.queue };
	const vehicles = createVehicles();
	const studyAdditions = study.additions ?? [];
	scene.add(...light.objects, structures.group, vehicles.group);

	const ink = new THREE.Color();
	const hazardRole = stilFuer({ zoom: 'nah', modus: 'bauen', situation: 'stoerung' }).rollen.gefahr;
	const swatches = { planned: new THREE.Color(), hazard: new THREE.Color() };
	const baseOutline = new THREE.Line2NodeMaterial({ color: ink, linewidth: STRICHE.kontur });
	const cursorMaterial = new THREE.Line2NodeMaterial({
		color: swatches.planned,
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
	let target: LineSegments2 | undefined;
	let rejection: LineSegments2 | undefined;
	const rejectionMaterial = new THREE.Line2NodeMaterial({
		linewidth: 2,
		depthWrite: false,
		dashed: planned.gestrichelt
	});
	rejectionMaterial.dashScaleNode = pixelsPerMeter;
	rejectionMaterial.dashSizeNode = cursorMaterial.dashSizeNode;
	rejectionMaterial.gapSizeNode = cursorMaterial.gapSizeNode;
	const targetMaterial = new THREE.Line2NodeMaterial({
		linewidth: STRICHE.kontur,
		depthWrite: false
	});
	let terrain: TerrainMesh | undefined;
	const picker = createCellPicker(view);
	/** The world the stage currently shows; the next one is drawn as a difference to it. */
	let focus: FocusId = 'all';
	let shown: World | undefined;
	let palette: Palette3D | undefined;
	let planView = false;
	let variant: StructureVariant = STRUCTURE_VARIANTS[0];
	let refreshTones = true;
	let viewDirty = true;
	let pickDirty = true;
	type Affected = (x: number, y: number) => boolean;
	const frameListeners = new Set<(affected?: Affected) => void>();
	const hoverRay = new THREE.Raycaster();
	function crossedPointer(x: number, y: number) {
		hoverRay.setFromCamera(view.ndc(x, y), view.camera);
		const crosses = (box: THREE.Box3) => !box.isEmpty() && hoverRay.ray.intersectsBox(box);
		return crosses(structures.swept) || crosses(vehicles.swept);
	}
	let coarse = false;
	let viewScale = 0;
	let viewElevation = 0;
	let shadowsDirty = true;
	const flushShadows = () => (shadowsDirty = true);
	let opening: World | undefined;
	let framedArea: OpeningArea | undefined;

	function updateStyle() {
		const scale = 1 / view.metersPerPixel();
		const zoom = nearestZoom(scale);
		const nextCoarse = zoom === 'stadt' || zoom === 'quartier';
		if (nextCoarse !== coarse && shown)
			projectInstallations(nextFrame, shown, shown, focus, nextCoarse);
		coarse = nextCoarse;
		const thema = document.documentElement.dataset.theme === 'dark' ? 'dunkel' : 'hell';
		const context: Kontext = { zoom, modus: 'ansehen', situation: 'normal', thema };
		const style = sandboxStyle(context, variant);
		const tones = refreshTones ? grammatik(canvas, style) : undefined;
		structures.setStyle([style, variant, scale, tones], view.elevation());
		terrain?.setCityOverview(style.rollen.weg.level === 'block');
		if (tones) light.setTone(tones.schatten, tones.paper);
		canvas.dataset.zoom = zoom;
		canvas.dataset.structureVariant = variant;
		refreshTones = false;
	}

	function prepareView() {
		const scale = view.metersPerPixel();
		const elevation = view.elevation();
		if (!viewDirty && !refreshTones && scale === viewScale && elevation === viewElevation) return;
		pickDirty = true;
		viewScale = scale;
		viewElevation = elevation;
		light.aim(view.target, view.span());
		pixelsPerMeter.value = 1 / view.metersPerPixel();
		updateStyle();
		viewDirty = false;
	}

	function renderImage(castersMoved: boolean) {
		if (shadowsDirty || castersMoved) light.refresh();
		shadowsDirty = false;
		renderer.render(scene, view.camera);
		canvas.dataset.frame = String(Number(canvas.dataset.frame ?? 0) + 1);
	}

	const loop = createFrameLoop(gpu.isLive, ({ stamp, reduced }) => {
		prepareView();
		const seconds = timeline.sample(stamp);
		terrain?.setTime(seconds);
		const seating = structures.step(seconds * 1000, reduced && !timeline.seeking);
		const transit = vehicles.step(timeline.transitSeconds * 1000);
		renderImage(structures.shadowChanged);
		if (pickDirty || seating || transit)
			for (const listener of frameListeners) listener(pickDirty ? undefined : crossedPointer);
		pickDirty = false;
		return timeline.playing();
	});
	const { render } = loop;
	const timeline = createTimeline(canvas, render);
	loop.reduced.addEventListener('change', flushShadows);

	function applyPalette(next: Palette3D) {
		palette = next;
		scene.background = new THREE.Color(next.paper).lerp(new THREE.Color(next.ink), 0.035);
		refreshTones = true;
		shadowsDirty = true;
		ink.set(next.ink);
		swatches.planned.set(next.blueprint);
		swatches.hazard.set(next.categories[hazardRole.token.replace('--cat-', '')]);
		baseOutline.color.copy(ink);
		cursorMaterial.color.copy(swatches.planned);
		rejectionMaterial.color.copy(swatches.hazard);
		targetMaterial.color.set(next.categories['--signal']);
		terrain?.setPalette(next);
		vehicles.setPalette(next);

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

	function studyBounds(frame: readonly [Vec3, Vec3]) {
		const bounds = new THREE.Box3();
		for (const [x, y, z] of frame) bounds.expandByPoint(new THREE.Vector3(x, z, -y));
		return bounds;
	}

	function framePortrait(world: World, area = study.openingArea?.()) {
		if (planView || !frameOldTown(view, world, area)) return false;
		framedArea = area;
		return true;
	}

	function frameTerrain(mesh: TerrainMesh) {
		if (study.frame) return view.frameBox(studyBounds(study.frame), OPENING_MARGIN);
		if (opening) {
			const framed = view.isPortrait()
				? framePortrait(opening)
				: frameTownSilhouette(view, opening);
			if (framed) return;
		}
		view.frameBox(new THREE.Box3().setFromObject(mesh.surface), OPENING_MARGIN);
	}

	function replaceTerrain(world: World) {
		if (terrain) {
			scene.remove(terrain.group);
			terrain.dispose();
		}
		const mesh = createTerrainMesh(world.grid, undefined, light.shade);
		scene.add(mesh.group);
		mesh.setGridVisible(Number(planView));
		drawBaseLines(mesh);
		if (palette) mesh.setPalette(palette);
		return mesh;
	}

	/** Starts over on a new terrain: fresh surface, nothing built, opening view. */
	function open(world: World): World {
		structures.clear();
		const additionSeed = study.additionSeed ?? world.seed;
		if (additionSeed === world.seed) structures.queue('study', studyAdditions);
		terrain = replaceTerrain(world);
		opening = study.frameTown ? world : undefined;
		frameTerrain(terrain);
		return { ...world, state: EMPTY_STATE, lines: [] };
	}

	function invalidateView() {
		viewDirty = true;
		shadowsDirty = true;
		render();
	}

	function alreadyShown(world: World, nextFocus: FocusId) {
		return world === shown && nextFocus === focus;
	}
	function previousWorld(world: World): World {
		return shown && shown.seed === world.seed ? shown : open(world);
	}

	function updateWorld(
		mesh: TerrainMesh,
		before: World,
		after: World,
		nextFocus: FocusId,
		place: boolean
	) {
		const placeAt =
			place && (!loop.reduced.matches || timeline.seeking)
				? timeline.sample(performance.now()) * 1000
				: undefined;
		const projection =
			placeAt === undefined
				? nextFrame
				: {
						set: (key: string, parts: Primitive[], cellId?: string) =>
							structures.queue(key, parts, cellId, placeAt)
					};
		projectChanges(
			{ terrain: mesh, structures: projection, coarse, earliestFullYear: study.earliestFullYear },
			before,
			after,
			nextFocus,
			nextFocus !== focus || before.roofBuilder !== after.roofBuilder
		);
		if (before.grid !== after.grid) drawBaseLines(mesh);
	}

	function frameCurrent(force: boolean) {
		if (terrain && (force || opening)) frameTerrain(terrain);
	}

	function updateVehicles(before: World, world: World, nextFocus: FocusId) {
		if (before.lines !== world.lines) vehicles.setLines(world.lines);
		vehicles.setFocus(nextFocus, world.state.year);
	}

	function worldShown(world: World, nextFocus: FocusId) {
		focus = nextFocus;
		shown = world;
		canvas.dataset.updates = String(Number(canvas.dataset.updates ?? 0) + 1);
		shadowsDirty = true;
		viewDirty = true;
		render();
	}

	function drawTarget(outline: readonly Vec3[]) {
		removeLines(target);
		target = polylineObject(outline.length ? [outline] : [], targetMaterial);
		if (target) {
			target.renderOrder = 11;
			scene.add(target);
		}
	}

	// Theme colors: the terrain only changes uniforms; structures re-bake their vertex colors.
	const stopTheme = bindSceneTheme(canvas, scene, renderer, applyPalette);

	return {
		ready: gpu.started,
		/** Freeze the scene at a timeline coordinate in seconds, or resume playback with undefined. */
		setTime: timeline.seek,
		/** Hold playback at the displayed frame until resumed. */
		setPaused: timeline.pause,
		view,
		render,
		/** Runs after the rendered camera and pick geometry are current. */
		afterFrame(listener: (affected?: Affected) => void) {
			frameListeners.add(listener);
			return () => {
				frameListeners.delete(listener);
			};
		},
		/** Keeps the camera fixed after the first drawing gesture. */
		endOpening() {
			opening = undefined;
		},
		/** Retains the current camera position on resize after the player moves it. */
		viewChanged(this: void) {
			opening = undefined;
			invalidateView();
		},
		/** Re-centers the portrait opening once the HUD bounds are available. */
		setOpeningArea(area: OpeningArea) {
			if (!opening || study.frame) return;
			if (framedArea?.top === area.top && framedArea.bottom === area.bottom) return;
			if (framePortrait(opening, area)) invalidateView();
		},
		/**
		 * Shows a world. A new seed starts over; otherwise only what differs from the world
		 * shown before is drawn again.
		 */
		show(world: World, nextFocus: FocusId, place = false) {
			if (alreadyShown(world, nextFocus)) return;
			const before = previousWorld(world);
			if (!terrain) return;
			updateWorld(
				terrain,
				before,
				world,
				nextFocus,
				place && before === shown && before.state !== world.state
			);
			updateVehicles(before, world, nextFocus);
			worldShown(world, nextFocus);
		},
		/** Pauses vehicle simulation at its current pose. Other placement feedback continues. */
		setTransitPaused: timeline.pauseTransit,
		/** Canvas size in CSS pixels. */
		resize(width: number, height: number) {
			renderer.setSize(width, height, false);
			view.resize(width, height);
			frameCurrent(Boolean(study.frame));
			invalidateView();
		},
		/** Switches the structural line treatment without replaying interventions. */
		setStructureVariant(next: StructureVariant) {
			variant = next;
			invalidateView();
		},
		/** Axonometric view, or the plan seen from above. */
		setPlan(plan: boolean) {
			if (planView === plan) return;
			planView = plan;
			view.setPlan(plan);
			terrain?.setGridVisible(Number(plan));
			if (!plan || !study.frameTown) frameCurrent(!study.frameTown);
			invalidateView();
		},
		/** Picks the nearest visible house, tree or terrain cell in the current view. */
		pickCell(x: number, y: number) {
			if (!terrain || !shown) return undefined;
			prepareView();
			return picker(x, y, shown.grid, [
				...structures.solids(KEY.installation),
				...structures.solids(KEY.house),
				...structures.solids(KEY.forest),
				...vehicles.group.children.filter((car) => car.visible),
				terrain.water
			]);
		},
		/** Shows the area grid around a lattice position (in cells); strength 0 hides it. */
		setLens(column: number, row: number, strength: number) {
			terrain?.setLens(column, row, strength);
			render();
		},
		/** Draws planned outlines in world meters. An empty list hides them. */
		setCursor(polylines: readonly (readonly Vec3[])[], outline: readonly Vec3[] = []) {
			drawTarget(outline);
			removeLines(cursor);
			cursor = polylineObject(polylines, cursorMaterial);
			if (cursor) {
				cursor.computeLineDistances();
				cursor.renderOrder = 10;
				scene.add(cursor);
			}
			render();
		},
		/** Keeps the rejected survey visible alongside a later brush guide. */
		setRejection(marks: readonly (readonly Vec3[])[]) {
			removeLines(rejection);
			rejection = polylineObject(marks, rejectionMaterial);
			if (rejection) {
				rejection.computeLineDistances();
				rejection.renderOrder = 12;
				scene.add(rejection);
			}
			render();
		},
		dispose() {
			timeline.dispose();
			stopTheme();
			frameListeners.clear();
			loop.reduced.removeEventListener('change', flushShadows);
			loop.dispose();
			vehicles.dispose();
			removeLines(baseLines);
			removeLines(cursor);
			removeLines(target);
			removeLines(rejection);
			targetMaterial.dispose();
			rejectionMaterial.dispose();
			if (terrain) terrain.dispose();
			structures.dispose();
			light.dispose();
			baseOutline.dispose();
			cursorMaterial.dispose();
			gpu.dispose();
		}
	};
}
