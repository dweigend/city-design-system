import { expect, mock, test } from 'bun:test';
import { get, derived } from 'svelte/store';
import { cityVolumeParams, createCityLattice, readCityColumns } from '../../lib/domain/city-volume';
import {
	cityElevation,
	projectCityDistricts,
	projectCityTerrain
} from '../../lib/scene/city-volume-projection';
import {
	citySiteParams,
	createCitySite,
	readCityDistricts,
	readCityGrid,
	readCityParcels,
	riverCityRecipe,
	type CitySite
} from '../../lib/world/city-site';
import {
	createCitySlider,
	readCityFit,
	readCityPlanDrawables,
	readCityStep,
	readCityStepDrawables,
	readCityStepFocus,
	readCitySubject,
	readCitySubjectPoints
} from './city';

test('chooses step-appropriate focus and recognizes the water-plan overlay', () => {
	const shares = { detached: 0.4, block: 0.4, center: 0.2 };
	const water = [{ id: 'water-plan' }];
	const overlays = [...water, { id: 'dry-plan' }];
	const offersLandscape = (drawables: typeof overlays) =>
		readCityStepFocus('01', shares, drawables).items.some(({ value }) => value === 'landscape');
	expect(offersLandscape(water)).toBe(true);
	expect(offersLandscape([])).toBe(false);
	expect(readCityStep(null)).toBe('03');
	expect(readCityStep('unknown')).toBe('03');
	expect(readCityStep('02')).toBe('02');
	expect(readCityStepFocus(readCityStep('01'), shares, overlays, 'lattice').active).toBe('plan');
	expect(readCityStepFocus('02', shares, overlays, 'lattice').active).toBe('all');
	expect(readCityStepFocus('03', shares, overlays, 'lattice').active).toBe('lattice');
	expect(readCityStepFocus('03', shares, overlays, 'height').analysis).toBe('height');

	const withHoldings = [...overlays, { id: 'holding-outlines' }, { id: 'larger-holdings' }];
	const choices = (step: '01' | '02' | '03') =>
		readCityStepFocus(step, shares, withHoldings).items.map(({ value }) => value);
	const districts = ['center', 'block', 'detached'] as const;
	const ground = ['landscape', 'parcels', 'plan'] as const;
	expect(choices('01')).toEqual(['all', ...ground]);
	expect(choices('02')).toEqual(['all', ...districts, 'height', ...ground]);
	expect(choices('03')).toEqual(['all', 'districts', ...districts, 'lattice', 'height', ...ground]);
});

test('projects districts and lattice only on the steps that display them', () => {
	const projectDistricts = mock(() => []);
	const projectLattice = mock(() => []);
	readCityStepDrawables('01', projectDistricts, projectLattice);
	expect(projectDistricts).not.toHaveBeenCalled();
	expect(projectLattice).not.toHaveBeenCalled();
	readCityStepDrawables('02', projectDistricts, projectLattice);
	expect(projectDistricts).toHaveBeenCalledTimes(1);
	expect(projectLattice).not.toHaveBeenCalled();
	readCityStepDrawables('03', projectDistricts, projectLattice);
	expect(projectDistricts).toHaveBeenCalledTimes(2);
	expect(projectLattice).toHaveBeenCalledTimes(1);
});

test.each([
	['organic', 0.5, 4000],
	['square', 0, 8000],
	['hex', 1, 800]
] as const)(
	'lightweight %s framing matches the district envelope',
	(grid, relief, size) => {
		const seed = 42;
		const city = createCitySite(undefined, { seed, relief });
		const plan = readCityGrid(city, size, grid, seed);
		const columns = readCityColumns(plan.grid, readCityDistricts(city, plan, seed));
		const { levelHeightM } = city.recipe ?? riverCityRecipe;
		const terrain = projectCityTerrain(city, plan.grid, plan.plan);
		const envelope = projectCityDistricts(
			columns,
			plan.datumZ,
			terrain,
			undefined,
			seed,
			undefined,
			levelHeightM
		);
		expect(columns.length).toBeGreaterThan(0);
		for (const view of ['iso', 'plan'] as const) {
			const full = readCitySubject(view, relief, envelope.points());
			const light = readCitySubject(
				view,
				relief,
				readCitySubjectPoints(columns, plan.datumZ, terrain, levelHeightM)
			);
			expect(light).toBeDefined();
			// The extreme vertices are identical. Interior wall levels cannot extend the frame.
			expect(light).toEqual(full);
		}
	},
	30_000
);

