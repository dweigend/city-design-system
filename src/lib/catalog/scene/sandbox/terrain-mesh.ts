import { studioKeyDirection } from '../studio-light';
import { courtBankGeometry } from './court-bank-geometry';
/**
 * Terrain as a paper relief: the ground carries contour hairlines, the area grid appears as a
 * plan drawn onto the land, and painted land cover shows as tinted, patterned areas.
 * Everything is drawn in the surface shader from the grid's own chart, so patterns follow
 * the terrain exactly like the grid does.
 */
import * as THREE from 'three/webgpu';
import type { Node } from 'three/webgpu';
import {
	attribute,
	float,
	mix,
	normalWorldGeometry,
	texture,
	uniform,
	vec2,
	vec3
} from 'three/tsl';
import { resolveParams, type ParamOverrides } from '../../core/params';
import { plantingSurfaces } from './planting-surface';
import { COVER_KINDS, type CoverKind } from '../../logic/land-cover';
import { footbridgeGeometry, alleyOverlay } from './alley-overlay';
import type { TerrainGrid } from '../../logic/terrain-grid';
import type { Focus, Representation } from '../../logic/presentation';
import { flowToken } from '../../data/focus';
import { WEG_STROM } from '../../data/leitstil';
import type { Palette3D } from '../../data/city3d';
import { sceneSwatch } from '../scene-palette';
import { shiftedPaper } from './paper-inlay';
import { wakeGeometry, wakeInk, type Pier } from './pier-wakes';
import { riverInk } from './water-print';
import { baseGeometry, patchSurface, surfaceGeometry, waterGeometry } from './terrain-geometry';
import { TERRAIN_VIEW_PARAMS } from './view-params';

/** A constant screen-space field has no resolvable contour. */
const MIN_DERIVATIVE = 1e-6;

/** 1 on a line at every integer of `value`, antialiased; width in screen pixels. */
function hairline(value: Node<'float'>, widthPx: number): Node<'float'> {
	const derivative = value.fwidth();
	const distancePx = value.sub(0.5).fract().sub(0.5).abs().div(derivative.max(MIN_DERIVATIVE));
	const coverage = float(1).sub(distancePx.smoothstep(widthPx / 2 - 0.5, widthPx / 2 + 0.5));
	return coverage.mul(float(derivative.greaterThan(MIN_DERIVATIVE)));
}
/** 1 where line patterns of `value` are still resolvable on screen, 0 where they would alias. */
const resolvable = (value: Node<'float'>) => float(1).sub(value.fwidth().smoothstep(0.22, 0.55));

function coverTexture(grid: TerrainGrid) {
	const data = new Uint8Array(grid.columns * grid.rows * 4);
	const map = new THREE.DataTexture(data, grid.columns, grid.rows, THREE.RGBAFormat);
	map.magFilter = map.minFilter = THREE.LinearFilter;
	map.needsUpdate = true;
	return { data, map };
}

const floatUniform = (value: number) => uniform(value);

export type TerrainMesh = ReturnType<typeof createTerrainMesh>;

/**
 * Builds the terrain objects for a grid. The caller adds `group` to its scene and calls
 * `dispose` when the grid is replaced. Face index >> 1 of `surface` is the cell index.
 */
