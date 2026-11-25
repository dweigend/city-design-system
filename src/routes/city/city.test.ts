import { expect, test } from 'bun:test';
import { get, derived } from 'svelte/store';
import { cityVolumeParams, createCityLattice, readCityColumns } from '../../lib/domain/city-volume';
import { cityElevation, projectCityTerrain } from '../../lib/scene/city-volume-projection';
import {
	citySiteParams,
	createCitySite,
	readCityDistricts,
	readCityGrid,
	readCityParcels,
	type CitySite
} from '../../lib/world/city-site';
import {
	createCitySlider,
	readCityFit,
	readCityStep,
	readCityStepFocus,
	readCitySubject
} from './city';

test('chooses step-appropriate focus and recognizes the water-plan overlay', () => {
	const shares = { detached: 0.4, block: 0.6, center: 0 };
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
});

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
		const planLines = terrain.projectWetPlan(plan.selectedCrossings, holdings.mergedUnits);
		const parcelDrawables = terrain.projectParcels(holdings);
		const focus = readCityStepFocus('03', districts.shares, [...planLines, ...parcelDrawables]);
		return {
			gridCells: plan.grid.cells,
			planCells: plan.plan.cells,
			districts,
			columns,
			lattice,
			mergedUnits: holdings.mergedUnits,
			planLines,
			parcelDrawables,
			focus: { active: focus.active, items: focus.items },
			measurements: {
				area: plan.areaKm2,
				cellCount: plan.plan.cells.length,
				peak: districts.peakHeight
			}
		};
	};

	const committed = generated[generated.length - 1];
	expect(committed.holdings.mergedUnits.length).toBeGreaterThan(0);
	const query = readGeometry(
		createCitySite(undefined, { seed }),
		get(createCitySlider(sizeParam, 4000)),
		get(createCitySlider(heightParam, 63)),
		get(createCitySlider(complexityParam, 0.57))
	);
	expect(JSON.stringify(readOutput(committed))).toBe(JSON.stringify(readOutput(query)));
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
