import { pathSupports, profileSolid } from '../linear-path';
import { interpolatePoint, type Vec3 } from '../parametrik/types';
import {
	mount,
	type AssetAnchor,
	type AssetRecipe,
	type RibbonPort,
	type RibbonPorts,
	type RibbonSection,
	type RibbonSegmentSite,
	type SiteBuildResult
} from './definition';
import type { ObjectGeometry } from './object-geometry';

/** Shared headless ribbon deck and pier dimensions in metres (single owner for segments, junctions and stairs). */
export const ribbonDimensions = {
	width: 1.8,
	depth: 0.09,
	soffitInsetRatio: 0.09,
	columnRadius: 0.16,
	bay: 4.8,
	minColumnHeight: 0.04,
	pairedOffsetRatio: 0.75
} as const;

const STOCK_LENGTH_M = 6;
const STOCK_WIDTH_M = ribbonDimensions.width;
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

const stockAnchors: readonly AssetAnchor[] = [mount('deck')];

/** Seats a colour-free vertical pier cylinder between finished terrain and the deck soffit. */
export function ribbonPierGeometry(
	id: string,
	p: Vec3,
	ground: (x: number, y: number) => number,
	depth: number = ribbonDimensions.depth
): ObjectGeometry[] {
	const base = ground(p[0], p[1]);
	const height = p[2] - depth - base;
	if (!Number.isFinite(height) || height <= ribbonDimensions.minColumnHeight) return [];
	return [
		{
			id,
			role: 'neu',
			slot: 'bearing',
			kind: 'cylinder',
			position: [p[0], p[1], base],
			height,
			radius: ribbonDimensions.columnRadius
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
		p[0] + ribbonDimensions.soffitInsetRatio * (centre[0] - p[0]),
		p[1] + ribbonDimensions.soffitInsetRatio * (centre[1] - p[1]),
		p[2] - ribbonDimensions.depth
	];
	const rings = sections.map(({ left, right, centre }) => [
		soffit(right, centre),
		soffit(left, centre),
		[left[0], left[1], left[2]] as Vec3,
		[right[0], right[1], right[2]] as Vec3
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
				sections.map((s) => interpolatePoint(s.centre, s[side], ribbonDimensions.pairedOffsetRatio))
			)
		: [sections.map((s) => s.centre)];
	return [
		deck,
		...paths.flatMap((path, side) =>
			pathSupports(path, ribbonDimensions.bay).flatMap((p, i) =>
				ribbonPierGeometry(prefix + '/pier/' + (paired ? side + '/' : '') + i, p, ground)
			)
		)
	];
}

function geometryFootprint(geometry: readonly ObjectGeometry[]): readonly [number, number] {
	let minX = Infinity,
		maxX = -Infinity,
		minY = Infinity,
		maxY = -Infinity;
	const include = (x: number, y: number, r = 0) => {
		if (x - r < minX) minX = x - r;
		if (x + r > maxX) maxX = x + r;
		if (y - r < minY) minY = y - r;
		if (y + r > maxY) maxY = y + r;
	};
	for (const part of geometry) {
		if (part.kind === 'mesh') {
			for (const [x, y] of part.points) include(x, y);
		} else if (part.kind === 'cylinder') {
			include(part.position[0], part.position[1], part.radius);
		} else if (part.kind === 'pipe') {
			for (const [x, y] of part.points) include(x, y, part.radius);
		}
	}
	return [maxX - minX, maxY - minY];
}

function outwardTangent(sections: readonly RibbonSection[], end: 'start' | 'end'): Vec3 {
	if (end === 'start') {
		const anchor = sections[0].centre;
		for (let i = 1; i < sections.length; i++) {
			const dx = anchor[0] - sections[i].centre[0];
			const dy = anchor[1] - sections[i].centre[1];
			const len = Math.hypot(dx, dy);
			if (len > 1e-12) return [dx / len, dy / len, 0];
		}
		return [-1, 0, 0];
	}
	const anchor = sections[sections.length - 1].centre;
	for (let i = sections.length - 2; i >= 0; i--) {
		const dx = anchor[0] - sections[i].centre[0];
		const dy = anchor[1] - sections[i].centre[1];
		const len = Math.hypot(dx, dy);
		if (len > 1e-12) return [dx / len, dy / len, 0];
	}
	return [1, 0, 0];
}

function outwardPortNormal(heading: number, outward: Vec3): Vec3 {
	const nx = Math.cos(heading);
	const ny = Math.sin(heading);
	return nx * outward[0] + ny * outward[1] < 0 ? [-nx, -ny, 0] : [nx, ny, 0];
}

function endpointAnchor(
	sections: readonly RibbonSection[],
	end: 'start' | 'end',
	port: RibbonPort | undefined
): AssetAnchor {
	const outward = outwardTangent(sections, end);
	const fallback = end === 'start' ? sections[0].centre : sections[sections.length - 1].centre;
	const pos = port ? port.position : fallback;
	return {
		attachment: 'deck',
		position: [pos[0], pos[1], pos[2]],
		normal: port ? outwardPortNormal(port.heading, outward) : outward
	};
}

function segmentAnchors(
	sections: readonly RibbonSection[],
	ports?: RibbonPorts
): readonly AssetAnchor[] {
	return [
		endpointAnchor(sections, 'start', ports?.start),
		endpointAnchor(sections, 'end', ports?.end)
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
	const geometry = segmentGeometry(instanceId, site.sections, site.ground, supported, paired);
	return {
		geometry,
		footprint: geometryFootprint(geometry),
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
