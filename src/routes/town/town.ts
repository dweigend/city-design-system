import { defaults } from '../../config/town-review';
import type { Vec2, Vec3 } from '../../lib/core/geometry';
import { required } from '../../lib/core/invariant';
import { columnRoof, createCityLattice } from '../../lib/domain/city-volume';
import type { ParcelBlock } from '../../lib/domain/parcels';
import { createFocusResolver, type DisplayLevel } from '../../lib/scene/focus';
import { houseLevels, paintHouseUse } from '../../lib/scene/house-projection';
import {
	projectMovement,
	projectTransitLine,
	type MovementDrawing
} from '../../lib/scene/paths-projection';
import { createBuildQueue, type BuildJob } from '../../lib/scene/sandbox-interaction';
import { projectStructure } from '../../lib/scene/structure-projection';
import type { Drawable } from '../../lib/scene/surface';
import {
	createCityRailSurvey,
	readCityCrossingHeads,
	readCityMovement,
	readCityRail,
	type CityMovementKind
} from '../../lib/world/city-movement';
import { riverCityRecipe } from '../../lib/world/city-site';
import { createCityStructure } from '../../lib/world/city-structure';
import { townHouseRecipe } from '../../lib/world/house-site';
import { readQuery } from '../architecture/query';
import { prepareTownSheet, townStage } from '../architecture/town';
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

type TownParts = readonly (readonly [Subsystem, readonly Drawable[]])[];
type Drawing = Readonly<{ drawables: readonly Drawable[]; triangles: number }>;

const defaultSetup = readQuery(new URLSearchParams()).setup;

function styleParts(parts: TownParts, focus: TownFocus) {
	return parts.flatMap(([part, drawables]) => {
		const level = townFocus.readFocusLevel(focus, part);
		const uses = part === 'houses' && focus === 'houses';
		return drawables.map((drawable) => {
			const styled = style(drawable, level);
			return uses ? paintHouseUse(styled) : styled;
		});
	});
}

/** Builds the silhouette from occupancy, reserved parks and the walking and rail networks.
 * Garden geometry and the salient houses' faces and models are deferred until after rendering. */
