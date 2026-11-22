import { pathSupports, profileSolid } from '../linear-path';
import { interpolatePoint, type Vec3 } from '../parametrik/types';
import type {
	AssetAnchor,
	AssetRecipe,
	RibbonPort,
	RibbonSection,
	RibbonSegmentSite,
	SiteBuildResult
} from './definition';
import type { ObjectGeometry } from './object-geometry';

const RIBBON_DEPTH_M = 0.09;
const SOFFIT_INSET_RATIO = 0.09;
const COLUMN_RADIUS_M = 0.16;
const COLUMN_BAY_M = 4.8;
const MIN_COLUMN_HEIGHT_M = 0.04;
const PAIRED_OFFSET_RATIO = 0.75;

const STOCK_LENGTH_M = 6;
const STOCK_WIDTH_M = 1.8;
const STOCK_ELEVATION_M = 2.4;

const stockSections: readonly RibbonSection[] = [
	{
		centre: [-STOCK_LENGTH_M / 2, 0, STOCK_ELEVATION_M],
		left: [-STOCK_LENGTH_M / 2, STOCK_WIDTH_M / 2, STOCK_ELEVATION_M],
		right: [-STOCK_LENGTH_M / 2, -STOCK_WIDTH_M / 2, STOCK_ELEVATION_M]
	},
	{
		centre: [STOCK_LENGTH_M / 2, 0, STOCK_ELEVATION_M],
		left: [STOCK_LENGTH_M / 2, STOCK_WIDTH_M / 2, STOCK_ELEVATION_M],
		right: [STOCK_LENGTH_M / 2, -STOCK_WIDTH_M / 2, STOCK_ELEVATION_M]
	}
];

const stockAnchors: readonly AssetAnchor[] = [
	{ attachment: 'deck', position: [-STOCK_LENGTH_M / 2, 0, STOCK_ELEVATION_M], normal: [-1, 0, 0] },
	{ attachment: 'deck', position: [STOCK_LENGTH_M / 2, 0, STOCK_ELEVATION_M], normal: [1, 0, 0] }
];

function pierGeometry(
	id: string,
	p: Vec3,
	ground: (x: number, y: number) => number
): ObjectGeometry[] {
	const base = ground(p[0], p[1]);
	const height = p[2] - RIBBON_DEPTH_M - base;
	if (!Number.isFinite(height) || height <= MIN_COLUMN_HEIGHT_M) return [];
	return [
		{
			id,
			role: 'neu',
			slot: 'bearing',
			kind: 'cylinder',
			position: [p[0], p[1], base],
			height,
			radius: COLUMN_RADIUS_M
		}
	];
}

function segmentGeometry(
	prefix: string,
	sections: readonly RibbonSection[],
	ground: (x: number, y: number) => number,
	supported: boolean,
	paired: boolean
): ObjectGeometry[] {
	// Recess the soffit under the walking edge so the rim casts a narrow shadow.
	const soffit = (p: Vec3, centre: Vec3): Vec3 => [
		p[0] + SOFFIT_INSET_RATIO * (centre[0] - p[0]),
		p[1] + SOFFIT_INSET_RATIO * (centre[1] - p[1]),
		p[2] - RIBBON_DEPTH_M
	];
	const rings = sections.map(({ left, right, centre }) => [
		soffit(right, centre),
		soffit(left, centre),
		left,
		right
	]);
	const deck: ObjectGeometry = {
		id: prefix + '/ramp',
		role: 'neu',
		slot: 'walking',
		...profileSolid(rings)
	};
	if (!supported) return [deck];
	const paths = paired
		? (['left', 'right'] as const).map((side) =>
				sections.map((s) => interpolatePoint(s.centre, s[side], PAIRED_OFFSET_RATIO))
			)
		: [sections.map((s) => s.centre)];
	return [
		deck,
		...paths.flatMap((path, side) =>
			pathSupports(path, COLUMN_BAY_M).flatMap((p, i) =>
				pierGeometry(prefix + '/pier/' + (paired ? side + '/' : '') + i, p, ground)
			)
		)
	];
}

function sectionFootprint(sections: readonly RibbonSection[]): readonly [number, number] {
	let minX = Infinity,
		maxX = -Infinity,
		minY = Infinity,
		maxY = -Infinity;
	for (const { left, right, centre } of sections) {
		for (const [x, y] of [left, right, centre]) {
			if (x < minX) minX = x;
			if (x > maxX) maxX = x;
			if (y < minY) minY = y;
			if (y > maxY) maxY = y;
		}
	}
	return [maxX - minX, maxY - minY];
}

function terminalNormal(from: Vec3, to: Vec3): Vec3 {
	const dx = to[0] - from[0],
		dy = to[1] - from[1],
		len = Math.hypot(dx, dy);
	return len > 0 ? [dx / len, dy / len, 0] : [1, 0, 0];
}

function segmentAnchors(
	sections: readonly RibbonSection[],
	ports?: readonly RibbonPort[]
): readonly AssetAnchor[] {
	if (ports && ports.length > 0) {
		return ports.map((port) => ({
			attachment: 'deck',
			position: [port.position[0], port.position[1], port.position[2]],
			normal: [Math.cos(port.heading), Math.sin(port.heading), 0]
		}));
	}
	const first = sections[0].centre;
	const second = sections[1].centre;
	const prev = sections[sections.length - 2].centre;
	const last = sections[sections.length - 1].centre;
	return [
		{ attachment: 'deck', position: [...first], normal: terminalNormal(second, first) },
		{ attachment: 'deck', position: [...last], normal: terminalNormal(prev, last) }
	];
}

function drawSite(
	variant: number,
	_sample: number,
	site: RibbonSegmentSite,
	instanceId: string
): SiteBuildResult {
	if (site.sections.length < 2)
		throw new RangeError('Ribbon segment site requires at least two surveyed sections');
	const supported = variant !== 2;
	const paired = variant === 1;
	return {
		geometry: segmentGeometry(instanceId, site.sections, site.ground, supported, paired),
		footprint: sectionFootprint(site.sections),
		anchors: segmentAnchors(site.sections, site.ports)
	};
}

export const ribbonSegment: AssetRecipe = {
	id: 'ribbon-segment',
	category: 'access',
	siteParametric: true,
	variants: ['supported', 'paired', 'tunnel'],
	slotNames: ['walking', 'bearing'],
	suggestions: {
		walking: { token: '--cat-business', finish: 'kunststoff-formteil', material: 'acrylic' },
		bearing: { token: '--paper', finish: 'beton-schalung', material: 'concrete' }
	},
	footprint: [STOCK_LENGTH_M, STOCK_WIDTH_M],
	anchors: stockAnchors,
	draw: (variant) =>
		segmentGeometry('ribbon-segment', stockSections, () => 0, variant !== 2, variant === 1),
	drawSite
};
