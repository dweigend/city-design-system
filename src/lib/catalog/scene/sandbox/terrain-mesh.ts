/**
 * Terrain as a paper relief: the ground carries contour hairlines, the area grid appears as a
 * plan drawn onto the land, and painted land cover shows as tinted, patterned areas.
 * Everything is drawn in the surface shader from the grid's own chart, so patterns follow
 * the terrain exactly like the grid does.
 */
import * as THREE from 'three/webgpu';
import type { Node } from 'three/webgpu';
import { attribute, float, mix, texture, uniform, vec2 } from 'three/tsl';
import { defineParams, numberParam, resolveParams } from '../../logic/params';
import { COVER_KINDS, type CoverKind } from '../../logic/land-cover';
import { bridgeGeometry, streetOverlay } from './street-overlay';
import type { TerrainGrid } from '../../logic/terrain-grid';
import type { Focus, Representation } from '../../logic/presentation';
import type { Palette3D } from '../../data/city3d';
import { baseGeometry, surfaceGeometry, waterGeometry } from './terrain-geometry';

/** Contour intervals in meters. */
const reliefProfile = resolveParams(
	defineParams({
		minor: numberParam('Minor contour interval', 'm', 0.5, [0.25, 2, 0.25]),
		major: numberParam('Major contour interval', 'm', 5, [2, 10, 1]),
		ravineTone: numberParam('Ravine wash', 'ratio', 0.1, [0, 1, 0.01]),
		hatchSpacing: numberParam('Ravine hatch spacing', 'm', 4, [1, 10, 1]),
		paperWash: numberParam('Paper wash', 'ratio', 0.045, [0, 0.25, 0.005])
	})
);
/** Cells per parcel line of the measure chain (10 cells of 5 m = 50 m). */
const PARCEL_CELLS = 10;
/** Radius of the grid lens around the cursor, in cells. */
const LENS_RADIUS = 11;
/** Extra weight of the contour lines when the whole grid is shown. */
const PLAN_CONTOUR_GAIN = 0.9;
const INK_SHARE = {
	contourMinor: 0.2,
	contourMajor: 0.44,
	parcel: 0.16,
	outline: 0.55
};

