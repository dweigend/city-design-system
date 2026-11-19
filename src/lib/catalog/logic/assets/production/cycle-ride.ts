import type { Vec3 } from '../../parametrik/types';
import { panel } from '../objects/forms';
import { ring, rod } from '../parts';
import { actionFigure } from './activities/action-figure';
import type { Gesture } from './activities/action-figure';

type Mount = 'road' | 'junior' | 'freight';
function wheel(x: number, y: number, r: number) {
	return { ...ring([x, y, r], r, r - 0.084, 0.12, 'gear'), rotation: Math.PI / 2 };
}
/** A seated rider, wheelset and contact points share one crank phase and ground plane. */
export function cycleRide(mount: Mount, x: number, y: number, v: number) {
	const child = mount === 'junior',
		scale = child ? 0.73 : 1,
		r = 0.345 * scale;
	const at = (dx: number, dy: number, h: number): Vec3 => [
		x + dx * scale,
		y + dy * scale,
		h * scale
	];
	const front = mount === 'freight' ? 1.12 : 0.59;
	const axle = at(front, 0, 0.345),
		rear = at(-0.58, 0, 0.345),
		crank = at(0, 0, 0.36),
		saddle = at(-0.21, 0, 0.87),
		bar = at(0.48, 0, 1.09);
	const angle = (v * 2 * Math.PI) / 3,
		px = 0.15 * Math.cos(angle),
		pz = 0.15 * Math.sin(angle);
	const pose: Gesture = {
		hip: 0.96 * scale,
		lean: 0.21 * scale,
		feet: [
			[(0.21 + px) * scale, -0.14 * scale, (0.46 + pz) * scale],
			[(0.21 - px) * scale, 0.14 * scale, (0.46 - pz) * scale]
		],
		hands: [
			[0.66 * scale, -0.245 * scale, 1.1 * scale],
			[0.66 * scale, 0.245 * scale, 1.1 * scale]
		]
	};
	return [
		wheel(rear[0], y, r),
		wheel(axle[0], y, r),
		rod(rear, crank, 0.06, 'coat'),
		rod(rear, saddle, 0.06, 'coat'),
		rod(saddle, crank, 0.078, 'coat'),
		rod(crank, at(0.4, 0, 0.84), 0.08, 'coat'),
		rod(axle, bar, 0.07, 'gear'),
		rod(at(0.45, -0.26, 1.09), at(0.45, 0.26, 1.09), 0.06, 'gear'),
		panel(saddle[0], y, saddle[2] - 0.06, 0.36 * scale, 0.27 * scale, 0.11, 'skin'),
		...[-1, 1].map((t) => rod(crank, at(t * px, t * 0.14, 0.36 + t * pz), 0.06, 'gear')),
		...(mount === 'freight' ? [panel(x + 0.69, y, 0.45, 0.73, 0.74, 0.48, 'skin')] : []),
		...actionFigure(pose, child, x - 0.21 * scale, y)
	];
}
