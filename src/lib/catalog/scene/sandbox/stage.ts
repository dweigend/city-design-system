/**
 * Stage of the sandbox: one renderer per canvas, the view, light, the terrain and everything
 * built on it. Owns every GPU resource it creates (A-52) and renders on demand. The stage
 * projects sandbox worlds; it never changes them (PP-2).
 */
import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';
import { LineSegments2 } from 'three/examples/jsm/lines/webgpu/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { STRICHE } from '../../data/leitstil';
import { applyStructureStyle } from './structure-style';
import { nearestZoom } from './drafting-style';
import type { MinimumInk } from './view-params';
import { createFrameLayer } from './frame-layer';
import type { Palette3D } from '../../data/city3d';
import { bindSceneTheme } from '../themeBinding';
import { sceneSwatch } from '../scene-palette';
import type { Primitive, Vec3 } from '../../logic/parametrik/types';
import type { FocusId } from '../../logic/presentation';
import type { ResolvedView } from '../../logic/view-modes';
import { stilFuer } from '../../logic/leitstil';
import { EMPTY_STATE, type World } from '../../logic/sandbox';
import type { GroundPlan } from '../../logic/city-plan';
import { createCellPicker } from './house-picker';
import { studioPipeline } from '../studio-pipeline';
import { type StudioQuality } from '../studio-quality';
import { startRenderer } from './renderer';
import { polylineObject } from './polylines';
import {
	housePickTargets,
	projectStockOverview,
	KEY,
	projectChanges,
	projectInstallations
} from './projection';
import { createStructures } from './structures';
import { createTerrainMesh, type TerrainMesh } from './terrain-mesh';
import { MODEL_BASE_Y_M } from './terrain-geometry';
import { createTerrainLook } from './terrain-look';
import { frameOldTown, frameTownSilhouette } from './opening-view';
import { createView, type FrameOrientation, type OpeningArea } from './view';
import { createViewMode } from './view-mode';
import { createSectionLayer } from './section-layer';
import { sectionSite } from './section-site';
import { createSchematicLayer } from './schematic-layer';
import { createVehicles } from './vehicles';
import { createTimeline } from './timeline';
import { collectOpeningGroups } from './court-opening';
import { createFrameLoop } from './frame-loop';
import { createContextCamera, type ContextPerspective } from './context-camera';

/** Free margin around the terrain in the opening view, as a factor of its silhouette. */
const OPENING_MARGIN = 1.1;
/** Detached fixed context geometry supplied to the stage, which takes ownership of disposal. */
export type StageContext = Readonly<{
	group: THREE.Object3D;
	bounds: THREE.Box3;
	orientation: FrameOrientation;
	/** Optional fixed-context orientations for the supported stage views. */
	viewOrientations?: Readonly<Partial<Record<ResolvedView['view'], FrameOrientation>>>;
	/** Margin around a fixed context when its view orientations are supplied. */
	viewMargin?: number;
	/** Optional perspective lens and subject silhouette for a fixed context. */
	perspective?: ContextPerspective;
	setPalette(palette: Palette3D): void;
	dispose(): void;
}>;

