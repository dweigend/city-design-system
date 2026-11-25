import { defaults } from '../../../config/story-valley';
import { distance, measurePointSegmentDistance, type Vec2, type Vec3 } from '../../core/geometry';
import { required } from '../../core/invariant';
import { buildAsset } from '../asset-registry';
import { readCityGrid, type CitySite } from '../city-site';

export function createStoryReach(site: CitySite, seed: number) {
	const { grid, plan, selectedCrossings, datumZ } = readCityGrid(
		site,
		defaults.storyCarrierSizeM,
		'organic',
		seed
	);
	const crossing = required(selectedCrossings[0], 'story river crossing');
	const nodes = new Map(plan.vertices.map(({ id, position }) => [id, position]));
	const path = crossing.span?.nodeIds ?? crossing.path.nodeIds;
	const bed = path.map((id) => required(nodes.get(id), 'story crossing node'));
	const first = required(bed[0], 'first bridge head');
	const last = required(bed.at(-1), 'last bridge head');
	const deckZ = Math.max(
		first[2],
		last[2],
		...bed.map(([x, y, z]) => site.sampleGround(x, y).waterHeight ?? z)
	);
	const points = bed.map(([x, y]): Vec3 => [x, y, deckZ]);
	const bridge = buildAsset(
		'access/walkway',
		{
			kind: 'plan-edge',
			id: 'footbridge',
			points,
			supports: bed.slice(1, -1).map((base, index) => ({ base, top: points[index + 1] }))
		},
		{},
		seed
	);
	const vertices = new Map(grid.vertices.map(({ id, position }) => [id, position]));
	const cells = grid.cells.map(({ id, vertexIds }) => {
		const ring = vertexIds.map((key) => required(vertices.get(key), 'story cell corner'));
		const center: Vec2 = [
			ring.reduce((sum, [x]) => sum + x, 0) / ring.length,
			ring.reduce((sum, [, y]) => sum + y, 0) / ring.length
		];
		const radius = Math.min(
			...ring.map(([x, y], i) => {
				const [nx, ny] = ring[(i + 1) % ring.length];
				return measurePointSegmentDistance(center, [x, y], [nx, ny]);
			})
		);
		const sideM = Math.SQRT2 * radius * defaults.storyBodyRadiusShare;
		return { id, center, sideM };
	});

	const [settlement, expansion, infill] = defaults.storyBuildingsByEvent;
	const near = ([x, y]: Vec3, other: Vec3) =>
		cells
			.filter(({ center }) => distance(center, [x, y]) < distance(center, [other[0], other[1]]))
			.sort((a, b) => distance(a.center, [x, y]) - distance(b.center, [x, y]));
	const nearBank = near(first, last);
	const farBank = near(last, first);
	const early = [...nearBank.slice(0, settlement), ...farBank.slice(0, expansion - settlement)];
	const built = new Set(early.map(({ id }) => id));
	const distanceToBridge = (point: Vec2) =>
		Math.min(distance(point, [first[0], first[1]]), distance(point, [last[0], last[1]]));
	const infillPlots = cells
		.filter(({ id }) => !built.has(id))
		.sort((a, b) => distanceToBridge(a.center) - distanceToBridge(b.center));
	const plots = [...early, ...infillPlots.slice(0, infill - expansion)];
	const extent = [...points, ...plots.map(({ center }) => center)];
	const xs = extent.map(([x]) => x);
	const ys = extent.map(([, y]) => y);
	const left = Math.min(...xs) - defaults.storyWindowMarginM;
	const right = Math.max(...xs) + defaults.storyWindowMarginM;
	const bottom = Math.min(...ys) - defaults.storyWindowMarginM;
	const top = Math.max(...ys) + defaults.storyWindowMarginM;
	const window = {
		origin: [(left + right) / 2, (bottom + top) / 2] as const,
		bearing: /* Exact arithmetic: the story window follows world XY. */ 0,
		length: right - left,
		width: top - bottom
	};
	return {
		window,
		plots,
		datumZ,
		bridge,
		crossingId: crossing.id,
		headIds: crossing.heads.map(({ nodeId }) => nodeId)
	};
}
