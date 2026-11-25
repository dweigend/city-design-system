import type { Vec3 } from '../../lib/core/geometry';
import { required } from '../../lib/core/invariant';
import { mesh, squareSegment } from '../../lib/core/mesh';
import type { Drawable } from '../../lib/scene/surface';
import type { Shape } from '../../lib/core/object';
import { houses, rectangle, slab } from './district';
import { waterSupply } from './waterworks';

const powerSupply: Vec3 = [-39, -6, 0.48];

export const powerStation = [
	slab('power-station/base', rectangle(-42, -8, -36, -4), 0, 0.45, '--ground-stone'),
	slab('power-station/cabinet', rectangle(-41.6, -7.6, -36.4, -4.4), 0.45, 2.9, '--model-grey'),
	slab('power-station/terminal', rectangle(-41.6, -7.6, -36.4, -4.4), 2.9, 3.13, '--energy')
];

const lines = [
	{
		kind: 'water',
		color: '--water',
		mainY: -3.7,
		frontageShare: 0.24,
		riserY: 2.2,
		top: 2.65,
		supply: waterSupply
	},
	{
		kind: 'power',
		color: '--energy',
		mainY: -1,
		frontageShare: 0.76,
		riserY: 2.95,
		top: 1.9,
		supply: powerSupply
	}
] as const;

function drawLine({
	kind,
	color,
	mainY,
	frontageShare,
	riserY,
	top,
	supply
}: (typeof lines)[number]) {
	const height = supply[2];
	const services = houses.map(({ id, frontage: { west, east, y } }) => {
		const serviceX = west + (east - west) * frontageShare;
		return {
			id,
			junction: [serviceX, mainY, height] as Vec3,
			foot: [serviceX, riserY, height] as Vec3,
			head: [serviceX, riserY, top] as Vec3,
			// Cross the frontage into the first occupied bay.
			entry: [serviceX, y + 0.52, top] as Vec3
		};
	});
	const supplyJunction: Vec3 = [supply[0], mainY, height];
	const joints = [supplyJunction, ...services.map(({ junction }) => junction)].sort(
		(a, b) => a[0] - b[0]
	);
	const id = `conduit/${kind}`;

	// Flow colors carry the small fittings at mobile sizes without a dark outline.
	const flow = (id: string, shape: Shape): Drawable => ({
		id,
		shape,
		color,
		finish: 'matte',
		flat: true,
		strokeSegments: []
	});

	function ribbon(id: string, points: readonly Vec3[]): Drawable {
		const run = mesh();
		run.ribbon(points, 0.78, 0.32);
		return flow(id, required(run.shape(), 'supply conduit'));
	}
	function connector(id: string, [x, y, z]: Vec3): Drawable {
		const collar = mesh();
		collar.pier([x, y, z - 0.34], z + 0.29, 0.57);
		return flow(id, required(collar.shape(), 'supply collar'));
	}

	return [
		ribbon(`${id}/main`, joints),
		ribbon(`${id}/source`, [supply, supplyJunction]),
		connector(`${id}/source/collar`, supply),
		connector(`${id}/source/junction`, supplyJunction),
		...services.flatMap(({ id: house, junction, foot, head, entry }) => {
			const address = `${id}/${house}`;
			return [
				ribbon(`${address}/branch`, [junction, foot]),
				flow(`${address}/riser`, squareSegment(foot, head, 0.7)),
				ribbon(`${address}/service`, [head, entry]),
				connector(`${address}/junction`, junction),
				connector(`${address}/base-collar`, foot),
				connector(`${address}/head-collar`, head),
				connector(`${address}/entry-collar`, entry)
			];
		})
	];
}

export const conduits = lines.flatMap(drawLine);
