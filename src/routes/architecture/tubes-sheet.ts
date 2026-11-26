import type { Vec3 } from '../../lib/core/geometry';
import {
	paintServicePipe,
	projectServicePipe,
	projectWalkableTube
} from '../../lib/scene/paths-projection';
import type { MaterialDisplay } from '../../lib/scene/surface';
import { box, studyStock } from './study-parts';

const walk: readonly Vec3[] = [
	[-12, 0, 5],
	[-6, 0, 5],
	[0, 1, 5.3],
	[6, 1, 5.6],
	[12, 0, 5.6]
];
const service: readonly Vec3[] = walk.map(([x, y, z]) => [x, y - 1.25, z - 2.05]);

export function tubesSheet() {
	const walkway = projectWalkableTube('walkway', walk, { jointIndices: [2] });
	const pipe = projectServicePipe('water-main', service, 'water', { jointIndices: [2] });
	const stock = studyStock(
		'tube-supports',
		[
			box('west-abutment', [-13.5, 0, 2.05], [3, 5, 4.1]),
			box('east-abutment', [13.5, 0, 2.35], [3, 5, 4.7]),
			box('center-pier', [0, 1.6, 1.9], [0.65, 0.65, 3.8])
		],
		{ color: '--model-grey', finish: 'matte' }
	);

	return (display: MaterialDisplay) => ({
		drawables: [...stock, ...walkway.drawables, ...paintServicePipe(pipe, display)],
		measurements: [
			{ label: 'Walkway span', value: '24', unit: 'm' },
			{ label: 'Water service', value: display === 'normal' ? 'Concealed' : 'Visible', unit: '' }
		]
	});
}
