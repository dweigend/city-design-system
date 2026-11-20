import { mount, type AssetRecipe } from '../definition';
import { figureSurfaces } from '../production/public-life';
import { walkingDog } from './walking-dog';
import { panel } from './forms';
import { capsule } from './kit-recipe';
import { ring } from '../parts';
import { actionFigure, graphiteFigure, type Pose } from '../production/activities/action-figure';
function accessory(id: string, v: number) {
	if (id === 'dog-walker') return walkingDog();
	const hardware = v === 1 ? 'frame' : 'accent';
	if (id.includes('bicycle') || id.startsWith('cargo'))
		return [
			...[-1, 1].map((s) => ({
				...ring([s * 0.36, 0, 0.26], 0.26, 0.215, 0.055, 'trim'),
				rotation: Math.PI / 2
			})),
			capsule([-0.36, 0, 0.26], [0.36, 0, 0.53], 0.06, hardware)
		];
	if (id === 'crate-carrier')
		return [panel(0.26, 0, 0.88, 0.28, 0.35, 0.25, v === 1 ? 'trim' : 'accent')];
	if (id === 'wheelchair-user')
		return [
			panel(0, 0, 0.35, 0.41, 0.44, 0.1, hardware),
			...[-1, 1].map((s) => ({
				...ring([0, s * 0.24, 0.26], 0.26, 0.215, 0.055, 'trim'),
				rotation: Math.PI / 2
			}))
		];
	if (id.includes('pusher'))
		return [
			panel(0.46, 0, 0.25, 0.53, 0.44, 0.43, hardware),
			{ ...ring([0.49, 0, 0.17], 0.17, 0.12, 0.09, 'trim'), rotation: Math.PI / 2 }
		];
	return [];
}
function furniture(x: number, y: number, seated: boolean, support: boolean) {
	const seat = seated
		? [panel(x, y, 0, 0.26, 0.25, 0.36, 'trim'), panel(x, y, 0.36, 0.33, 0.33, 0.09, 'accent')]
		: [];
	if (support) seat.push(panel(x + 0.38, y, 0, 0.18, 0.4, 0.88, 'frame'));
	return seat;
}
function entry(
	id: string,
	footprint: [number, number],
	slotNames: string[],
	poses: Pose[],
	child: boolean
): AssetRecipe {
	return {
		id: 'person-' + id,
		category: 'neighbourhood-services',
		footprint,
		anchors: [mount('deck')],
		variants: ['relaxed', 'lifted-hand', 'broad-coat'],
		slotNames,
		suggestions: {
			body: graphiteFigure,
			trim: figureSurfaces.gear,
			accent: figureSurfaces.skin,
			frame: figureSurfaces.gear
		},
		draw(v, s) {
			const props = accessory(id, v);
			const workstation = slotNames.includes('frame') && props.length === 0;
			return poses.flatMap((pose, i) => {
				const x = poses.length > 1 ? [0.27, -0.28, 0.15][i] : 0,
					y = (i - (poses.length - 1) / 2) * 0.76;
				const seated = props.length === 0 && (v === 2 || pose === 'sit');
				const posture = seated ? 'sit' : i === 1 && pose === 'stand' ? 'walk' : pose;
				const seat = furniture(x, y, seated, workstation && v === 1);
				return [
					...actionFigure(posture, [x, y, 0], {
						sample: (s + i * 0.37) % 1,
						slot: 'body',
						phase: v,
						heading: (v - 1) * 0.33 + i * 1.78,
						child: child && i === poses.length - 1
					}),
					...seat,
					...props
				];
			});
		}
	};
}
export const people = [
	entry('standing', [1.25, 1.25], ['body', 'trim', 'accent'], ['stand'], false),
	entry('waving', [1.25, 1.25], ['body', 'trim', 'accent'], ['stand'], false),
	entry('pointing', [1.25, 1.25], ['body', 'trim', 'accent'], ['stand'], false),
	entry('looking-out', [1.25, 1.25], ['body', 'trim', 'accent'], ['stand'], false),
	entry('walking-left', [1.25, 1.25], ['body', 'trim', 'accent'], ['walk'], false),
	entry('walking-right', [1.25, 1.25], ['body', 'trim', 'accent'], ['walk'], false),
	entry('running', [1.25, 1.25], ['body', 'trim', 'accent'], ['walk'], false),
	entry('sitting', [1.25, 1.25], ['body', 'trim', 'accent'], ['sit'], false),
	entry('sitting-reading', [1.25, 1.25], ['body', 'trim', 'accent'], ['sit'], false),
	entry('railing-lean', [1.25, 1.25], ['body', 'trim', 'accent'], ['lean'], false),
	entry('stair-climb', [1.25, 1.25], ['body', 'trim', 'accent'], ['climb'], false),
	entry('crate-carrier', [2.5, 1.25], ['body', 'trim', 'accent'], ['carry'], false),
	entry('cart-pusher', [3.75, 1.25], ['body', 'trim', 'accent', 'frame'], ['lean'], false),
	entry('watering', [2.5, 1.25], ['body', 'trim', 'accent'], ['carry'], false),
	entry('ladder-repair', [1.25, 1.25], ['body', 'trim', 'accent', 'frame'], ['lean'], false),
	entry('at-workbench', [2.5, 1.25], ['body', 'trim', 'accent', 'frame'], ['carry'], false),
	entry('bicycle-rider', [2.5, 1.25], ['body', 'trim', 'accent', 'frame'], ['cycle'], false),
	entry('bicycle-walker', [2.5, 2.5], ['body', 'trim', 'accent', 'frame'], ['lean'], false),
	entry('cargo-rider', [3.75, 1.25], ['body', 'trim', 'accent', 'frame'], ['cycle'], false),
	entry('cargo-walker', [3.75, 2.5], ['body', 'trim', 'accent', 'frame'], ['lean'], false),
	entry('pram-pusher', [3.75, 1.25], ['body', 'trim', 'accent', 'frame'], ['lean'], false),
	entry('wheelchair-user', [2.5, 1.25], ['body', 'trim', 'accent', 'frame'], ['sit'], false),
	entry('dog-walker', [2.5, 1.25], ['body', 'trim', 'accent'], ['walk'], false),
	entry('reading', [1.25, 1.25], ['body', 'trim', 'accent'], ['stand'], false),
	entry('child-standing', [1.25, 1.25], ['body', 'trim', 'accent'], ['stand'], true),
	entry('child-waving', [1.25, 1.25], ['body', 'trim', 'accent'], ['stand'], true),
	entry('child-walking', [1.25, 1.25], ['body', 'trim', 'accent'], ['walk'], true),
	entry('child-running', [1.25, 1.25], ['body', 'trim', 'accent'], ['walk'], true),
	entry('child-climbing', [1.25, 1.25], ['body', 'trim', 'accent'], ['climb'], true),
	entry('child-pointing', [1.25, 1.25], ['body', 'trim', 'accent'], ['stand'], true),
	entry('walking-pair', [1.25, 2.5], ['body', 'accent', 'trim'], ['walk', 'walk'], false),
	entry('waiting-pair', [1.25, 2.5], ['body', 'accent', 'trim'], ['stand', 'stand'], false),
	entry('greeting-pair', [1.25, 2.5], ['body', 'accent', 'trim'], ['stand', 'stand'], false),
	entry('seated-pair', [1.25, 2.5], ['body', 'accent', 'trim'], ['sit', 'sit'], false),
	entry('holding-child-hand', [1.25, 2.5], ['body', 'accent', 'trim'], ['stand', 'stand'], true),
	entry('family-walk', [1.25, 3.75], ['body', 'accent', 'trim'], ['walk', 'walk', 'walk'], true),
	entry(
		'waiting-trio',
		[1.25, 3.75],
		['body', 'accent', 'trim'],
		['stand', 'stand', 'stand'],
		false
	),
	entry('tour-trio', [1.25, 3.75], ['body', 'accent', 'trim'], ['stand', 'stand', 'stand'], false),
	entry('walking-trio', [1.25, 3.75], ['body', 'accent', 'trim'], ['walk', 'walk', 'walk'], false),
	entry(
		'greeting-trio',
		[1.25, 3.75],
		['body', 'accent', 'trim'],
		['stand', 'stand', 'stand'],
		false
	)
];