export function createTownReview(seed = defaultSetup.seed) {
	const town = townStage(undefined, townHouseRecipe);
	const parkPlan = createTownParks(town);
	const sheet = prepareTownSheet(
		{ ...town, parcelsByBlock: parkPlan.parcelsByBlock },
		'all',
		{ ...defaultSetup, seed },
		'mixed'
	);
	const reserved = parkPlan.reservedPlantings.map(parkPlan.draw);
	const gardens = parkPlan.readGardens(sheet.unbuildable);
	const blocks = sheet.houses.map(({ id, build }) => ({ id, drawing: build() }));
	const columns = [...town.columns.values()];
	const { site, layout, terrain } = town;
	const recipe = site.recipe ?? riverCityRecipe;
	const heads = readCityCrossingHeads(layout);
	const rail = readCityRail(site, layout, columns, createCityRailSurvey(site, layout, heads));
	const movement = readCityMovement(site, layout, columns, 0, rail, heads);
	const paths = projectMovement(movement.network, movementDrawing, terrain).drawables;
	const transit = projectTransitLine(rail, terrain).drawables;
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

	function readStructure() {
		const lattice = createCityLattice(columns, layout.datumZ, 'braced', recipe);
		const { graph } = createCityStructure(lattice, layout.datumZ, recipe.levelHeightM);
		return {
			triangles: 0,
			drawables: projectStructure(graph, {
				view: 'primary',
				supports: false,
				toLocal: town.toLocal
			})
		};
	}

	function parts(details: ReadonlyMap<string, Drawing>, green: readonly Drawing[]): TownParts {
		return [
			['ground', sheet.drawables],
			['houses', blocks.flatMap(({ id, drawing }) => (details.get(id) ?? drawing).drawables)],
			['parks', green.flatMap(({ drawables }) => drawables)],
			['walkways', paths],
			['transit', transit]
		];
	}
	const silhouette = parts(new Map(), reserved);
	const figures = {
		houses: sheet.houses.length,
		unbuildable: sheet.unbuildable.length,
		walkwaysKm: kilometres('walkway'),
		railKm: (rail?.lengthM ?? 0) / 1000,
		stations: rail?.stations.length ?? 0
	};
	const completed = new Map<string, Drawing>();
	const gardenJobs = gardens.map((garden) => ({
		id: JSON.stringify(['garden', garden.garden.id]),
		run: () => parkPlan.draw(garden)
	}));
	let structureDrawables: readonly Drawable[] | undefined;
	const readStructureDrawables = () => (structureDrawables ??= readStructure().drawables);
	type Job = Pick<BuildJob<Drawing>, 'id' | 'run'>;
	let detailJobs: readonly Job[] | undefined;
	let cancelPass: (() => void) | undefined;

	function settle(houses: readonly Job[]) {
		const read = ({ id }: { id: string }) => required(completed.get(id), 'completed town drawing');
		const details = new Map(houses.map((job) => [job.id, read(job)]));
		const green = [...reserved, ...gardenJobs.map(read)];
		const settled = parts(details, green);
		return {
			figures: {
				...figures,
				triangles: [...details.values()].reduce((sum, { triangles }) => sum + triangles, 0),
				parks: {
					parks: reserved.filter(({ kind }) => kind === 'parks').length,
					shore: reserved.filter(({ kind }) => kind === 'shore').length,
					gardens: gardens.length,
					greenBlocks: parkPlan.greenBlocks,
					drawables: green.reduce((sum, { drawables }) => sum + drawables.length, 0),
					triangles: green.reduce((sum, { triangles }) => sum + triangles, 0)
				}
			},
			draw(focus: TownFocus): readonly Drawable[] {
				const all: TownParts =
					focus === 'structure' ? [...settled, ['structure', readStructureDrawables()]] : settled;
				return styleParts(all, focus);
			}
		};
	}

	return {
		subjects,
		figures: { ...figures, triangles: 0 },
		draw: (focus: TownFocus): readonly Drawable[] => styleParts(silhouette, focus),
		/** Creates work for one rendered request. Interrupted requests can reuse finished products
		 * for this review seed. Publish all finished geometry together so stage batches stay stable
		 * during the upgrade and subsequent non-structure focus changes are geometry-free. */
		createDetailPass(now: () => number) {
			cancelPass?.();
			const queue = createBuildQueue<Drawing>(now);
			let rendered = false;
			let open = true;
			let jobs: readonly Job[] | undefined;
			function cancel() {
				open = false;
				for (const { id } of jobs ?? []) queue.cancel(id);
			}
			cancelPass = cancel;
			return {
				confirmSilhouette() {
					rendered = true;
				},
				advance() {
					if (!rendered || !open) return;
					detailJobs ??= sheet
						.readDetails(defaults.detailedHouseCap)
						.map(({ id, build }) => ({ id, run: build }));
					if (!jobs) {
						jobs = [...detailJobs, ...gardenJobs];
						for (const job of jobs)
							if (!completed.has(job.id)) queue.submit({ ...job, key: job.id });
					}
					for (const id of queue.advance())
						completed.set(id, required(queue.read(id), 'built town drawing'));
					if (queue.readWaiting()) return;
					cancel();
					return settle(detailJobs);
				},
				cancel
			};
		}
	};
}

/** Hidden parts stay built and invisible. Context houses take their display level's mass look:
 * a silhouette is a plain neutral box (COLOR-6), opaque so the stage keeps it in its batches. */
function style(part: Drawable, level: DisplayLevel): Drawable {
	if (level === 'hidden') return { ...part, visible: false };
	if (level === 'full') return { ...part, visible: true };
	const { surfaces, fillAlpha } = houseLevels[level];
	return {
		...part,
		...surfaces.mass,
		fillAlpha,
		visible: true,
		hatch: undefined,
		grain: undefined,
		occlude: undefined,
		preserveColor: undefined,
		opacity: undefined
	};
}
