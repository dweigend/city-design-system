import { bulb, rod, drum } from '../../parts';
import { sitting, seat, type Action } from './props';
/** Positions a rigid figure and the tools it holds for the selected action. */
export function music(activity: 'drummer' | 'cellist', v: number): Action {
	if (activity === 'cellist') {
		const y = -0.39 + v * 0.15;
		return {
			pose: {
				...sitting(v),
				hands: [
					[0.42, y, 0.83],
					[0.37, 0.08, 1.37]
				]
			},
			props: [
				...seat(),
				bulb([0.47, 0, 0.56], 0.24, 1.28, 'skin'),
				bulb([0.44, 0, 0.84], 0.15, 1.3, 'skin'),
				rod([0.44, 0, 0.85], [0.36, 0, 1.61], 0.065, 'gear'),
				rod([0.44, y - 0.17, 0.83], [0.44, y + 0.41, 0.88], 0.06, 'gear'),
				rod([0.47, 0, 0], [0.47, 0, 0.36], 0.06, 'gear')
			]
		};
	}
	const z = 1.05 + 0.12 * v;
	return {
		pose: {
			...sitting(v),
			hands: [
				[0.37, -0.22, z],
				[0.39, 0.21, 1.27 - 0.11 * v]
			]
		},
		props: [
			...seat(),
			drum([0.63, 0, 0], 0.22, 0.45, 'gear'),
			drum([0.63, 0, 0.45], 0.38, 0.37, 'coat'),
			drum([0.63, 0, 0.82], 0.385, 0.08, 'skin'),
			rod([0.37, -0.22, z], [0.63, -0.16, z - 0.16], 0.06, 'skin'),
			rod([0.39, 0.21, 1.27 - 0.11 * v], [0.69, 0.15, 1.13 - 0.11 * v], 0.06, 'skin')
		]
	};
}
