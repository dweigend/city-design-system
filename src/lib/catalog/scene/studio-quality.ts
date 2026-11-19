export type StudioQuality = 'phone' | 'desktop' | 'high';

/** Picks pattern detail for this stage; headless recipe compilation uses reference detail. */
export function studioQuality(): StudioQuality {
	if (typeof location === 'undefined') return 'desktop';
	const requested = new URLSearchParams(location.search).get('quality');
	if (requested === 'phone' || requested === 'high' || requested === 'desktop') return requested;
	return matchMedia('(pointer: coarse)').matches ? 'phone' : 'desktop';
}
