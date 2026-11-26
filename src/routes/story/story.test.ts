import { beforeAll, expect, test } from 'bun:test';
import {
	createCityGrowth,
	createSandboxHandover,
	readCitySnapshot
} from '../../lib/world/city-growth';
import { readGeometryMatch } from '../../lib/scene/stage';
import { buildCivicEnvelope, buildCivicFrame, surveyObstructions, surveyRoofs } from './civic';
import { createStoryDrawing } from './drawing';
import {
	defaultSeed,
	foundStory,
	growStory,
	milestones,
	nextStorySeed,
	readStoryHandover,
	scheduleStoryStock,
	type StorySetup
} from './growth';
import {
	createStoryEncoder,
	createStoryTimeline,
	showStoryFrame,
	type StoryBatch
} from './timeline';

const setup = { seed: defaultSeed, preset: 'handover', planFamily: 'organic' } as const;
let start: ReturnType<typeof foundStory>;
let run: ReturnType<typeof growStory>;

beforeAll(() => {
	start = foundStory(setup);
	run = growStory(scheduleStoryStock(start, setup.preset));
}, 30_000);

test('2030 handover preserves the fixed milestone history and exact adopted stock', () => {
	const second = growStory(scheduleStoryStock(foundStory(setup), setup.preset));
	expect(second.events).toEqual(run.events);
	const history = milestones.map(({ year }) => readCitySnapshot(run, { kind: 'year', year }));
	expect(history.map(({ year }) => year)).toEqual([1955, 1985, 2012, 2030]);
	expect(history.map(({ eventCount }) => eventCount)).toEqual(
		history.map(({ eventCount }) => eventCount).toSorted((a, b) => a - b)
	);
	expect(history[0].crossings).toHaveLength(0);
	expect(history[1].crossings.length).toBeGreaterThan(0);
	expect(
		history[2].events.some(({ kind, year }) => kind === 'building-infill' && year === 2012)
	).toBe(true);
	const hall = readStoryHandover(run, start.adoptedId).adoption;
	if (!hall || !start.adoptedId)
		throw new Error('The handover needs its adopted founding building');
	const host = { kind: 'parcel', id: start.adoptedId } as const;
	const handover = createSandboxHandover(run);
	const restored = handover.restore(handover.serialize(handover.document));
	expect(restored.readPlacements()).toEqual(handover.document.readPlacements());
	expect(restored.readOrphans()).toHaveLength(0);
	const original = history[0].buildings.find(({ holdingId }) => holdingId === host.id);
	const adopted = handover.readStock(restored, host);
	if (!adopted || !('parts' in adopted))
		throw new Error('The parcel must resolve to dated building stock');
	const lower = adopted.parts.find(({ id }) => id === hall.retained.id);
	const upper = adopted.parts.find(({ id }) => id === hall.added.id);
	expect(lower).toMatchObject({ builtYear: 1955, phase: 'retained' });
	expect(lower?.shape).toEqual(original?.parts.find(({ id }) => id === hall.retained.id)?.shape);
	expect(upper).toMatchObject({ builtYear: 2030, phase: 'addition' });
	expect(upper?.datumIndex).toBe((lower?.datumIndex ?? 0) + 1);
}, 30_000);

const seedCases = [
	{ preset: 'village', planFamily: 'square' },
	{ preset: 'handover', planFamily: 'organic' },
	{ preset: 'metropolis', planFamily: 'hex' }
] as const satisfies readonly Omit<StorySetup, 'seed'>[];

for (const item of seedCases) {
	test(`New City changes the ${item.planFamily} valley and ${item.preset} history`, () => {
		const before = foundStory({ ...item, seed: defaultSeed });
		const after = foundStory({ ...item, seed: nextStorySeed(defaultSeed) });
		expect(after.site.valley.course.xy).not.toEqual(before.site.valley.course.xy);
		const left = growStory(scheduleStoryStock(before, item.preset));
		const right = growStory(scheduleStoryStock(after, item.preset));
		expect(right.recipe.planFamily).toBe(item.planFamily);
		expect(right.events.length).toBeGreaterThan(right.recipe.minimumFoundingHoldings);
		expect(right.events).not.toEqual(left.events);
		expect(readStoryHandover(right, after.adoptedId).placements).toBeGreaterThan(0);
	}, 30_000);
}

