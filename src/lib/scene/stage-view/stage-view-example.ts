import type { ComponentProps } from 'svelte';
import { stageExample } from '../stage';
import type { StageView } from './index';

/** Fixed props for a stage view in plan with a text description. */
export function example(): ComponentProps<typeof StageView> {
	return {
		drawables: stageExample().drawables,
		view: 'plan',
		display: 'normal',
		label: 'House footprint in plan'
	};
}
