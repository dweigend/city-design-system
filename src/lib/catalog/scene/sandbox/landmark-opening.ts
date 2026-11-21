import { centreOpening } from './court-opening';
import { openingOrigins } from './opening-origins';
import { Box2, Box3, Vector2, Vector3 } from 'three/webgpu';
import { houseSizes, scoreCrop } from './opening-score';
import {
	projector,
	orientedProjection,
	screenBounds,
	surveyContext,
	type Courts,
	type OpeningScreen,
	type OpeningProjection
} from './opening-projection';
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
type FrameSearch = {
	view: View;
	screen: OpeningScreen;
	data: OpeningProjection;
	translate?: boolean;
	best?: Choice;
};
function consider(
	search: FrameSearch,
	group: number[],
	fit: CourtFit,
	origin: Vector2,
	scale: number
) {
	const rank = scoreCrop(search.view, search.screen, search.data, scale, origin, 'rank');
	if (!rank || (search.best && compare(rank, search.best.rank) <= 0)) return;
	search.best = { group, fit, rank };
	if (!meetsTarget(search.best)) return;
	// Pull back around the accepted subject's screen centre only while the whole crop is legal.
	const subject = search.screen.safe.getCenter(new Vector2()).add(fit.offset);
	for (const factor of [0.95, 0.975, 0.99]) {
		const wider = scale * factor;
		const start = origin.clone().addScaledVector(subject, 1 / scale - 1 / wider);
		const score = scoreCrop(search.view, search.screen, search.data, wider, start, 'rank');
		if (score?.[1] !== 0 || score[2] !== 1) continue;
		search.best = { group, rank: score, fit: { ...fit, fill: fit.fill * factor } };
		break;
	}
}

// Orthographic screen area grows with the square of the camera scale.
function areaFit(fit: CourtFit, size: Vector2, room: Vector2, portrait: boolean) {
	const portion = portrait ? 0.415 : 0.465;
	const scale = Math.sqrt((portion * room.x * room.y) / (size.x * size.y));
	const fill = scale * Math.max(size.x / room.x, size.y / room.y);
	return fill <= 0.98 ? [{ ...fit, fill }] : [];
}

function fitSizes(
	fits: CourtFit[],
	size: Vector2,
	room: Vector2,
	median: number,
	portrait: boolean
) {
	const sizes = houseSizes(portrait);
	const ideal = [sizes.ideal, ...sizes.samples.filter((h) => h !== sizes.ideal)]
		.map((px) => ({ ...fits[0], fill: (px / median) * Math.max(size.x / room.x, size.y / room.y) }))
		.filter((f) => f.fill <= 0.98);
	const subject = areaFit(fits[0], size, room, portrait);
	return [...subject, ...ideal, ...fits];
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
	const candidates = fitSizes(fits, size, room, median, view.isPortrait());
	for (const fit of candidates) {
		if (meetsTarget(search.best)) return;

		const scale = view.courtScale(size.x, size.y, room.x, room.y, fit.fill);
		if (median * scale < sizes.min || median * scale > sizes.max) continue;
		const origin = box
			.getCenter(new Vector2())
			.sub(center.clone().add(fit.offset).divideScalar(scale));
		consider(search, group, fit, origin, scale);
		if (!search.translate || group.length !== 2) continue;
		for (const candidateOrigin of openingOrigins(box, screen, data, scale, view.isPortrait())) {
			const offset = box
				.getCenter(new Vector2())
				.sub(candidateOrigin)
				.multiplyScalar(scale)
				.sub(center);
			consider(search, group, { ...fit, offset }, candidateOrigin, scale);
			if (meetsTarget(search.best)) return;
		}
	}
}

// Studio sightlines cover both directions along the waterfront and a cross-town view.
const portraitHeadings = [342, 152, 172, 180, 124, 144, 90, 0] as const;
// The south-southwest sightline separates neighbouring courts across a shallow HUD opening.
const landscapeAngles = [
	[210, -1],
	[144, -1],
	[124, -1],
	[180, -1],
	[108, -1],
	[202, -1],
	[90, -1],
	[0, -1]
] as const;

