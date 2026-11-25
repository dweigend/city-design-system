import type { Vec2, Vec3 } from '../../lib/core/geometry';
import { columnRoof, createCityLattice } from '../../lib/domain/city-volume';
import type { ParcelBlock } from '../../lib/domain/parcels';
import { createFocusResolver, type DisplayLevel } from '../../lib/scene/focus';
import { houseLevels, paintHouseUse } from '../../lib/scene/house-projection';
import {
	projectMovement,
	projectTransitLine,
	type MovementDrawing
} from '../../lib/scene/paths-projection';
import { projectStructure } from '../../lib/scene/structure-projection';
import type { Drawable } from '../../lib/scene/surface';
import {
	readCityMovement,
	readCityRail,
	type CityMovementKind
} from '../../lib/world/city-movement';
import { riverCityRecipe } from '../../lib/world/city-site';
import { createCityStructure } from '../../lib/world/city-structure';
import { townHouseRecipe } from '../../lib/world/house-site';
import { readQuery } from '../architecture/query';
import { townSheet, townStage } from '../architecture/town';
import { crossingHeads, railDemo } from '../paths/demo';
import { createTownParks } from './parks';

const choices = {
	town: { label: 'Everything', subject: [] },
	plan: { label: 'Ground plan', subject: ['ground', 'parks'] },
	houses: { label: 'House functions', subject: ['houses'] },
	paths: { label: 'Paths and rail', subject: ['walkways', 'transit'] },
	structure: { label: 'Structure', subject: ['structure'] }
} as const;

const policy = {
	ground: { town: 'full', plan: 'full', houses: 'full', paths: 'full', structure: 'full' },
	parks: {
		town: 'full',
		plan: 'full',
		houses: 'full',
		paths: 'silhouette',
		structure: 'silhouette'
	},
	houses: {
		town: 'full',
		plan: 'hidden',
		houses: 'full',
		paths: 'silhouette',
		structure: 'silhouette'
	},
	walkways: { town: 'full', plan: 'hidden', houses: 'hidden', paths: 'full', structure: 'hidden' },
	transit: { town: 'full', plan: 'hidden', houses: 'hidden', paths: 'full', structure: 'hidden' },
	structure: {
		town: 'hidden',
		plan: 'hidden',
		houses: 'hidden',
		paths: 'hidden',
		structure: 'full'
	}
} as const;

/** The review view's focus: which subsystems of the whole town carry the picture. */
export const townFocus = createFocusResolver(choices, policy);

/** A focus choice of the review view. */
export type TownFocus = (typeof townFocus.choices)[number];

/** How much of the town a frame shows: all of it, the three study blocks, or one street block. */
export const townFrames = ['whole', 'quarter', 'street'] as const;

/** A framing preset of the review view. */
export type TownFrame = (typeof townFrames)[number];

type Subsystem = keyof typeof policy;

const movementDrawing: Record<CityMovementKind, MovementDrawing> = {
	lane: 'ground',
	bridge: 'bridge',
	stair: 'stairs',
	walkway: 'deck'
};

/** Builds the default town once: the Architecture whole-town sheet with its salience rule, the
 * Paths walking network and rail, and the primary structure of the district lattice. */