test('city slider drafts generate once on commit and match direct query inputs', () => {
	const seed = 42;
	const city = createCitySite(undefined, { seed });
	const { citySize: sizeParam } = citySiteParams;
	const { height: heightParam, complexity: complexityParam } = cityVolumeParams;
	const size = createCitySlider(sizeParam, 1000);
	const height = createCitySlider(heightParam, 21);
	const complexity = createCitySlider(complexityParam, 0);

	const readGeometry = (site: CitySite, citySize: number, height: number, complexity: number) => {
		const plan = readCityGrid(site, citySize, 'organic', seed);
		const districts = readCityDistricts(site, plan, seed, { height, complexity });
		const columns = readCityColumns(plan.grid, districts);
		const holdings = readCityParcels(site, plan);
		const lattice = createCityLattice(columns, plan.datumZ);
		return { site, plan, districts, columns, holdings, lattice };
	};
	const generated: ReturnType<typeof readGeometry>[] = [];
	const stop = derived([size, height, complexity], ([size, height, complexity]) =>
		readGeometry(city, size, height, complexity)
	).subscribe((geometry) => generated.push(geometry));

	try {
		for (const [control, ticks, value] of [
			[size, [1600, 2800, 4000], 4000],
			[height, [35, 49, 63], 63],
			[complexity, [0.17, 0.33, 0.57], 0.57]
		] as const) {
			const before = generated.length;
			for (const tick of ticks) {
				control.draft.set(tick);
				expect(get(control.draft)).toBe(tick);
				expect(generated).toHaveLength(before);
			}
			control.commit(value);
			expect(generated).toHaveLength(before + 1);
			control.commit(value);
			expect(generated).toHaveLength(before + 1);
		}
	} finally {
		stop();
	}

	const readOutput = ({
		site,
		plan,
		districts,
		columns,
		holdings,
		lattice
	}: ReturnType<typeof readGeometry>) => {
		const terrain = projectCityTerrain(site, plan.grid, plan.plan);
		const { planLines, parcelDrawables } = readCityPlanDrawables(
			terrain,
			plan.selectedCrossings,
			holdings
		);
		const overlays = [...planLines, ...parcelDrawables];
		const focus = (['01', '02', '03'] as const).map((step) =>
			readCityStepFocus(step, districts.shares, overlays)
		);
		return {
			gridCells: plan.grid.cells,
			planCells: plan.plan.cells,
			districts,
			columns,
			lattice,
			mergedUnits: holdings.mergedUnits,
			planLines,
			parcelDrawables,
			focus: focus.map(({ active, items }) => ({ active, items })),
			measurements: {
				area: plan.areaKm2,
				cellCount: plan.plan.cells.length,
				peak: districts.peakHeight
			}
		};
	};

	const committed = generated[generated.length - 1];
	expect(committed.holdings.mergedUnits.length).toBeGreaterThan(0);
	const committedOutput = readOutput(committed);
	const unmergedPlanLines = projectCityTerrain(
		committed.site,
		committed.plan.grid,
		committed.plan.plan
	).projectWetPlan(committed.plan.selectedCrossings);
	const linePoints = (drawables: typeof committedOutput.planLines) =>
		drawables.reduce(
			(sum, drawable) =>
				sum +
				(drawable.strokeSegments?.length ??
					(drawable.shape.kind === 'mesh' ? drawable.shape.positions.length : 0)),
			0
		);
	expect(linePoints(committedOutput.planLines)).toBeLessThan(linePoints(unmergedPlanLines));
	expect(committedOutput.parcelDrawables.length).toBeGreaterThan(0);
	const query = readGeometry(
		createCitySite(undefined, { seed }),
		get(createCitySlider(sizeParam, 4000)),
		get(createCitySlider(heightParam, 63)),
		get(createCitySlider(complexityParam, 0.57))
	);
	expect(JSON.stringify(committedOutput)).toBe(JSON.stringify(readOutput(query)));
}, 30_000);

test('fits the city with relief-dependent fill and preserves explicit navigation', () => {
	const subject = readCitySubject('iso', 0.5, [
		[0, 0, 0],
		[1, 2, 3]
	]);
	const fit = (width: number | undefined) => readCityFit(0.5, subject, width, [4, -5]);
	expect(fit(undefined).width).toBeUndefined();
	expect(fit(0).width).toBeUndefined();
	expect(fit(-1).width).toBe(120);
	expect(fit(500).width).toBe(500);
	expect(fit(500).fill).toBe(0.92 - 0.2 * 0.5);
	expect(fit(500).offset).toEqual([4, -5]);
	expect(fit(500).subject).toBeDefined();
	expect(fit(500).elevationAtWidth?.(500)).toBe(cityElevation(0.5, 500));
});
