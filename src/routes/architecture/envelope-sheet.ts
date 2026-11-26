import {
	createFacadeBands,
	createTensionPatch,
	type TensionPatchSpec
} from '../../lib/domain/envelope';
import { resolveSurfaces, type SurfaceAssignment } from '../../lib/scene/surface';
import { box, studyStock } from './study-parts';

const survey = {
	id: 'canopy',
	corners: [
		{ id: 'south-west', position: [-10, -4, 10] },
		{ id: 'south-east', position: [10, -4, 6] },
		{ id: 'north-east', position: [10, 4, 10] },
		{ id: 'north-west', position: [-10, 4, 6] }
	],
	edgeGrips: [
		{ id: 'south-edge', position: [0, -4, 6.4] },
		undefined,
		{ id: 'north-edge', position: [0, 4, 6.4] },
		undefined
	]
} as const satisfies TensionPatchSpec;

const frontage = [
	{ id: 'west', position: [-10, -4, 2.3] },
	{ id: 'west-bay', position: [-3, -4, 2.3] },
	{ id: 'east-bay', position: [4, -4, 2.3] },
	{ id: 'east', position: [10, -4, 2.3] }
] as const;

const envelopeSurfaces = {
	'envelope-band': { color: '--model-cream', finish: 'matte' },
	'envelope-clip': { color: '--model-orange', finish: 'matte' },
	membrane: { color: '--model-pink', finish: 'matte' }
} as const satisfies SurfaceAssignment;

export function envelopeSheet(sagRatio?: number) {
	const bands = createFacadeBands({
		id: 'frontage',
		grips: frontage,
		bandCount: 3,
		bandHeightM: 0.6,
		pitchM: 1.15
	});
	const patch = createTensionPatch({ ...survey, sagRatio });
	const intermediatePosts = frontage
		.slice(1, -1)
		.map(({ id, position: [x, y] }) => box(id, [x, y, 2.5], [0.3, 0.3, 5]));
	const stock = studyStock(
		'canopy-supports',
		[
			box('platform', [0, 0, 0.25], [21.6, 9.6, 0.5]),
			...patch.anchors.map(({ name, position: [x, y, z] }) =>
				box(name, [x, y, z / 2], [0.33, 0.33, z])
			),
			...intermediatePosts
		],
		{ color: '--model-roof', finish: 'matte' }
	);
	return {
		drawables: [
			...stock,
			...resolveSurfaces(bands, {
				'envelope-band': envelopeSurfaces['envelope-band'],
				'envelope-clip': envelopeSurfaces['envelope-clip']
			}),
			...resolveSurfaces(patch, {
				membrane: envelopeSurfaces.membrane,
				'envelope-clip': envelopeSurfaces['envelope-clip']
			}).map((part) => ({
				...part,
				id: `canopy/${part.id}`,
				...(part.id === 'membrane' && {
					creaseAngleRad: Math.PI / 6,
					faces: { top: 0.025, lit: 0.005, shadow: 0.005 }
				})
			}))
		],
		measurements: [
			{ label: 'Frontage bays', value: String(frontage.length - 1), unit: '' },
			{ label: 'Surveyed canopy grips', value: String(patch.anchors.length), unit: '' }
		]
	};
}
