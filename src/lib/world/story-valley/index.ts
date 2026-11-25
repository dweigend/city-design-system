/** Module: Composes the dated growth of a single seeded river settlement. */

import { defaults } from '../../../config/story-valley';
import { Random } from '../../core/random';
import { required } from '../../core/invariant';
import type { Vec3 } from '../../core/geometry';
import type { Part } from '../../core/object';
import type { StoreyProgram } from '../../domain/massing';
import { createCitySite, riverCityRecipe, type CitySite } from '../city-site';
import { createStoryReach } from './reach';

/** The authored event years of the valley, in chronological order. */
export const storyYears =
	/* Exact arithmetic: authored calendar dates, not simulation settings. */ [
		1955, 1985, 2012, 2030
	] as const;

/** One of the four recorded events in the fixed valley. */
export type StoryYear = (typeof storyYears)[number];

/** A dated, datum-addressed construction part and its state in the selected view. */
export type StoryPart = Readonly<{
	part: Part;
	builtYear: StoryYear;
	datumIndex: number;
	phase: StoreyProgram['phase'];
	use: StoreyProgram['use'];
}>;

const [settlement, crossingYear, infill, handover] = storyYears;
const hallId = 'riverside-hall';
const storeyHeightM = required(riverCityRecipe.storeyHeightM, 'uniform story storey height');

/** Source metadata for the architectural precedent and the valley's response to it. */
export const storyPrecedent = Object.freeze({
	project: 'Transformation of Tour Bois-le-Prêtre',
	architects: 'Lacaton & Vassal with Frédéric Druot',
	location: 'Paris',
	year: /* Exact arithmetic: documented project completion year. */ 2011,
	prizeYear: /* Exact arithmetic: documented prize year. */ 2021,
	principle: 'Never demolish, never remove or replace, always add, transform, and reuse!',
	projectUrl: 'https://www.lacatonvassal.com/index.php?idp=56',
	prizeUrl: 'https://www.pritzkerprize.com/laureates/anne-lacaton-and-jean-philippe-vassal',
	principleUrl:
		'https://cooper.edu/events-and-exhibitions/events/current-work-anne-lacaton-jean-phillippe-vassal-and-frederic-druot'
});

function createStorey(
	id: string,
	datumIndex: number,
	builtYear: StoryYear,
	use: StoryPart['use'],
	center: Vec3,
	size: Vec3
) {
	const part: Part = {
		id: `${id}/storey/${datumIndex}`,
		slot: 'mass',
		shape: { kind: 'box', center, size, rotation: /* Exact arithmetic: aligned with world XY. */ 0 }
	};
	return { part, datumIndex, builtYear, use };
}

function phaseAt(builtYear: StoryYear, year: StoryYear): StoryPart['phase'] {
	return builtYear === year ? 'addition' : 'retained';
}

type Plot = ReturnType<typeof createStoryReach>['plots'][number];

function createBuilding(
	site: CitySite,
	datumZ: number,
	{ id: siteId, center: [x, y], sideM }: Plot,
	{ builtYear, seed, isHall }: { builtYear: StoryYear; seed: number; isHall: boolean }
) {
	const id = isHall ? hallId : `holding/${siteId}`;
	const half = sideM / 2;
	const ground = [
		site.sampleGround(x, y).height,
		...[-half, half].flatMap((dx) =>
			[-half, half].map((dy) => site.sampleGround(x + dx, y + dy).height)
		)
	];
	const datumIndex = Math.ceil((Math.max(...ground) - datumZ) / storeyHeightM);
	const base = datumZ + datumIndex * storeyHeightM;
	let use: StoryPart['use'] = 'housing';
	if (isHall) use = 'public';
	else if (builtYear === crossingYear) use = 'workshop';
	const size = (height: number): Vec3 => [sideM, sideM, height];
	const plinthHeight = base - Math.min(...ground);
	const plinth = {
		id: `${id}/plinth/${datumIndex}`,
		slot: 'mass',
		shape: {
			kind: 'box',
			center: [x, y, base - plinthHeight / 2],
			size: size(plinthHeight),
			rotation: /* Exact arithmetic: aligned with world XY. */ 0
		}
	} as const satisfies Part;
	const storeys = [
		createStorey(
			id,
			datumIndex,
			builtYear,
			use,
			[x, y, base + storeyHeightM / 2],
			size(storeyHeightM)
		)
	];
	const added = isHall ? defaults.storyHallStoreys : Number(builtYear === infill);
	const upperSideM = sideM * defaults.storyUpperWidthShare;
	for (let level = 1; level <= added; level++) {
		storeys.push(
			createStorey(
				id,
				datumIndex + level,
				isHall ? handover : builtYear,
				isHall ? 'office' : use,
				[x, y, base + level * storeyHeightM + storeyHeightM / 2],
				[upperSideM, upperSideM, storeyHeightM]
			)
		);
	}
	return { id, siteId, builtYear, seed, plinth, storeys };
}

/** Builds one seeded valley, its dated snapshots, and the resolved hall adoption at handover.
 * The geometric record is created once from dry plan cells and a permanent vertical datum.
 * Reading an earlier year removes future work and changes only the display phase of the remainder. */
export function createStoryValley() {
	const seed = defaults.storyValleySeed;
	const site = createCitySite(undefined, { seed });
	const { window, plots, datumZ, bridge, crossingId, headIds } = createStoryReach(site, seed);
	const [firstCount, secondCount] = defaults.storyBuildingsByEvent;
	const random = Random.create({ seed });
	const buildings = plots.map((plot, index) =>
		createBuilding(site, datumZ, plot, {
			isHall: index === 0,
			builtYear: index < firstCount ? settlement : index < secondCount ? crossingYear : infill,
			seed: random.derive(plot.id).seed
		})
	);
	const crossing = { id: crossingId, headIds, builtYear: crossingYear, object: bridge };
	const snapshots = storyYears.map((year) => ({
		year,
		crossings: year >= crossing.builtYear ? [crossing] : [],
		buildings: buildings
			.filter(({ builtYear }) => builtYear <= year)
			.map(({ storeys, plinth, ...building }) => ({
				...building,
				parts: [
					{ ...storeys[0], part: plinth },
					...storeys.filter(({ builtYear }) => builtYear <= year)
				].map((record) => ({ ...record, phase: phaseAt(record.builtYear, year) }))
			}))
	}));
	const hall = buildings[0];
	return {
		seed,
		valley: site.valley,
		window,
		snapshots,
		adoption: {
			buildingId: hall.id,
			retainedPartId: hall.storeys[0].part.id,
			additionPartId: hall.storeys[1].part.id
		}
	};
}
