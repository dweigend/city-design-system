import { massingSheet, massingSpecimen, massingVariants } from './massing';

export function run(phase: 'start' | 'comparison') {
	const house = massingSpecimen('rectangle', 'memphis', 3);
	const variant = phase === 'start' ? massingVariants[0] : massingVariants[1];
	const { drawables, storeys } = massingSheet(house, variant);
	return {
		stage: {
			drawables,
			view: 'iso' as const,
			fit: { bearing: (328 * Math.PI) / 180, elevation: Math.PI / 5 },
			label: variant.label === 'Setback' ? 'Setback from storey 3' : 'Massing before setback'
		},
		args: { startStorey: 3, depth: phase === 'start' ? 0 : 1 },
		metric: { label: 'Occupied storey cells', value: storeys.size }
	};
}