test('the grown city projects its committed public works and surveyed architecture', () => {
	const snapshot = readCitySnapshot(run);
	const types = new Set(snapshot.events.map(({ kind }) => kind));
	for (const kind of [
		'holding-split',
		'building-infill',
		'crossing-built',
		'rail-opened',
		'station-opened',
		'square-reserved',
		'asset-placed'
	] as const)
		expect(types.has(kind)).toBe(true);
	expect(
		new Set(snapshot.buildings.flatMap(({ parts }) => parts.map(({ styleId }) => styleId)))
	).toEqual(new Set(['neutral', 'memphis', 'archigram', 'organic']));
	expect(snapshot.assets.map(({ assetId }) => assetId)).toContain('sculpture/cantilever-totem');
	expect(snapshot.assets.map(({ assetId }) => assetId)).toContain('park/grove');
	expect(snapshot.assets.map(({ assetId }) => assetId)).toContain('access/walkway');

	const ground = ([x, y]: readonly [number, number]) => start.site.sampleGround(x, y).height;
	const roofs = surveyRoofs(
		snapshot.buildings.filter(({ holdingId }) => holdingId !== start.adoptedId),
		ground
	);
	const obstructions = surveyObstructions(
		snapshot.buildings.filter(({ holdingId }) => holdingId === start.adoptedId),
		ground
	);
	const civic = buildCivicFrame(roofs, obstructions, ground, defaultSeed);
	expect(
		civic?.frame.bearings.filter(({ support }) => support.kind === 'roof').length
	).toBeGreaterThan(1);
	expect(civic?.room.slots).toContain('dock-collar');
	const cover = buildCivicEnvelope(snapshot.squares[0].holding, ground);
	expect(cover?.canopy.slots).toContain('membrane');
	expect(cover?.bands.slots).toContain('envelope-band');
	expect(cover?.posts.parts).toHaveLength(1);
	for (const {
		position: [x, y, z]
	} of cover?.corners ?? [])
		expect(z).toBeGreaterThan(ground([x, y]));

	const drawing = createStoryDrawing(start.site, start.run, start.adoptedId);
	const frame = drawing.draw(snapshot);
	const parts = drawing.drain();
	const solid = showStoryFrame(frame, parts, 'assembled');
	const transparent = showStoryFrame(frame, parts, 'transparency');
	expect(solid.some(({ id }) => id.includes('rail-tracks'))).toBe(true);
	expect(solid.some(({ id }) => id.endsWith('dock-collar'))).toBe(true);
	expect(solid.some(({ id }) => id.endsWith('market-canopy/membrane'))).toBe(true);
	expect(solid.some(({ id }) => id.endsWith('market-frontage/envelope-band'))).toBe(true);
	expect(solid.some(({ id }) => id === 'tube-glazing')).toBe(true);
	expect(solid.find(({ id }) => id === 'service-pipe')?.visible).toBe(false);
	expect(transparent.find(({ id }) => id === 'service-pipe')?.visible).toBe(true);
	const exploded = showStoryFrame(frame, parts, 'explode');
	const section = showStoryFrame(frame, parts, 'section');
	expect(exploded.some(({ vertical }) => (vertical?.offset ?? 0) > 0)).toBe(true);
	expect(section.some(({ section }) => section?.normal[1] === 1)).toBe(true);
	expect(
		readGeometryMatch(
			solid.map((drawable) => ({ drawable })),
			exploded
		)
	).toBe(true);
	expect(
		readGeometryMatch(
			solid.map((drawable) => ({ drawable })),
			section
		)
	).toBe(true);
});

