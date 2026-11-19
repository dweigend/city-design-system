import { bulb, rod, drum } from '../../parts';
import { panel } from '../../objects/forms';
import { feet, hands, upright, sitting, seat, type Action } from './props';
/** Positions a rigid figure and the tools it holds for the selected action. */
export function craft(activity: 'gardener' | 'potter' | 'painter', v: number): Action {
	const delta = v * 0.08;
	if (activity === 'gardener') {
		const handZ = 0.47 + delta;
		return {
			pose: {
				hip: 0.56,
				lean: 0.21,
				feet: feet(0.34, -0.45),
				hands: [
					[0.45, -0.22, handZ],
					[0.31, 0.22, 0.5]
				]
			},
			props: [
				panel(0.78, 0, 0, 0.68, 0.83, 0.24, 'gear'),
				bulb([0.78, 0, 0.31], 0.22, 0.72, 'coat'),
				rod([0.45, -0.22, handZ], [0.64, -0.24, 0.26], 0.06, 'skin')
			]
		};
	}
	if (activity === 'potter') {
		const r = 0.17 + delta;
		return {
			pose: { ...sitting(v), hands: hands(0.43, r, 0.81 + delta) },
			props: [
				...seat(),
				drum([0.6, 0, 0], 0.25, 0.56, 'gear'),
				drum([0.6, 0, 0.56], 0.41, 0.09, 'skin'),
				bulb([0.58, 0, 0.7 + delta], r, 0.95, 'coat')
			]
		};
	}
	const z = 1.19 + 0.17 * v;
	return {
		pose: {
			hip: upright,
			lean: 0.1,
			feet: feet(0.17, -0.17),
			hands: [
				[0.48, -0.19, z],
				[0.24, 0.25, 1.02]
			]
		},
		props: [
			...[-1, 1].map((s) => rod([0.78, s * 0.36, 0.08], [0.56, 0, 1.68], 0.075, 'gear')),
			panel(0.57, 0, 1.04, 0.12, 0.78, 0.7, 'skin'),
			rod([0.46, -0.19, z], [0.55, -0.05, z + 0.06], 0.06, 'coat')
		]
	};
}
