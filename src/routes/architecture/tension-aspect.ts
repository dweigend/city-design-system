import { envelopeSheet } from './envelope-sheet';
import { studies } from './studies';

export function run(phase: 'start' | 'comparison') {
	const sagRatio = phase === 'start' ? 0 : 0.28;
	const { drawables } = envelopeSheet(sagRatio);
	return {
		stage: {
			drawables,
			view: 'iso' as const,
			fit: studies.envelope.fit,
			label: phase === 'start' ? 'Spanned canopy at zero sag' : 'Spanned canopy with sag'
		},
		args: { sagRatio },
		metric: { label: 'Surveyed canopy grips', value: 6 }
	};
}
