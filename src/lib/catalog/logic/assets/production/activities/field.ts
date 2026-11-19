import { drum, bulb, ring } from '../../parts';
import { panel } from '../../objects/forms';
import { feet, hands, upright, type Action } from './props';
/** Positions a rigid figure and the tools it holds for the selected action. */
export function field(activity: 'porter' | 'bowler' | 'photographer', v: number): Action {
	if (activity === 'porter') {
		const z = 1.35 + 0.12 * v;
		return {
			pose: {
				hip: upright,
				lean: -0.1,
				feet: feet(0.16, -0.18),
				hands: [
					[-0.03, -0.23, z],
					[0.22, 0.23, z]
				]
			},
			props: [
				panel(0.1, 0, z + 0.04, 0.66, 0.56, 0.1, 'gear'),
				...[-1, 1].map((s) => drum([0.1, s * 0.16, z + 0.14], 0.11, 0.22, 'skin'))
			]
		};
	}
	if (activity === 'bowler') {
		const x = 0.54 - v * 0.24;
		return {
			pose: {
				hip: 0.73,
				lean: 0.21,
				feet: feet(0.4, -0.31),
				hands: [
					[x, -0.26, 0.69 + v * 0.11],
					[0.39, 0.33, 1.19]
				]
			},
			props: [
				bulb([x, -0.28, 0.57 + v * 0.11], 0.17, 1, 'gear'),
				...[-1, 1].map((s) => drum([1.35, s * 0.19, 0], 0.09, 0.32, 'skin'))
			]
		};
	}
	const hip = 0.57 + v * 0.15,
		z = hip + 0.58;
	return {
		pose: { hip, lean: 0.14, feet: feet(0.25, -0.18), hands: hands(0.34, 0.12, z) },
		props: [
			panel(0.35, 0, z - 0.06, 0.21, 0.3, 0.18, 'gear'),
			ring([0.49, 0, z + 0.045], 0.09, 0.045, 0.12, 'skin')
		]
	};
}
