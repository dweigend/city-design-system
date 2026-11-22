import { designPrinciples } from '../design-principles';
import { VALLEY_PICTURE_SEEDS } from '../valley-references';
import type { ChapterPreset, ChapterStep } from './types';

const registered = new Set(designPrinciples.map(({ id }) => id));
const presets = {
	valley: { scene: 'valley', seed: VALLEY_PICTURE_SEEDS[0] },
	acceptance: { scene: 'acceptance', seed: 7 }
} as const satisfies Record<ChapterPreset['scene'], ChapterPreset>;

type PlaceholderCopy = Pick<ChapterStep, 'title' | 'label' | 'caption' | 'principles' | 'view'> &
	Readonly<{ scene?: ChapterPreset['scene']; detailsLabel?: string }>;

/** Creates a step with real view controls and an existing scene while its demo is pending. */
export function placeholder(number: number, copy: PlaceholderCopy): ChapterStep {
	const { scene = 'acceptance', detailsLabel = 'Demo status', ...step } = copy;
	return {
		id: `step-${number}`,
		...step,
		principles: step.principles.filter((id) => registered.has(id)),
		preset: presets[scene],
		views: ['iso', 'plan', 'terrain'],
		display: 'normal',
		control: { kind: 'view', hint: 'Change the view in the stage.' },
		details: { label: detailsLabel, text: 'Status: placeholder · demo follows' }
	};
}
