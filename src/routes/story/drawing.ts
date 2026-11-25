import { required } from '../../lib/core/invariant';
import { bounds, move, PlaceableObject } from '../../lib/core/object';
import { Random } from '../../lib/core/random';
import {
	cityCameraBearingRad,
	cityElevation,
	cityFrameFillFlat
} from '../../lib/scene/city-volume-projection';
import { stockPencilShare } from '../../lib/scene/focus';
import { houseUseColors, paintHouseUse, projectHouse } from '../../lib/scene/house-projection';
import { projectPathAsset } from '../../lib/scene/paths-projection';
import { projectFocus } from '../../lib/scene/stage';
import { projectValleyWindow } from '../../lib/scene/valley-projection';
import type { createStoryValley } from '../../lib/world/story-valley';

type Story = ReturnType<typeof createStoryValley>;
type Snapshot = Story['snapshots'][number];

export function createStoryDrawing(story: Story) {
	const { valley, window } = story;
	const terrain = projectValleyWindow(valley, window, 1);
	const offset = [...terrain.toLocal(0, 0), 0] as const;
	const bearing = -window.bearing;
	const camera = {
		bearing: cityCameraBearingRad,
		elevation: cityElevation(valley.parameters.relief)
	};
	const { min, max } = bounds(terrain.object);
	const corners = [min[0], max[0]].flatMap((x) =>
		[min[1], max[1]].flatMap((y) => [min[2], max[2]].map((z) => [x, y, z] as const))
	);
	const fit = {
		...camera,
		fill: cityFrameFillFlat,
		subject: projectFocus('iso', camera, corners)
	};
	const placed = new Map<string, PlaceableObject>();

	function draw(snapshot: Snapshot) {
		return [
			...terrain.drawables,
			...snapshot.crossings.flatMap(({ object, builtYear }) => {
				const bridge = move(object, offset, bearing);
				if (builtYear === snapshot.year)
					return required(projectPathAsset(bridge, 'access'), 'story footbridge drawing');
				return projectHouse(
					{
						...bridge,
						slots: ['mass'],
						parts: bridge.parts.map((part) => ({ ...part, slot: 'mass' }))
					},
					'transparent'
				);
			}),
			...snapshot.buildings.flatMap(({ seed, parts }) => {
				const stock =
					Random.create({ seed }).derive('stock').number() < stockPencilShare
						? 'pencil'
						: 'transparent';
				return parts.flatMap(({ part, phase, use }) => {
					let object = placed.get(part.id);
					if (!object) {
						object = move(
							PlaceableObject.create({
								id: part.id,
								parts: [part],
								slots: [part.slot],
								footprint: terrain.footprint,
								anchors: []
							}),
							offset,
							bearing
						);
						placed.set(part.id, object);
					}
					const drawables = projectHouse(object, phase === 'retained' ? stock : 'silhouette')
						// The orthogonal storey masses need every fold but no coplanar diagonals.
						.map((drawable) => ({ ...drawable, creaseAngleRad: Math.PI / 4 }));
					return phase === 'retained'
						? drawables
						: drawables.map((drawable) =>
								paintHouseUse({ ...drawable, useColor: houseUseColors[use] })
							);
				});
			})
		];
	}

	return { fit, draw };
}