type StageOptions = {
	context?: StageContext;
	quality?: StudioQuality;
	minInkAppliesTo?: MinimumInk;
	showFrameStudy?: boolean;
	onFrameFailure?: (reason: string) => void;
	openingArea?: () => OpeningArea | undefined;
	/** Opens an editable sandbox at the town scale. */
	frameTown?: boolean;
	/** Seed the study additions belong to, if restricted to one terrain. */
	additionSeed?: number;
	/** Optional study window in world meters, from its low corner to its high corner. */
	frame?: readonly [Vec3, Vec3];
	/** Narrower study window for canvases taller than wide. */
	portraitFrame?: readonly [Vec3, Vec3];
	/** Retain additions from these epochs in their full drafting treatment for comparison. */
	earliestFullYear?: number;
	/** Fixed additions to the study outside the editable sandbox state. */
	additions?: Primitive[];
	/** Fixed plan projected over its source terrain, with carrier circulation masked in the crop. */
	groundPlan?: GroundPlan;
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
	const context = study.context;
	let contextOrientation = context?.orientation;
	const lens = context?.perspective ? createContextCamera(context.perspective) : undefined;
	const terrainLook = createTerrainLook();
	const pipeline = studioPipeline(
		renderer,
		scene,
		lens?.camera ?? view.camera,
		study.quality,
		terrainLook.beauty
	);
	const light = pipeline.light;
	const structures = createStructures(study.quality, true, light.receiverOutput, terrainLook.mark);
	const nextFrame = { set: structures.queue };
	const vehicles = createVehicles();
	const section = createSectionLayer();
	const schematic = createSchematicLayer();
	const viewMode = createViewMode(
		view,
		terrainLook,
		structures.group,
		vehicles.group,
		section,
		schematic
	);
	const warmTarget = new THREE.RenderTarget(1, 1);
	const studyAdditions = study.additions ?? [];
	scene.add(viewMode.clip, section.group, section.marker, schematic.group);
	viewMode.clip.add(structures.group, vehicles.group);
	if (context) viewMode.clip.add(context.group);
	if (context?.viewOrientations) {
		const center = context.bounds.getCenter(new THREE.Vector3());
		const width = context.bounds.getSize(new THREE.Vector3()).x;
		const sources = context.group.children.flatMap((child) =>
			child instanceof THREE.Mesh
				? [{ parent: child, ground: [child.geometry], baseM: context.bounds.min.y }]
				: []
		);
		section.rebuild(
			[center.x, -center.z, center.y],
			[0, -1],
			width * 0.48,
			[context.bounds.min.y, context.bounds.max.y],
			sources
		);
	}

	const ink = new THREE.Color();
	const paper = new THREE.Color();
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
	const viewLayers = () => ({ terrain, marks: [baseLines, cursor, target, rejection] });
	let retainedDirty = true;
	let warmedStructureRevision = structures.retainedRevision;
	const frames = createFrameLayer(
		structures,
		() => render(),
		(detail) => {
			canvas.dataset.frameFailure = detail;
			study.onFrameFailure?.(detail);
		}
	);
	let refreshTones = true;
	let viewDirty = true;
	let styleDirty = true;
	let pickDirty = true;
	type Affected = (x: number, y: number) => boolean;
	const frameListeners = new Set<(affected?: Affected) => void>();
	const hoverRay = new THREE.Raycaster();
	function crossedPointer(x: number, y: number) {
		hoverRay.setFromCamera(view.ndc(x, y), lens?.camera ?? view.camera);
		const crosses = (box: THREE.Box3) => !box.isEmpty() && hoverRay.ray.intersectsBox(box);
		return crosses(structures.swept) || (vehicles.group.visible && crosses(vehicles.swept));
	}
	let coarse = false;
	let viewScale = 0;
	let viewElevation = 0;
	let shadowsDirty = true;
	const flushShadows = () => (shadowsDirty = true);
	let opening: World | undefined;
	let framedArea: OpeningArea | undefined;
	let openingPending = false;
	let openingDrawn = false;

	function updateStyle(scale: number, elevation: number) {
		const zoom = nearestZoom(scale);
		const nextCoarse = zoom === 'stadt' || zoom === 'quartier';
		if (nextCoarse !== coarse && shown)
			projectInstallations(nextFrame, shown, shown, focus, nextCoarse);
		projectStockOverview(terrain, nextFrame, nextCoarse);
		coarse = nextCoarse;
		if (shown) structures.setJointView(shown.grid, shown.state.year, !coarse);
		const style = applyStructureStyle(
			structures,
			canvas,
			scale,
			elevation,
			refreshTones,
			study.minInkAppliesTo
		);
		terrain?.setCityOverview(style.rollen.weg.level === 'block');
		if (refreshTones) light.setPaper(paper);
		canvas.dataset.zoom = zoom;

		refreshTones = false;
		styleDirty = false;
	}

	function prepareView() {
		const { scale, elevation } = view.drawingMetrics();
		const redraw = styleDirty || refreshTones || scale !== viewScale || elevation !== viewElevation;
		if (!viewDirty && !redraw) return;
		if (lens && viewDirty) {
			const [width, height] = view.viewport();
			lens.frame(view.camera, view.target, width / height);
		}
		pickDirty = true;
		viewScale = scale;
		viewElevation = elevation;
		light.aim(view.target, view.span());
		pixelsPerMeter.value = 1 / view.metersPerPixel();
		if (redraw) updateStyle(scale, elevation);
		viewDirty = false;
	}

	function renderImage(castersMoved: boolean) {
		if (shadowsDirty || castersMoved) light.refresh();
		shadowsDirty = false;
		pipeline.render();
		canvas.dataset.frame = String(Number(canvas.dataset.frame ?? 0) + 1);
	}

	function prepareOpening() {
		if (opening && openingPending && openingDrawn) {
			const world = opening;
			openingPending = false;
			view.frameBase(() => {
				frameOpening(world, framedArea);
				if (viewMode.retainsDrafting && terrain)
					view.frameInspection(terrain.water.geometry, section.anchors);
			});
			viewDirty = shadowsDirty = true;
		}
	}

	function renderView(castersMoved: boolean) {
		const needsWarmUp = retainedDirty || warmedStructureRevision !== structures.retainedRevision;
		if (!viewMode.retainsDrafting || !needsWarmUp || (opening && openingPending)) {
			renderImage(castersMoved);
			return true;
		}
		// The beauty pass only runs once per renderer frame. Keep the warm-up off the canvas
		// and schedule the visible pass even while playback is paused.
		const target = renderer.getRenderTarget();
		renderer.setRenderTarget(warmTarget);
		try {
			viewMode.warm(scene, viewLayers(), () => {
				light.refresh();
				pipeline.render();
			});
		} finally {
			renderer.setRenderTarget(target);
		}
		retainedDirty = false;
		warmedStructureRevision = structures.retainedRevision;
		shadowsDirty = true;
		render();
		return false;
	}

	const loop = createFrameLoop(gpu.isLive, ({ stamp, reduced }) => {
		prepareOpening();
		const moving = view.stepBoxMove(stamp, reduced);
		prepareView();
		const seconds = timeline.sample(stamp);
		terrain?.setTime(seconds);
		const seating = structures.step(seconds * 1000, reduced && !timeline.seeking);
		const transit = vehicles.step(timeline.transitSeconds * 1000);
		if (!renderView(structures.shadowChanged)) return false;
		frames.afterDraw();
		if (opening && openingPending) {
			openingDrawn = true;
			render();
		}
		if (pickDirty || seating || transit)
			for (const listener of frameListeners) listener(pickDirty ? undefined : crossedPointer);
		pickDirty = false;
		return moving || timeline.playing();
	});
	const { render } = loop;
	const timeline = createTimeline(canvas, render);
	loop.reduced.addEventListener('change', flushShadows);

	function applyPalette(next: Palette3D) {
		palette = next;
		paper.set(next.paper);
		scene.background = context ? paper : paper.clone().lerp(new THREE.Color(next.ink), 0.025);
		structures.setPalette(next);
		terrainLook.setPalette(next);
		refreshTones = true;
		shadowsDirty = true;
		ink.set(next.ink);
		schematic.setPalette(next);
		swatches.planned.set(next.blueprint);
		swatches.hazard.set(sceneSwatch(next, hazardRole.token));
		baseOutline.color.copy(ink);
		cursorMaterial.color.copy(swatches.planned);
		rejectionMaterial.color.copy(swatches.hazard);
		targetMaterial.color.set(sceneSwatch(next, '--signal'));
		terrain?.setPalette(next);
		section.setPalette(
			next,
			terrain?.waterColor() ?? new THREE.Color(sceneSwatch(next, '--cat-health'))
		);
		context?.setPalette(next);
		vehicles.setPalette(next);

		render();
	}

	function removeLines(lines: LineSegments2 | undefined) {
		if (!lines) return;
		lines.removeFromParent();
		lines.geometry.dispose();
	}

	function drawBaseLines(mesh: TerrainMesh) {
		removeLines(baseLines);
		baseLines = new LineSegments2(
			new LineSegmentsGeometry().setPositions(mesh.baseLines()),
			baseOutline
		);
		viewMode.clip.add(baseLines);
		retainedDirty = true;
	}

	function studyBounds(frame: readonly [Vec3, Vec3]) {
		const bounds = new THREE.Box3();
		for (const [x, y, z] of frame) bounds.expandByPoint(new THREE.Vector3(x, z, -y));
		return bounds;
	}

	function frameOpening(world: World, area = study.openingArea?.()) {
		framedArea = area;
		return view.isPortrait() && view.elevation() !== Math.PI / 2
			? frameOldTown(view, world, area, study.additions)
			: frameTownSilhouette(view, world, area, study.additions);
	}

	function frameTerrain(mesh: TerrainMesh) {
		if (study.frame) {
			const frame = view.isPortrait() ? (study.portraitFrame ?? study.frame) : study.frame;
			return view.frameBox(studyBounds(frame), view.isPortrait() ? 1 : OPENING_MARGIN);
		}
		if (opening) {
			openingPending = true;
			framedArea = study.openingArea?.() ?? framedArea;
			if (openingDrawn) return;
		}
		view.frameBox(new THREE.Box3().setFromObject(mesh.surface), OPENING_MARGIN);
	}

	function replaceTerrain(world: World) {
		if (terrain) {
			terrain.group.removeFromParent();
			terrain.dispose();
		}
		const plan = study.groundPlan;
		const planCells =
			plan && plan.terrainSeed === world.grid.terrain.seed
				? new Set(plan.cells.map(({ id }) => id))
				: undefined;
		const mesh = createTerrainMesh(world.grid, undefined, light.shade, planCells);
		viewMode.clip.add(mesh.group);
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
		openingDrawn = false;
		const mesh = terrain;
		view.frameBase(() => frameTerrain(mesh));
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
			{
				terrain: mesh,
				structures: projection,
				coarse,
				earliestFullYear: study.earliestFullYear,
				openingGroups:
					opening === after && before.state === EMPTY_STATE
						? collectOpeningGroups(after)
						: undefined
			},
			before,
			after,
			nextFocus,
			nextFocus !== focus || before.roofBuilder !== after.roofBuilder
		);
		if (before.grid !== after.grid) drawBaseLines(mesh);
	}

	function frameCurrent(force: boolean, durationMs = 0) {
		if (context) {
			view.frameBase(() =>
				view.frameBox(context.bounds, context.viewMargin ?? 1, contextOrientation, durationMs)
			);
			return;
		}
		const mesh = terrain;
		if (mesh && (force || opening)) view.frameBase(() => frameTerrain(mesh));
	}

	function updateAnalyticalLayers(before: World, world: World, mesh: TerrainMesh) {
		if (shown?.grid !== world.grid) {
			const { center, reachM, topM } = sectionSite(world);
			const waterM = world.grid.terrain.waterLevel;
			section.rebuild(
				center,
				[1, 0],
				reachM,
				[waterM - 9, topM],
				[{ parent: section.group, ground: mesh.sectionGround(), baseM: MODEL_BASE_Y_M, waterM }]
			);
			if (palette) section.setPalette(palette, mesh.waterColor());
			viewMode.frameSection();
			retainedDirty = true;
		}
		if (
			!shown ||
			before.lines !== world.lines ||
			shown.grid !== world.grid ||
			before.state.city !== world.state.city
		) {
			schematic.rebuild(world);
			retainedDirty = true;
		}
	}

	function updateVehicles(before: World, world: World, nextFocus: FocusId) {
		if (
			before.lines !== world.lines ||
			before.grid !== world.grid ||
			before.state.storyParts !== world.state.storyParts
		) {
			vehicles.setWorld(world);
			retainedDirty = true;
		}
		if (nextFocus !== focus) retainedDirty = true;
		vehicles.setFocus(nextFocus);
	}

	function worldShown(world: World, nextFocus: FocusId) {
		frames.show(world, nextFocus, Boolean(study.showFrameStudy || nextFocus === 'infrastructure'));
		focus = nextFocus;
		shown = world;
		canvas.dataset.updates = String(Number(canvas.dataset.updates ?? 0) + 1);
		shadowsDirty = true;
		viewDirty = true;
		styleDirty = true;
		viewMode.applyLayers(viewLayers());
		render();
	}

	function drawTarget(outline: readonly Vec3[]) {
		removeLines(target);
		target = polylineObject(outline.length ? [outline] : [], targetMaterial);
		if (target) {
			target.renderOrder = 11;
			viewMode.clip.add(target);
		}
	}

	// Theme colors: the terrain only changes uniforms; structures re-bake their vertex colors.
	const stopTheme = bindSceneTheme(canvas, scene, renderer, applyPalette);

	/**
	 * Applies a resolved camera and display to retained scene buffers.
	 * Plan retains the iso drafting scale, stroke selection and detail tier.
	 */
	function setView(resolved: ResolvedView, editable = false, durationMs = 0) {
		if (!editable && !viewMode.retainsDrafting && terrain)
			view.frameInspection(terrain.water.geometry, section.anchors);
		// A fixed perspective context keeps its inspection pose when it is reframed.
		const orientation =
			context?.viewOrientations?.[resolved.view === 'schematic' ? 'plan' : resolved.view];
		if (!viewMode.set(resolved, viewLayers(), editable && !lens, Boolean(orientation)))
			return false;
		if (orientation) {
			contextOrientation = orientation;
			frameCurrent(true, loop.reduced.matches ? 0 : durationMs);
		}
		invalidateView();
		return true;
	}

	return {
		ready: gpu.started,
		/** Freeze the scene at a timeline coordinate in seconds, or resume playback with undefined. */
		setTime: timeline.seek.bind(timeline),
		/** Hold playback at the displayed frame until resumed. */
		setPaused: timeline.pause.bind(timeline),
		view,
		render,
		/** Screen positions of the plan's retained section endpoints in CSS pixels. */
		sectionEndpoints: () => section.anchors?.map((point) => view.project(point)),
		/** Runs after the rendered camera and pick geometry are current. */
		afterFrame(listener: (affected?: Affected) => void) {
			frameListeners.add(listener);
			return () => {
				frameListeners.delete(listener);
			};
		},
		frameTimings: { worker: frames.timings, preview: frames.previewTimings },
		/** Keeps the camera fixed after the first drawing gesture. */
		endOpening() {
			opening = undefined;
		},
		/** Retains the current camera position on resize after the player moves it. */
		viewChanged(this: void) {
			opening = undefined;
			invalidateView();
		},
		/** Re-centers the opening once the HUD bounds are available. */
		setOpeningArea(area: OpeningArea) {
			if (!opening || study.frame) return;
			if (
				framedArea?.top === area.top &&
				framedArea.bottom === area.bottom &&
				framedArea.right === area.right &&
				framedArea.left === area.left &&
				framedArea.reserved === area.reserved
			)
				return;
			framedArea = area;
			openingPending = true;
			invalidateView();
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
			updateAnalyticalLayers(before, world, terrain);
			updateVehicles(before, world, nextFocus);
			worldShown(world, nextFocus);
		},
		/** Pauses vehicle simulation at its current pose. Other placement feedback continues. */
		setTransitPaused: timeline.pauseTransit.bind(timeline),
		/** Canvas size in CSS pixels. */
		resize(this: void, width: number, height: number) {
			renderer.setSize(width, height, false);
			view.resize(width, height);
			frameCurrent(Boolean(study.frame));
			invalidateView();
		},
		/** Axonometric view, or the plan seen from above. */
		setPlan(plan: boolean) {
			if (setView({ view: plan ? 'plan' : 'iso', display: 'normal' }, true)) opening = undefined;
		},
		/** Applies a resolved view. Fixed contexts may move the camera for up to 600 ms. */
		setView: (resolved: ResolvedView, durationMs = 0) => {
			setView(resolved, false, THREE.MathUtils.clamp(durationMs, 0, 600));
		},
		/** Picks the nearest visible house, tree or terrain cell in the current view. */
		pickCell(x: number, y: number) {
			if (!terrain || !shown) return undefined;
			prepareView();
			const cars = vehicles.group.visible
				? vehicles.group.children.filter((car) => car.visible)
				: [];
			return picker(
				x,
				y,
				shown.grid,
				[
					...structures.solids(KEY.installation),
					...housePickTargets(terrain, structures),
					...structures.solids(KEY.forest),
					...cars,
					terrain.water,
					...(viewMode.cut ? section.targets : [])
				],
				viewMode.cut
			);
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
				viewMode.clip.add(cursor);
			}
			viewMode.applyLayers(viewLayers());
			if (cursor || target) retainedDirty = true;
			render();
		},
		/** Keeps the rejected survey visible alongside a later brush guide. */
		setRejection(marks: readonly (readonly Vec3[])[]) {
			removeLines(rejection);
			rejection = polylineObject(marks, rejectionMaterial);
			if (rejection) {
				rejection.computeLineDistances();
				rejection.renderOrder = 12;
				viewMode.clip.add(rejection);
			}
			viewMode.applyLayers(viewLayers());
			if (rejection) retainedDirty = true;
			render();
		},
		dispose(this: void) {
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
			context?.dispose();
			frames.dispose();
			structures.dispose();
			section.dispose();
			schematic.dispose();
			warmTarget.dispose();
			pipeline.dispose();
			baseOutline.dispose();
			cursorMaterial.dispose();
			gpu.dispose();
		}
	};
}
