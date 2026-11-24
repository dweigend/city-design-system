import { createFocusResolver } from './index';

/** A composition with a foreground and its context, independent of any city projection. */
export function example() {
	return createFocusResolver(
		{ all: { label: 'All', subject: [] }, detail: { label: 'Detail', subject: ['subject'] } },
		{ subject: { all: 'full', detail: 'full' }, backdrop: { all: 'full', detail: 'hidden' } }
	);
}
