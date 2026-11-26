import { required } from '../../lib/core/invariant';
import { bounds, move, PlaceableObject, type Part } from '../../lib/core/object';
import { Random } from '../../lib/core/random';
import {
	cityCameraBearingRad,
	cityElevation,
	cityFrameFillFlat
} from '../../lib/scene/city-volume-projection';
import { stockPencilShare } from '../../lib/scene/focus';
import { houseUseColors, paintHouseUse, projectHouse } from '../../lib/scene/house-projection';
import { projectPathAsset } from '../../lib/scene/paths-projection';
import { projectFocus, type ViewFit } from '../../lib/scene/stage';
import type { Drawable } from '../../lib/scene/surface';
import { projectValleyWindow } from '../../lib/scene/valley-projection';
import { createStoryValley, type StoryYear } from '../../lib/world/story-valley';

type Story = ReturnType<typeof createStoryValley>;
type Snapshot = Story['snapshots'][number];

export type StoryAdoptionRecord = Readonly<{
	buildingId: string;
	retainedPartId: string;
	retainedBuiltYear: StoryYear;
	additionPartId: string;
	additionBuiltYear: StoryYear;
}>;

export type StoryScene = Readonly<{
	fit: ViewFit;
	frames: Readonly<Record<StoryYear, readonly Drawable[]>>;
	adoption: StoryAdoptionRecord;
}>;

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
	const fit: ViewFit = {
		...camera,
		fill: cityFrameFillFlat,
		subject: projectFocus('iso', camera, corners)
	};
	const placed = new Map<string, PlaceableObject>();

	function readPlaced(
		key: string,
		id: string,
		parts: readonly Part[],
		footprint: PlaceableObject['footprint']
	) {
		let object = placed.get(key);
		if (!object) {
			object = move(
				PlaceableObject.create({
					id,
					parts: [...parts],
					slots: [...new Set(parts.map(({ slot }) => slot))],
					footprint,
					anchors: []
				}),
				offset,
				bearing
			);
			placed.set(key, object);
		}
		return object;
	}

	function draw(snapshot: Snapshot): readonly Drawable[] {
		return [
			...terrain.drawables,
			...snapshot.crossings.flatMap(({ id, footprint, parts }) => {
				const added = parts.filter(({ phase }) => phase === 'addition').map(({ part }) => part);
				const retained = parts
					.filter(({ phase }) => phase === 'retained')
					.map(({ part }) => ({ ...part, slot: 'mass' as const }));
				const drawables: Drawable[] = [];
				if (added.length) {
					const object = readPlaced(
						`${id}/addition/${added.map(({ id }) => id).join(',')}`,
						id,
						added,
						footprint
					);
					drawables.push(
						...required(projectPathAsset(object, 'access'), 'story footbridge drawing')
					);
				}
				if (retained.length) {
					const object = readPlaced(
						`${id}/retained/${retained.map(({ id }) => id).join(',')}`,
						id,
						retained,
						footprint
					);
					drawables.push(...projectHouse(object, 'transparent'));
				}
				return drawables;
			}),
			...snapshot.buildings.flatMap(({ seed, parts }) => {
				const stock =
					Random.create({ seed }).derive('stock').number() < stockPencilShare
						? 'pencil'
						: 'transparent';
				return parts.flatMap(({ part, phase, use }) => {
					const object = readPlaced(part.id, part.id, [part], terrain.footprint);
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

/** Builds the complete, structured-cloneable story scene for all four dated events. */
export function buildStoryScene(): StoryScene {
	const story = createStoryValley();
	const drawing = createStoryDrawing(story);
	const frames = Object.fromEntries(
		story.snapshots.map((snapshot) => [snapshot.year, drawing.draw(snapshot)])
	) as Record<StoryYear, readonly Drawable[]>;
	const handover = required(story.snapshots.at(-1), 'handover snapshot');
	const hall = required(
		handover.buildings.find(({ id }) => id === story.adoption.buildingId),
		'adopted hall'
	);
	const lower = required(
		hall.parts.find(({ part }) => part.id === story.adoption.retainedPartId),
		'adopted retained storey'
	);
	const upper = required(
		hall.parts.find(({ part }) => part.id === story.adoption.additionPartId),
		'adopted added storey'
	);
	return {
		fit: drawing.fit,
		frames,
		adoption: {
			buildingId: story.adoption.buildingId,
			retainedPartId: lower.part.id,
			retainedBuiltYear: lower.builtYear,
			additionPartId: upper.part.id,
			additionBuiltYear: upper.builtYear
		}
	};
}

let cachedScene: Promise<StoryScene> | undefined;

/** Loads the fixed story scene once in a dedicated worker so the route mount stays responsive. */
export function loadStoryScene(): Promise<StoryScene> {
	if (cachedScene) return cachedScene;
	cachedScene =
		typeof Worker === 'undefined'
			? Promise.resolve().then(() => buildStoryScene())
			: new Promise<StoryScene>((resolve, reject) => {
					const worker = new Worker(new URL('./valley.worker.ts', import.meta.url), {
						type: 'module'
					});
					worker.onmessage = (
						event: MessageEvent<{ ok: true; scene: StoryScene } | { ok: false; message: string }>
					) => {
						worker.terminate();
						if (event.data.ok) resolve(event.data.scene);
						else {
							cachedScene = undefined;
							reject(new Error(event.data.message));
						}
					};
					worker.onerror = (event) => {
						worker.terminate();
						cachedScene = undefined;
						reject(new Error(event.message || 'Story worker failed'));
					};
				});
	return cachedScene;
}
