import type { Vec3 } from '../../lib/core/geometry';
import type { Drawable } from '../../lib/scene/surface';
import { box, facadeBay, fracturedBay } from './reuse-bay';
import {
	building,
	cantileverHoist,
	depot,
	railSled,
	recoveryCrib,
	yard,
	yardFit
} from './reuse-yard';

const tracked = { id: 'component/bay-04', massKg: 1420, reinstallable: true } as const;
const unsuitable = { id: 'component/bay-09', massKg: 1380, reinstallable: false } as const;
const donorSocket: Vec3 = [-0.8, 2.05, 0.84];
const receivingSocket: Vec3 = [1.6, 1.15, 0.84];

const steps = {
	deconstruction: {
		label: 'Deconstruction',
		condition: 'Detached · Old shims exposed',
		origin: [-0.8, -0.7, 1.2]
	},
	storage: {
		label: 'Storage',
		condition: 'Inspected · Tagged in the depot',
		origin: [1.9, 1.3, 1.15]
	},
	transport: {
		label: 'Roadless transport',
		condition: 'Secured in a rail cradle',
		origin: [0, -3.5, 1.27]
	},
	reinstallation: {
		label: 'Reinstallation',
		condition: 'Seated · Flanges joined',
		origin: receivingSocket
	},
	rejected: {
		label: 'Rejected',
		condition: 'Fractured joint · Unsuitable for reinstallation · Raw material recovery',
		origin: [0, 0.2, 0.55]
	}
} as const satisfies Record<string, { label: string; condition: string; origin: Vec3 }>;

export type ReuseStep = keyof typeof steps;
export const reuseSteps = Object.keys(steps) as ReuseStep[];
export const reuseOptions = reuseSteps.map((value) => ({ value, label: steps[value].label }));

function stageParts(step: ReuseStep, [x, y, z]: Vec3): Drawable[] {
	switch (step) {
		case 'deconstruction':
			return [
				...building('donor', donorSocket, 'open'),
				...cantileverHoist('dismantling-hoist', [x, y, z]),
				...[-2.15, 2.15].map((offset, side) =>
					box(
						`${tracked.id}/old-shim/${side}`,
						[x + offset, y - 0.51, z + 0.4],
						[1.16, 0.2, 0.33],
						'hardware'
					)
				)
			];
		case 'storage':
			return [
				...depot([x, y, z]),
				box(
					`${tracked.id}/inspection-tag`,
					[x - 1.48, y - 0.31, z + 3.35],
					[0.72, 0.13, 0.38],
					'tag'
				),
				...[0, 0.11].map((height, line) =>
					box(
						`${tracked.id}/inspection-tag/line/${line}`,
						[x - 1.48, y - 0.39, z + 3.29 + height],
						[0.46, 0.04, 0.038],
						'hardware'
					)
				)
			];
		case 'transport':
			return [
				...railSled([x, y, z]),
				...[-1.75, 1.75].map((offset, side) =>
					box(
						`${tracked.id}/transport-strap/${side}`,
						[x + offset, y - 0.34, z + 0.34],
						[0.19, 0.16, 0.79],
						'hardware'
					)
				)
			];
		case 'reinstallation':
			return building('receiver', receivingSocket, 'joined');
		case 'rejected':
			return recoveryCrib([x, y, z]);
	}
}

/** R19 Picture 2. Returns a fresh frame over the fixed yard and camera. The seed varies only
 * the rejected lintel's displacement. Component identity and mass are fixed in kilograms. */
export function reusePicture(step: ReuseStep, seed = 139) {
	const { label, condition, origin } = steps[step];
	const component = step === 'rejected' ? unsuitable : tracked;
	const bay =
		step === 'rejected'
			? fracturedBay(component.id, origin, seed)
			: facadeBay(component.id, origin);
	return {
		component,
		step,
		label,
		condition,
		origin,
		fit: yardFit,
		view: 'iso' as const,
		drawables: [...yard, ...stageParts(step, origin), ...bay]
	};
}
