import type { ChapterAspect } from '../ChapterViewer.svelte';

export const aspects = [
	{
		title: 'River meander',
		summary: 'The main channel starts with a shallow bend, then follows a longer curve.',
		load: () => import('./aspects/meander'),
		source: () => import('./aspects/meander.ts?raw')
	},
	{
		title: 'Valley relief and contours',
		summary: 'Low terraces rise into steeper slopes as relief increases.',
		load: () => import('./aspects/relief'),
		source: () => import('./aspects/relief.ts?raw')
	},
	{
		title: 'Tributary runoff and side-lake',
		summary: 'The tributaries and side-lake start at low runoff. More flow widens the channels.',
		load: () => import('./aspects/tributary'),
		source: () => import('./aspects/tributary.ts?raw')
	}
] satisfies readonly ChapterAspect[];