export function createTownReview() {
	const town = townStage(undefined, townHouseRecipe);
	const { setup } = readQuery(new URLSearchParams());
	const parkPlan = createTownParks(town);
	const sheet = townSheet(
		{ ...town, parcelsByBlock: parkPlan.parcelsByBlock },
		'all',
		setup,
		'mixed'
	);
	const parks = parkPlan.draw(sheet.unbuildable);
	const ground = new Set(town.context('all').drawables);
	const columns = [...town.columns.values()];
	const { site, layout, terrain } = town;
	const recipe = site.recipe ?? riverCityRecipe;
	const heads = crossingHeads(layout);
	const rail = readCityRail(site, layout, columns, railDemo(site, layout, heads));
	const movement = readCityMovement(site, layout, columns, 0, rail, heads);
	const paths = projectMovement(movement.network, movementDrawing, terrain).drawables;
	const transit = projectTransitLine(rail, terrain).drawables;
	let structure: readonly Drawable[] | undefined;
	const parts: [Subsystem, readonly Drawable[]][] = [
		['ground', sheet.drawables.filter((part) => ground.has(part))],
		['houses', sheet.drawables.filter((part) => !ground.has(part))],
		['parks', parks.drawables],
		['walkways', paths],
		['transit', transit]
	];
	const heights = sheet.points.map(([, , z]) => z);
	const wholeLow = Math.min(...heights);
	const wholeTop = Math.max(...heights);
	const outline = (blocks: readonly ParcelBlock[]) => {
		const blockHeights: number[] = [];
		for (const block of blocks) {
			for (const [x, y] of block.outline) blockHeights.push(site.sampleGround(x, y).height);
			for (const cellId of block.memberCellIds) {
				const column = town.columns.get(cellId);
				if (column) blockHeights.push(columnRoof(column, layout.datumZ, recipe.levelHeightM));
			}
		}
		const low = blockHeights.length ? Math.min(...blockHeights) : wholeLow;
		const top = blockHeights.length ? Math.max(...blockHeights) : wholeTop;
		return blocks.flatMap(({ outline: ring }) =>
			ring.flatMap(([x, y]: Vec2): Vec3[] => [town.toLocal([x, y, low]), town.toLocal([x, y, top])])
		);
	};
	const subjects: Record<TownFrame, readonly Vec3[]> = {
		whole: sheet.points,
		quarter: outline([town.blocks.block, town.blocks.neighbour, town.blocks.merged]),
		street: outline([town.blocks.block])
	};
	const kilometres = (kind: CityMovementKind) =>
		movement.network.edges
			.filter((edge) => edge.kind === kind)
			.reduce((sum, { lengthM }) => sum + lengthM, 0) / 1000;

	/** The lattice and its primary members are drawn only once the Structure focus asks for them. */
	function readStructure() {
		if (structure) return structure;
		const lattice = createCityLattice(columns, layout.datumZ, 'braced', recipe);
		const { graph } = createCityStructure(lattice, layout.datumZ, recipe.levelHeightM);
		structure = projectStructure(graph, {
			view: 'primary',
			supports: false,
			toLocal: town.toLocal
		});
		return structure;
	}

	return {
		subjects,
		figures: {
			houses: sheet.count,
			parks: parks.figures,
			unbuildable: sheet.unbuildable.length,
			triangles: sheet.triangles,
			walkwaysKm: kilometres('walkway'),
			railKm: (rail?.lengthM ?? 0) / 1000,
			stations: rail?.stations.length ?? 0
		},
		/** Every drawable of the town, styled by the focus. Shapes stay the same objects, so a focus
		 * change restyles the stage without building geometry. */
		draw(focus: TownFocus, transparent = false): readonly Drawable[] {
			const shown: [Subsystem, readonly Drawable[]][] =
				focus === 'structure' || structure ? [...parts, ['structure', readStructure()]] : parts;
			return shown.flatMap(([part, drawables]) => {
				const level = townFocus.readFocusLevel(focus, part);
				const uses = part === 'houses' && (focus === 'houses' || transparent) && level !== 'hidden';
				return drawables.map((drawable) => {
					const styled = style(drawable, level);
					return uses ? paintHouseUse(styled) : styled;
				});
			});
		}
	};
}

/** Hidden parts stay built and invisible. Context houses take their display level's mass look:
 * a silhouette is a plain neutral box (COLOR-6), opaque so the stage keeps it in its batches. */
function style(part: Drawable, level: DisplayLevel): Drawable {
	if (level === 'hidden') return { ...part, visible: false };
	if (level === 'full') return { ...part, visible: true };
	const { surfaces, fillAlpha } = houseLevels[level];
	return { ...part, ...surfaces.mass, fillAlpha, visible: true };
}
