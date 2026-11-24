import { expect, test } from 'bun:test';
import { example } from './stage-view-example';

test('offers metric drawables and a description for its fixed view', () => {
	const props = example();
	expect(props.drawables.length).toBeGreaterThan(0);
	expect(props.view).toBe('plan');
	expect(props.label).toContain('footprint');
});