/** Maximum number of projected town orientations in a single opening fit. */
export const openingHeadingLimit = Math.max(portraitHeadings.length, landscapeAngles.length);

function sightlines(view: View, screen: OpeningScreen) {
	const room = screen.safe.getSize(new Vector2());
	const ratio = room.x / room.y;
	if (view.isPortrait()) return portraitHeadings.map((h) => [h, 0] as const);
	const shortRail = screen.safe.max.x < screen.canvas.max.x && ratio >= 1.65;
	const first = shortRail ? 202 : ratio >= 1.65 ? 90 : 108;
	return [[first, -1] as const, ...landscapeAngles.filter(([heading]) => heading !== first)];
}

// A full district includes its approaches and landmark; score its houses with the usual clearance rules.
function fitExhibit(search: FrameSearch, points: Vector3[], fits: CourtFit[], area: OpeningArea) {
	const { view, screen, data } = search;
	const box = projector(view)(points);
	const size = box.getSize(new Vector2()),
		room = screen.safe.getSize(new Vector2());
	for (const fit of fits) {
		const scale = view.courtScale(size.x, size.y, room.x, room.y, fit.fill);
		const origin = box
			.getCenter(new Vector2())
			.sub(screen.safe.getCenter(new Vector2()).divideScalar(scale));
		const occupied = new Box2(
			box.min.clone().sub(origin).multiplyScalar(scale),
			box.max.clone().sub(origin).multiplyScalar(scale)
		);
		if (
			!screen.safe.containsBox(occupied) ||
			screen.reserved.some((hud) => hud.intersectsBox(occupied))
		)
			continue;
		const rank = scoreCrop(view, screen, data, scale, origin, 'rank');
		if (!rank || rank[1] !== 0) continue;
		view.frameSilhouette(points, undefined, area, [], fit);
		return true;
	}
	return false;
}

function searchGroups(search: FrameSearch, groups: number[][], fits: CourtFit[]) {
	for (const translate of [false, true]) {
		search.translate = translate;
		for (const { group, box } of distinctCrops(groups, search.data.courts)) {
			tryCrop(search, group, box, fits);
			if (meetsTarget(search.best)) return;
		}
	}
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
	const courtCenters = courts.map((c) => c.center);
	const subject = view.isPortrait() ? undefined : area?.featuredCentre;
	const exhibit = subject && centreOpening(world, subject.cellId, courts);
	const normal = sightlines(view, screen);
	const angles =
		exhibit && subject
			? [
					[subject.headingDeg, -1] as const,
					...normal.filter(([heading]) => heading !== subject.headingDeg)
				]
			: normal;
	for (const [degrees, pitch] of angles.slice(0, openingHeadingLimit)) {
		const heading = (degrees * Math.PI) / 180,
			pitchOffset = (pitch * Math.PI) / 180;
		const previous: Choice | undefined = best;
		const shapes = [0.64, 0.72, 0.8, 0.86, 0.92, 0.98].map((fill) => ({
			fill,
			offset: new Vector2()
		}));
		const fits = shapes.map((shape) => ({ ...shape, heading, pitchOffset, courtCenters }));
		view.frameSilhouette([new Vector3()], undefined, undefined, [], fits[0]);
		const data = orientedProjection(view, courts, surroundings, heading);
		const search: FrameSearch = { view, screen, data, best: previous };
		if (
			exhibit &&
			area &&
			fitExhibit(
				search,
				exhibit,
				[
					{ ...fits[0], fill: 0.85 },
					{ ...fits[0], fill: 0.875 },
					{ ...fits[0], fill: 0.89 },
					{ ...fits[0], fill: 0.9 },
					...fits
				],
				area
			)
		)
			return true;
		searchGroups(search, groups, fits);
		best = search.best;
		if (meetsTarget(best) && !exhibit) break;
	}
	if (!best) return false;
	view.frameSilhouette(
		best.group.flatMap((i) => {
			const { points, houses } = courts[i];
			return houses.length ? houses.flat() : points;
		}),
		undefined,
		area,
		[],
		best.fit
	);
	return true;
}