test('era cutters remove upper slices while keeping the original stock', () => {
	for (const styleId of ['archigram', 'organic'] as const) {
		const uncut = growStory(
			createCityGrowth(
				start.site,
				{
					...run.recipe,
					eras: run.recipe.eras?.map((era) =>
						era.styleId === styleId ? { ...era, setbackDepth: 0, porosityRatio: 0 } : era
					)
				},
				run.seed
			)
		);
		const slices = (history: typeof run) =>
			history.events.flatMap((event) =>
				event.kind === 'building-extended' || event.kind === 'building-infill'
					? event.parts.filter((part) => part.styleId === styleId)
					: []
			);
		expect(slices(run).length).toBeLessThan(slices(uncut).length);
		expect(run.events[0]).toEqual(uncut.events[0]);
	}
}, 30_000);

test('first frame decodes before growth batches and superseded requests cannot write to the timeline', () => {
	const drawing = createStoryDrawing(start.site, start.run, start.adoptedId);
	const first = drawing.draw(readCitySnapshot(start.run));
	const encode = createStoryEncoder();
	const timeline = createStoryTimeline(2);
	const founding: StoryBatch = structuredClone({
		requestId: 2,
		kind: 'batch',
		...encode(drawing.drain()),
		checkpoint: first,
		fit: drawing.fit,
		events: []
	});
	expect(timeline.accepts({ requestId: 1, kind: 'error' })).toBe(false);
	expect(timeline.append({ ...founding, requestId: 1 })).toBe(false);
	expect(timeline.parts).toHaveLength(0);
	expect(timeline.append(founding)).toBe(true);
	expect(timeline.checkpoints.get(1955)).toEqual(first);
	const opened = start.run.events.length;
	const next = drawing.draw(readCitySnapshot(run, { kind: 'event', index: opened }));
	expect(
		timeline.append(
			structuredClone({ requestId: 2, kind: 'batch', ...encode(drawing.drain()), events: [next] })
		)
	).toBe(true);
	const foundingDrawing = showStoryFrame(first, timeline.parts, 'assembled');
	const laterDrawing = showStoryFrame(next, timeline.parts, 'assembled');
	const shared = foundingDrawing.find(({ id }) =>
		laterDrawing.some(
			(part) =>
				part.id === id && part.color !== foundingDrawing.find((entry) => entry.id === id)?.color
		)
	);
	expect(shared).toBeDefined();
	expect(laterDrawing.find(({ id }) => id === shared?.id)?.shape).toBe(shared?.shape);
	expect(timeline.events).toEqual([next]);
});

test('coalesces coincident lane taps on square seed 1203 and resolves hex civic envelopes', () => {
	for (const preset of ['village', 'handover'] as const) {
		const squareStart = foundStory({ seed: 1203, preset, planFamily: 'square' });
		const squareRun = growStory(scheduleStoryStock(squareStart, preset));
		expect(squareRun.events.length).toBeGreaterThan(squareRun.recipe.minimumFoundingHoldings);
	}
	const hexStart = foundStory({ seed: defaultSeed, preset: 'handover', planFamily: 'hex' });
	const hexRun = growStory(scheduleStoryStock(hexStart, 'handover'));
	const hexSnapshot = readCitySnapshot(hexRun);
	const hexDrawing = createStoryDrawing(hexStart.site, hexStart.run, hexStart.adoptedId);
	const hexFrame = hexDrawing.draw(hexSnapshot);
	const hexSolid = showStoryFrame(hexFrame, hexDrawing.drain(), 'assembled');
	expect(hexSolid.some(({ id }) => id.endsWith('market-canopy/membrane'))).toBe(true);
	expect(hexSolid.some(({ id }) => id.endsWith('market-frontage/envelope-band'))).toBe(true);

	const organicDrawing = createStoryDrawing(start.site, start.run, start.adoptedId);
	const finalSnapshot = readCitySnapshot(run);
	organicDrawing.draw(finalSnapshot);
	const settled = organicDrawing.fitSettled(finalSnapshot);
	const span = (fit: typeof settled) =>
		Math.max(fit.subject?.halfWidth ?? Infinity, fit.subject?.halfHeight ?? Infinity);
	expect(span(settled)).toBeLessThan(span(organicDrawing.fit));
}, 30_000);
