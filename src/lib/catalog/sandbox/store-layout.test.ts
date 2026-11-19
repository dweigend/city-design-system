import { expect, test } from 'bun:test';
import { watchStoreLayout } from './store-layout';

test('widening closes the Store popover before the mobile trigger returns', () => {
	const breakpoint = Object.assign(new EventTarget(), { matches: true });
	let mobile = false;
	let open = false;
	const stop = watchStoreLayout(
		breakpoint,
		(matches) => (mobile = matches),
		() => (open = false)
	);
	expect(mobile).toBe(true);
	open = true;
	breakpoint.matches = false;
	breakpoint.dispatchEvent(new Event('change'));
	expect(mobile).toBe(false);
	expect(open).toBe(false);

	breakpoint.matches = true;
	breakpoint.dispatchEvent(new Event('change'));
	expect(mobile).toBe(true);
	expect(open).toBe(false);
	stop();
});