export function createTerrainMesh(
	grid: TerrainGrid,
	overrides?: ParamOverrides<typeof TERRAIN_VIEW_PARAMS>,
	shadeGround = (color: Node<'vec3'>) => color
) {
	const profile = resolveParams(TERRAIN_VIEW_PARAMS, undefined, overrides);
	const nodes = Object.fromEntries(
		Object.entries(profile).map(([key, value]) => [key, floatUniform(value)])
	) as Record<keyof typeof profile, ReturnType<typeof floatUniform>>;
	const paper = uniform(new THREE.Color());

	const parcelCells = nodes.parcelCells;
	const lensCells = nodes.lensCells;
	const lensInnerCells = uniform(profile.lensCells * 0.35);
	const planContourGain = nodes.planContourGain;
	const colors = {
		paper,
		ink: uniform(new THREE.Color()),
		blueprint: uniform(new THREE.Color()),
		soil: uniform(new THREE.Color()),
		pencil: uniform(new THREE.Color()),
		water: uniform(new THREE.Color()),
		waterStroke: uniform(new THREE.Color()),
		nature: uniform(new THREE.Color()),
		food: uniform(new THREE.Color()),
		people: uniform(new THREE.Color())
	};
	// Inverting a paper wash toward light ink would fill the night sheet with gray.
	const daylight = floatUniform(1);
	const warmPaper = mix(colors.paper, colors.soil, daylight.mul(0.3));
	const paperColor = mix(warmPaper, colors.ink, nodes.paperWash.mul(daylight));
	const terrainWeight = uniform(1),
		forestWeight = uniform(1),
		pathWeight = uniform(1);
	const cursor = uniform(new THREE.Vector2(-100, -100));
	const lensStrength = uniform(0);
	const gridStrength = uniform(0);
	const peopleFocus = uniform(0);
	const town = uniform(Number(Boolean(grid.courtFronts?.length)));
	const drawingInk = mix(colors.pencil, colors.ink, daylight);
	const cover = coverTexture(grid);
	const alleys = alleyOverlay(grid, profile, nodes);
	const chart = attribute('chart', 'vec2');
	const relief = attribute('relief', 'vec2');
	const height = relief.x;

	const seconds = uniform(0);

	function groundColor(): Node<'vec3'> {
		const masks = texture(cover.map, chart.div(vec2(grid.columns, grid.rows)));
		const inside = (mask: Node<'float'>) => mask.smoothstep(0.46, 0.54);
		const edge = (mask: Node<'float'>) =>
			float(1).sub(mask.sub(0.5).abs().div(mask.fwidth().max(MIN_DERIVATIVE)).smoothstep(0.4, 1.4));
		const drawing = town.mul(gridStrength.oneMinus()).oneMinus();
		const furrows = chart.y
			.mul(2)
			.fract()
			.smoothstep(0.42, 0.58)
			.mul(resolvable(chart.y.mul(2)));
		const dots = float(1).sub(chart.mul(2).fract().sub(0.5).length().smoothstep(0.1, 0.16));
		let ground: Node<'vec3'> = mix(
			paperColor,
			mix(paperColor, colors.nature, 0.48),
			inside(masks.r)
		);
		const field = mix(
			mix(paperColor, colors.food, 0.29),
			mix(paperColor, colors.food, 0.5),
			furrows.mul(drawing)
		);
		ground = mix(ground, field, inside(masks.g));
		const meadow = mix(
			mix(paperColor, colors.nature, 0.32),
			colors.nature,
			dots
				.mul(resolvable(chart.x.mul(2)))
				.mul(0.7)
				.mul(drawing)
		);
		ground = mix(ground, meadow, inside(masks.b));
		ground = mix(paperColor, ground, forestWeight.mul(mix(0.2, 1, drawing)));
		ground = mix(ground, drawingInk, attribute('bankShade', 'float').mul(terrainWeight));
		const slots = attribute('landform', 'vec3');
		ground = mix(ground, colors.soil, slots.x.mul(terrainWeight).mul(0.28));
		ground = mix(ground, colors.nature, slots.y.mul(forestWeight).mul(0.28));
		ground = mix(ground, colors.waterStroke, slots.z.mul(terrainWeight).mul(0.13));
		const bankLight = normalWorldGeometry.dot(vec3(studioKeyDirection));
		const riser = bankLight.oneMinus().smoothstep(0.22, 0.72).mul(slots.x);
		ground = mix(ground, drawingInk, riser.mul(0.19).mul(terrainWeight));
		const incision = relief.y.smoothstep(0, grid.profile.ravineDepth);
		const hatchPhase = attribute('position', 'vec3').x.add(height).div(nodes.hatchSpacing);
		const hatch = hairline(hatchPhase, 1).mul(resolvable(hatchPhase));
		ground = mix(
			ground,
			drawingInk,
			incision.mul(hatch).mul(1.28).mul(nodes.ravineTone).mul(terrainWeight).mul(drawing)
		);
		const outline = edge(masks.r).max(edge(masks.g)).max(edge(masks.b));

		const minor = hairline(height.div(nodes.minor), 1).mul(resolvable(height.div(nodes.minor)));
		const major = hairline(height.div(nodes.major), 1.2);
		const contour = minor.mul(nodes.contourMinor).max(major.mul(nodes.contourMajor));
		// In the plan the contours carry the image: they gain weight with the full grid.
		const weighted = contour.mul(gridStrength.mul(planContourGain).add(1));
		ground = mix(ground, drawingInk, weighted.mul(terrainWeight).mul(mix(0.18, 1, drawing)));
		ground = mix(ground, colors.ink, outline.mul(nodes.outline).mul(forestWeight).mul(drawing));

		ground = mix(
			ground,
			mix(paperColor, colors.nature, bankLight.oneMinus().clamp(0, 1).mul(0.3).add(0.22)),
			attribute('lawn', 'float').mul(terrainWeight)
		);

		const lens = float(1)
			.sub(chart.sub(cursor).length().smoothstep(lensInnerCells, lensCells))
			.mul(lensStrength);
		const cellLine = hairline(chart.x, 1).max(hairline(chart.y, 1)).mul(resolvable(chart.x));
		const parcelLine = hairline(chart.x.div(parcelCells), 1).max(
			hairline(chart.y.div(parcelCells), 1)
		);
		const near = float(1).sub(chart.fwidth().length().smoothstep(nodes.nearStart, nodes.nearEnd));
		const plan = cellLine
			.mul(lens.mul(near).max(gridStrength))
			.mul(nodes.cellInk)
			.max(parcelLine.mul(nodes.parcel));
		const plotted = mix(ground, colors.blueprint, plan.mul(terrainWeight));
		return alleys.shade(
			shadeGround(plotted),
			drawingInk,
			colors.people,
			paperColor,
			peopleFocus,
			pathWeight,
			daylight
		);
	}

	const surfaceMaterial = new THREE.MeshBasicNodeMaterial();
	surfaceMaterial.colorNode = groundColor();
	const surface = new THREE.Mesh(surfaceGeometry(grid), surfaceMaterial);
	surface.receiveShadow = true;
	const banks = new THREE.Mesh(courtBankGeometry(grid), surfaceMaterial);
	banks.receiveShadow = true;

	const waterMaterial = new THREE.MeshStandardNodeMaterial({ roughness: 0.34, metalness: 0.12 });
	waterMaterial.colorNode = mix(
		paperColor,
		riverInk(seconds, colors.water, paperColor, colors.waterStroke),
		terrainWeight
	);
	let piers: readonly Pier[] = [];
	const wakes = new THREE.Mesh(
		wakeGeometry(grid, piers),
		wakeInk(mix(colors.waterStroke, colors.paper, daylight.mul(0.92)), seconds, terrainWeight)
	);
	wakes.renderOrder = 1;
	const water = new THREE.Mesh(waterGeometry(grid), waterMaterial);
	water.receiveShadow = true;

	const baseMaterial = new THREE.MeshBasicNodeMaterial();
	baseMaterial.colorNode = mix(warmPaper, colors.ink, 0.28);
	const base = baseGeometry(grid);
	const baseMesh = new THREE.Mesh(base.geometry, baseMaterial);
	const tableShadow = new THREE.MeshBasicNodeMaterial({
		side: THREE.DoubleSide,
		depthWrite: false
	});
	tableShadow.vertexNode = shiftedPaper(vec2(1.6, -1.6));
	tableShadow.colorNode = mix(paperColor, colors.ink, 0.14);
	const footprint = new THREE.Mesh(base.geometry, tableShadow);
	footprint.renderOrder = -2;
	let baseLines = base.lines;
	let currentGrid = grid;

	const group = new THREE.Group();
	const deckMaterial = new THREE.MeshBasicNodeMaterial();
	deckMaterial.colorNode = mix(paperColor, colors.ink, nodes.footbridgeTone);
	const deck = new THREE.Mesh(footbridgeGeometry(grid), deckMaterial);
	group.add(footprint, surface, banks, water, wakes, baseMesh, deck);

	return {
		group,
		setTime(timeS: number) {
			seconds.value = timeS;
		},
		setAlleys: alleys.update,
		/** At block level, stair alleys retain their wash without individual treads. */
		setCityOverview: alleys.setCityOverview,
		/** Refit water wakes when the rail survey or wet terrain changes. */
		setPiers(next: TerrainGrid, feet: readonly Pier[]) {
			piers = feet;
			wakes.geometry.dispose();
			wakes.geometry = wakeGeometry(next, piers);
			water.geometry.dispose();
			water.geometry = waterGeometry(
				next,
				piers.map((p) => p.foot)
			);
		},
		surface,
		water,
		/** Replaces view overrides in schema units, restoring omitted fields to defaults.
		 * Updates the shader uniforms in place. Invalid values throw RangeError.
		 */
		setParams(overrides?: ParamOverrides<typeof TERRAIN_VIEW_PARAMS>) {
			const next = resolveParams(TERRAIN_VIEW_PARAMS, undefined, overrides);

			for (const key of Object.keys(next) as (keyof typeof next)[]) nodes[key].value = next[key];
			alleys.setParams(next);

			lensInnerCells.value = next.lensCells * 0.35;
		},
		/** World line segments of the model base outline, three.js coordinates. */
		baseLines: () => baseLines,
		/**
		 * Takes the cell positions of a re-derived grid with the same lattice. Colors, cover
		 * and materials stay; only the geometry is replaced.
		 */
		setGrid(next: TerrainGrid) {
			town.value = Number(Boolean(next.courtFronts?.length));
			const nextBase = baseGeometry(next);
			const replace = (mesh: THREE.Mesh, geometry: THREE.BufferGeometry) => {
				mesh.geometry.dispose();
				mesh.geometry = geometry;
			};
			replace(wakes, wakeGeometry(next, piers));
			replace(deck, footbridgeGeometry(next));
			replace(banks, courtBankGeometry(next));
			patchSurface(surface.geometry, currentGrid, next);
			currentGrid = next;
			replace(
				water,
				waterGeometry(
					next,
					piers.map((p) => p.foot)
				)
			);
			replace(baseMesh, nextBase.geometry);
			footprint.geometry = baseMesh.geometry;
			baseLines = nextBase.lines;
		},
		/** Applies theme colors; no geometry changes. */
		setPalette(palette: Palette3D) {
			const category = (token: string) => new THREE.Color(sceneSwatch(palette, token));
			colors.soil.value.set(palette.terrainSoil ?? palette.paper);
			colors.pencil.value.set(palette.ink3 ?? palette.ink);
			colors.paper.value.set(palette.paper);
			colors.ink.value.set(palette.ink);
			daylight.value = Number(colors.paper.value.r >= colors.ink.value.r);
			colors.blueprint.value.set(palette.blueprint);
			colors.water.value.set(palette.paper).lerp(category('--cat-health'), 0.55);
			const nightWater = sceneSwatch(palette, '--cat-health-1', '');
			if (!daylight.value && nightWater) colors.water.value.set(nightWater);
			const waterStroke = sceneSwatch(
				palette,
				'--cat-health-2',
				sceneSwatch(palette, '--cat-health')
			);
			colors.waterStroke.value.set(waterStroke);
			colors.nature.value.copy(category(plantingSurfaces.foliage.token));
			colors.people.value.copy(category(flowToken[WEG_STROM]));
			colors.food.value.copy(category('--cat-nature')).lerp(category('--cat-mobility'), 0.45);
		},
		/** Shows every cell line (strength 1) instead of only those under the lens (0). */
		setPresentation(view: Focus, highlightPeople: boolean) {
			peopleFocus.value = Number(highlightPeople);
			const weights: Record<Representation, number> = {
				full: 1,
				silhouette: 0.6,
				pencil: 0.27,
				transparent: 0.14,
				hidden: 0
			};
			const ghost = view.terrain === 'transparent';
			for (const material of [waterMaterial, surfaceMaterial, baseMaterial]) {
				if (material.transparent !== ghost) material.needsUpdate = true;
				material.transparent = ghost;
				material.depthWrite = !ghost;
				material.opacity = ghost ? weights.transparent : 1;
			}
			water.renderOrder = ghost ? 1 : 0;
			wakes.renderOrder = water.renderOrder + 1;
			terrainWeight.value = weights[view.terrain];
			forestWeight.value = weights[view.forest];
			pathWeight.value = weights[view.paths];
			deck.visible = view.paths !== 'hidden';
			group.visible = view.terrain !== 'hidden';
		},
		setGridVisible(strength: number) {
			gridStrength.value = strength;
		},
		/** Grid lens: chart position of the cursor in cells and its strength 0–1. */
		setLens(column: number, row: number, strength: number) {
			cursor.value.set(column, row);
			lensStrength.value = strength;
		},
		/** Writes the cover of one cell; call `commitCover` once after a batch. */
		setCover(cellIndex: number, kind: CoverKind | undefined) {
			COVER_KINDS.forEach((name, channel) => {
				cover.data[cellIndex * 4 + channel] = name === kind ? 255 : 0;
			});
		},
		commitCover() {
			cover.map.needsUpdate = true;
		},
		dispose() {
			for (const mesh of [surface, water, wakes, baseMesh, deck]) {
				mesh.geometry.dispose();
				mesh.material.dispose();
			}
			banks.geometry.dispose();
			tableShadow.dispose();
			alleys.dispose();
			cover.map.dispose();
		}
	};
}
