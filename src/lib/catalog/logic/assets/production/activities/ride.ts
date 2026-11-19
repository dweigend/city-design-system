import { rod } from '../../parts';
import { panel } from '../../objects/forms';
import { feet, hands, wheels, type Action } from './props';
/** Positions a rigid figure and the tools it holds for the selected action. */
export function ride(activity: 'skater' | 'scooter', v: number): Action {
	const skate = activity === 'skater',
		z = skate ? 0.19 : 0.21;
	const props = [
		panel(0, 0, z - 0.065, skate ? 0.95 : 0.88, skate ? 0.34 : 0.22, 0.085, 'skin'),
		...[-1, 1].flatMap((t) =>
			(skate ? [-0.13, 0.13] : [0]).map((y) => wheels(t * 0.34, y, skate ? 0.069 : 0.11))
		)
	];
	if (!skate)
		props.push(
			rod([0.34, 0, 0.14], [0.38, 0, 0.94], 0.065, 'gear'),
			rod([0.38, -0.22, 0.94], [0.38, 0.22, 0.94], 0.06, 'gear')
		);
	return {
		props,
		pose: skate
			? {
					hip: 0.86 - v * 0.095,
					lean: 0.15 + v * 0.07,
					feet: feet(0.28, -0.25, z + 0.095),
					hands: [
						[0.42, -0.54, 1.01 + v * 0.1],
						[-0.16, 0.55, 1.03 - v * 0.08]
					]
				}
			: {
					hip: 0.7,
					lean: 0.11,
					feet: [
						[0.1, -0.075, z + 0.075],
						[-0.18 - v * 0.13, 0.18, 0.075 + v * 0.08]
					],
					hands: hands(0.38, 0.22, 0.94)
				}
	};
}