/** 1 on a line at every integer of `value`, antialiased; width in screen pixels. */
function hairline(value: Node<'float'>, widthPx: number): Node<'float'> {
	const distancePx = value.sub(0.5).fract().sub(0.5).abs().div(value.fwidth().max(1e-6));
	return float(1).sub(distancePx.smoothstep(widthPx / 2 - 0.5, widthPx / 2 + 0.5));
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

export type TerrainMesh = ReturnType<typeof createTerrainMesh>;

/**
 * Builds the terrain objects for a grid. The caller adds `group` to its scene and calls
 * `dispose` when the grid is replaced. Face index >> 1 of `surface` is the cell index.
 */
export function createTerrainMesh(grid: TerrainGrid) {
	const colors = {
		paper: uniform(new THREE.Color()),
		ink: uniform(new THREE.Color()),
		blueprint: uniform(new THREE.Color()),
		water: uniform(new THREE.Color()),
		nature: uniform(new THREE.Color()),
		food: uniform(new THREE.Color()),
		people: uniform(new THREE.Color())
	};
	const terrainWeight = uniform(1),
		forestWeight = uniform(1),
		pathWeight = uniform(1);
	const cursor = uniform(new THREE.Vector2(-100, -100));
	const lensStrength = uniform(0);
	const gridStrength = uniform(0);
	const cover = coverTexture(grid);
	const streets = streetOverlay(grid);
	const chart = attribute('chart', 'vec2');
	const relief = attribute('relief', 'vec2');
	const height = relief.x;

	function waterColor(): Node<'vec3'> {
		const flow = hairline(chart.y.mul(0.5), 1)
			.mul(resolvable(chart.y.mul(0.5)))
			.mul(0.5);
		return mix(colors.paper, mix(colors.water, colors.paper, flow), terrainWeight);
	}

	function groundColor(): Node<'vec3'> {
		const masks = texture(cover.map, chart.div(vec2(grid.columns, grid.rows)));
		const inside = (mask: Node<'float'>) => mask.smoothstep(0.46, 0.54);
		const edge = (mask: Node<'float'>) =>
			float(1).sub(mask.sub(0.5).abs().div(mask.fwidth().max(1e-6)).smoothstep(0.4, 1.4));
		const furrows = chart.y
			.mul(2)
			.fract()
			.smoothstep(0.42, 0.58)
			.mul(resolvable(chart.y.mul(2)));
		const dots = float(1).sub(chart.mul(2).fract().sub(0.5).length().smoothstep(0.1, 0.16));
		let ground: Node<'vec3'> = mix(
			colors.paper,
			mix(colors.paper, colors.nature, 0.3),
			inside(masks.r)
		);
		const field = mix(
			mix(colors.paper, colors.food, 0.16),
			mix(colors.paper, colors.food, 0.5),
			furrows
		);
		ground = mix(ground, field, inside(masks.g));
		const meadow = mix(
			mix(colors.paper, colors.nature, 0.12),
			colors.nature,
			dots.mul(resolvable(chart.x.mul(2))).mul(0.7)
		);
		ground = mix(ground, meadow, inside(masks.b));
		ground = mix(colors.paper, ground, forestWeight);
		const incision = relief.y.smoothstep(0, grid.profile.ravineDepth);
		const hatchPhase = attribute('position', 'vec3').x.add(height).div(reliefProfile.hatchSpacing);
		const hatch = hairline(hatchPhase, 1).mul(resolvable(hatchPhase));
		ground = mix(
			ground,
			colors.ink,
			incision.mul(hatch.add(1)).mul(reliefProfile.ravineTone).mul(terrainWeight)
		);
		const outline = edge(masks.r).max(edge(masks.g)).max(edge(masks.b));

		const minor = hairline(height.div(reliefProfile.minor), 1).mul(
			resolvable(height.div(reliefProfile.minor))
		);
		const major = hairline(height.div(reliefProfile.major), 1.2);
		const contour = minor.mul(INK_SHARE.contourMinor).max(major.mul(INK_SHARE.contourMajor));
		// In the plan the contours carry the image: they gain weight with the full grid.
		const weighted = contour.mul(gridStrength.mul(PLAN_CONTOUR_GAIN).add(1));
		ground = mix(
			ground,
			colors.ink,
			weighted.mul(terrainWeight).max(outline.mul(INK_SHARE.outline).mul(forestWeight))
		);

		const lens = float(1)
			.sub(
				chart
					.sub(cursor)
					.length()
					.smoothstep(LENS_RADIUS * 0.35, LENS_RADIUS)
			)
			.mul(lensStrength);
		const cellLine = hairline(chart.x, 1).max(hairline(chart.y, 1)).mul(resolvable(chart.x));
		const parcelLine = hairline(chart.x.div(PARCEL_CELLS), 1).max(
			hairline(chart.y.div(PARCEL_CELLS), 1)
		);
		const near = float(1).sub(
			chart.fwidth().length().smoothstep(grid.profile.nearStart, grid.profile.nearEnd)
		);
		const plan = cellLine
			.mul(lens.mul(near).max(gridStrength))
			.mul(grid.profile.cellInk)
			.max(parcelLine.mul(INK_SHARE.parcel));
		return streets.shade(
			mix(ground, colors.blueprint, plan.mul(terrainWeight)),
			colors.ink,
			colors.people,
			pathWeight
		);
	}

	const surfaceMaterial = new THREE.MeshBasicNodeMaterial();
	surfaceMaterial.colorNode = groundColor();
	const surface = new THREE.Mesh(surfaceGeometry(grid), surfaceMaterial);
	surface.receiveShadow = true;

	const waterMaterial = new THREE.MeshLambertNodeMaterial();
	waterMaterial.colorNode = waterColor();
	const water = new THREE.Mesh(waterGeometry(grid), waterMaterial);
	water.receiveShadow = true;

	const baseMaterial = new THREE.MeshLambertNodeMaterial();
	baseMaterial.colorNode = mix(colors.paper, colors.ink, 0.05);
	const base = baseGeometry(grid);
	const baseMesh = new THREE.Mesh(base.geometry, baseMaterial);
	let baseLines = base.lines;

	const group = new THREE.Group();
	const deckMaterial = new THREE.MeshLambertNodeMaterial();
	deckMaterial.colorNode = mix(colors.paper, colors.ink, grid.profile.bridgeTone);
	const deck = new THREE.Mesh(bridgeGeometry(grid), deckMaterial);
	group.add(surface, water, baseMesh, deck);

	return {
		group,
		setStreets: streets.update,
		surface,
		/** World line segments of the model base outline, three.js coordinates. */
		baseLines: () => baseLines,
		/**
		 * Takes the cell positions of a re-derived grid with the same lattice. Colors, cover
		 * and materials stay; only the geometry is replaced.
		 */
		setGrid(next: TerrainGrid) {
			const nextBase = baseGeometry(next);
			const replace = (mesh: THREE.Mesh, geometry: THREE.BufferGeometry) => {
				mesh.geometry.dispose();
				mesh.geometry = geometry;
			};
			replace(deck, bridgeGeometry(next));
			replace(surface, surfaceGeometry(next));
			replace(water, waterGeometry(next));
			replace(baseMesh, nextBase.geometry);
			baseLines = nextBase.lines;
		},
		/** Applies theme colors; no geometry changes. */
		setPalette(palette: Palette3D) {
			const category = (name: string) => new THREE.Color(palette.categories[name]);
			colors.paper.value
				.set(palette.paper)
				.lerp(new THREE.Color(palette.ink), reliefProfile.paperWash);
			colors.ink.value.set(palette.ink);
			colors.blueprint.value.set(palette.blueprint);
			colors.water.value.set(palette.paper).lerp(category('health'), 0.42);
			colors.nature.value.copy(category('nature'));
			colors.people.value.copy(category('business'));
			colors.food.value.copy(category('nature')).lerp(category('mobility'), 0.45);
		},
		/** Shows every cell line (strength 1) instead of only those under the lens (0). */
		setPresentation(view: Focus) {
			const weights: Record<Representation, number> = {
				full: 1,
				silhouette: 0.6,
				pencil: 0.27,
				transparent: 0.14,
				hidden: 0
			};
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
			for (const mesh of [surface, water, baseMesh, deck]) {
				mesh.geometry.dispose();
				mesh.material.dispose();
			}
			streets.dispose();
			cover.map.dispose();
		}
	};
}
