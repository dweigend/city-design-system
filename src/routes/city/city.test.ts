import { expect, test } from 'bun:test';
import { cityElevation } from '../../lib/scene/city-volume-projection';
import { readCityFit, readCityStep, readCityStepFocus, readCitySubject } from './city';

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
