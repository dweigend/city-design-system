import { stockOrigins } from './opening-origins';
import { Box2, Box3, Vector2, Vector3 } from 'three/webgpu';
import { houseSizes, scoreCrop, type OpeningScreen, type OpeningProjection } from './opening-score';
import { orientedProjection, screenBounds, surveyContext, type Courts } from './opening-projection';
import type { World } from '../../logic/sandbox';
import type { Primitive } from '../../logic/parametrik/types';
import type { CourtFit, OpeningArea, View } from './view';

// Frame nearby pairs; the independent visibility test counts every court in the crop.
function neighbourhoods(courts: Courts) {
	if (courts.length === 1) return [[0]];
	const centers = courts.map((c) => new Box3().setFromPoints(c.points).getCenter(new Vector3()));
	const middle = new Box3().setFromPoints(centers).getCenter(new Vector3());
	const nearby = centers
		.map((point, i) => ({ point, i }))
		.sort((a, b) => a.point.distanceToSquared(middle) - b.point.distanceToSquared(middle))
		.slice(0, 8);
	const pairs = nearby.flatMap((a, i) =>
		nearby
			.slice(i + 1)
			.map((b) => ({ group: [a.i, b.i], distance: a.point.distanceToSquared(b.point) }))
	);
	return pairs
		.sort((a, b) => a.distance - b.distance)
		.slice(0, 16)
		.map((p) => p.group);
}

function compare(a: number[], b: number[]) {
	for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 1e-6) return a[i] - b[i];
	return 0;
}

function distinctCrops(groups: number[][], courts: Box2[]) {
	const crops = new Map<string, { group: number[]; box: Box2 }>();
	for (const group of groups) {
		const box = group.reduce((sum, i) => sum.union(courts[i]), new Box2());
		const key = [box.min.x, box.max.x, box.min.y, box.max.y].join(',');
		if (!crops.has(key)) crops.set(key, { group, box });
	}
	return crops.values();
}

type Choice = { group: number[]; fit: CourtFit; rank: number[] };

function meetsTarget(choice?: Choice) {
	return choice?.rank[1] === 0 && choice.rank[2] === 1;
}
type FrameSearch = { view: View; screen: OpeningScreen; data: OpeningProjection; best?: Choice };
function consider(
	search: FrameSearch,
	group: number[],
	fit: CourtFit,
	origin: Vector2,
	scale: number
) {
	const rank = scoreCrop(search.view, search.screen, search.data, scale, origin, 'rank');
	if (rank && (!search.best || compare(rank, search.best.rank) > 0))
		search.best = { group, fit, rank };
}

function tryCrop(search: FrameSearch, group: number[], box: Box2, fits: CourtFit[]) {
	const { view, screen, data } = search;
	const size = box.getSize(new Vector2()),
		room = screen.safe.getSize(new Vector2()),
		center = screen.safe.getCenter(new Vector2());
	const heights = group
		.flatMap((i) => data.houses[i].map((h) => h.max.y - h.min.y))
		.sort((a, b) => a - b);
	const median =
		(heights[Math.floor(heights.length / 2)] + heights[Math.floor((heights.length - 1) / 2)]) / 2;
	const sizes = houseSizes(view.isPortrait());
	const ideal = [sizes.ideal, ...sizes.samples.filter((h) => h !== sizes.ideal)]
		.map((px) => ({ ...fits[0], fill: (px / median) * Math.max(size.x / room.x, size.y / room.y) }))
		.filter((f) => f.fill <= 0.98);
	for (const fit of [...ideal, ...fits]) {
		if (meetsTarget(search.best)) return;

		const scale = view.courtScale(size.x, size.y, room.x, room.y, fit.fill);
		if (median * scale < sizes.min || median * scale > sizes.max) continue;
		const origin = box
			.getCenter(new Vector2())
			.sub(center.clone().add(fit.offset).divideScalar(scale));
		consider(search, group, fit, origin, scale);
		if (fit.offset.lengthSq() || group.length !== 2) continue;
		for (const stockOrigin of stockOrigins(box, screen, data, scale, view.isPortrait())) {
			const offset = box
				.getCenter(new Vector2())
				.sub(stockOrigin)
				.multiplyScalar(scale)
				.sub(center);
			consider(search, group, { ...fit, offset }, stockOrigin, scale);
			if (meetsTarget(search.best)) return;
		}
	}
}

// Studio sightlines cover both directions along the waterfront and a cross-town view.
const angles = [
	[0, 0],
	[78, -20],
	[249, -20],
	[2, -18],
	[0, -20],
	[39, -20],
	[150, 0],
	[270, -10]
] as const;

/** Maximum number of projected town orientations in a single opening fit. */
export const openingHeadingLimit = angles.length;

function sightlines(view: View, screen: OpeningScreen) {
	const room = screen.safe.getSize(new Vector2());
	const ratio = room.x / room.y;
	// Wider openings favour the waterfront axis, narrower ones a diagonal through the courts.
	const priorities = [
		[1.9, 0],
		[1.65, 3],
		[1.35, 2]
	];
	const first = view.isPortrait() ? 1 : (priorities.find(([min]) => ratio >= min)?.[1] ?? 5);
	return [angles[first], ...angles.filter((_, i) => i !== first)];
}

/** Fits readable houses and their surroundings while keeping controls and complete landmarks clear. */
export function frameOccupiedCourts(
	view: View,
	world: World,
	courts: Courts,
	area?: OpeningArea,
	additions: readonly Primitive[] = []
) {
	const groups = neighbourhoods(courts),
		surroundings = surveyContext(world, additions);
	const screen = screenBounds(view, area);
	let best: Choice | undefined;
	for (const [degrees, pitch] of sightlines(view, screen)) {
		const heading = (degrees * Math.PI) / 180,
			pitchOffset = (pitch * Math.PI) / 180;
		const previous: Choice | undefined = best;
		const shapes = [0.64, 0.72, 0.8, 0.86, 0.92, 0.98].map((fill) => ({
			fill,
			offset: new Vector2()
		}));
		const fits = shapes.map((shape) => ({ ...shape, heading, pitchOffset }));
		view.frameSilhouette([new Vector3()], undefined, undefined, [], fits[0]);
		const data = orientedProjection(view, courts, surroundings, heading);
		const search: FrameSearch = { view, screen, data, best: previous };
		for (const { group, box } of distinctCrops(groups, data.courts)) {
			tryCrop(search, group, box, fits);
			if (meetsTarget(search.best)) break;
		}
		best = search.best;
		if (meetsTarget(best)) break;
	}
	if (!best) return false;
	view.frameSilhouette(
		best.group.flatMap((i) => [...courts[i].points, ...courts[i].houses.flat()]),
		undefined,
		area,
		[],
		best.fit
	);
	return true;
}
