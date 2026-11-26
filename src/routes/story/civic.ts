import {
	distance,
	isConvexCounterclockwise,
	readVertexMean,
	type Vec2,
	type Vec3
} from '../../lib/core/geometry';
import { mesh, createMeshObject } from '../../lib/core/mesh';
import { createFacadeBands, createTensionPatch } from '../../lib/domain/envelope';
import {
	createSupportedFrame,
	type FrameObstruction,
	type FrameRoofSeat
} from '../../lib/domain/structure';
import { buildAsset } from '../../lib/world/asset-registry';
import type { CityGrowthSnapshot } from '../../lib/world/city-growth';

type Ground = (point: Vec2) => number;
type Holding = CityGrowthSnapshot['holdings'][number];

export const envelopeSurfaces = {
	'envelope-band': { color: '--model-cream', finish: 'matte' },
	'envelope-clip': { color: '--model-orange', finish: 'matte' },
	membrane: { color: '--model-pink', finish: 'matte' },
	post: { color: '--model-grey', finish: 'matte' }
} as const;

export function surveyRoofs(buildings: CityGrowthSnapshot['buildings'], groundAt: Ground) {
	return buildings.flatMap(({ id: hostId, parts }) =>
		parts.flatMap(({ id, kind, shape }) => {
			if (kind !== 'storey' || shape.kind !== 'prism' || !isConvexCounterclockwise(shape.polygon))
				return [];
			const { polygon: outline, base, top: roofZ } = shape;
			const foundationZ = Math.min(base, ...outline.map(groundAt));
			return [{ id, hostId, outline, roofZ, foundationZ }] satisfies FrameRoofSeat[];
		})
	);
}

export function surveyObstructions(buildings: CityGrowthSnapshot['buildings'], groundAt: Ground) {
	return buildings.flatMap(({ parts }) =>
		parts.flatMap(({ kind, shape }) => {
			if (kind !== 'storey' || shape.kind !== 'prism' || !isConvexCounterclockwise(shape.polygon))
				return [];
			const { polygon: outline, base, top: topZ } = shape;
			const baseZ = Math.min(base, ...outline.map(groundAt));
			return [{ outline, baseZ, topZ }] satisfies FrameObstruction[];
		})
	);
}

const roomFrame = {
	widthM: 2.8,
	minSpanM: 3,
	maxSpanM: 16,
	clearanceM: 1.25,
	maxRoofDifferenceM: 4
};

export function buildCivicFrame(
	roofs: readonly FrameRoofSeat[],
	obstructions: readonly FrameObstruction[],
	groundAt: Ground,
	seed: number
) {
	const seats = roofs.map((roof) => ({ roof, xy: readVertexMean(roof.outline) }));
	const { widthM, minSpanM, maxSpanM, clearanceM, maxRoofDifferenceM } = roomFrame;
	for (const { roof: host, xy: start } of seats) {
		const nearest = seats
			.filter(({ roof, xy }) => {
				const span = distance(start, xy);
				return (
					roof.hostId !== host.hostId &&
					span >= minSpanM &&
					span <= maxSpanM &&
					Math.abs(roof.roofZ - host.roofZ) <= maxRoofDifferenceM
				);
			})
			.sort((a, b) => distance(start, a.xy) - distance(start, b.xy));
		for (const { roof: neighbor, xy: end } of nearest) {
			const frame = createSupportedFrame({
				id: 'civic-frame',
				start,
				end,
				widthM,
				deckZ: Math.max(host.roofZ, neighbor.roofZ) + clearanceM,
				groundAt,
				roofs,
				obstructions
			});
			if (
				frame.status === 'supported' &&
				new Set(
					frame.bearings.map(({ support }) => (support.kind === 'roof' ? support.hostId : 'pier'))
				).size > 1
			) {
				const room = buildAsset(
					'plug-in/room',
					{ kind: 'frame', id: frame.sockets[0].socket.id, frame },
					{},
					seed
				);
				return { frame, room };
			}
		}
	}
}

const civicShelter = {
	bandHeightM: 0.25,
	pitchM: 0.6,
	bandCount: 3,
	heightM: 4.5,
	riseM: 1.2,
	radiusM: 0.16
};

// A small oriented canopy in the frontage strip, leaving the deep part of the square for its grove.
export function buildCivicEnvelope(holding: Holding, groundAt: Ground, court?: readonly Vec2[]) {
	const ring = court ?? holding.outline;
	if (!isConvexCounterclockwise(ring)) return;
	const [a, b] = court ? ring : holding.portal.points;
	const middle = readVertexMean(ring);
	const toward = ([x, y]: Vec2, [u, v]: Vec2, f: number): Vec2 => [
		x + (u - x) * f,
		y + (v - y) * f
	];
	const start = toward(a, b, 0.2);
	const end = toward(a, b, 0.8);
	const quad = [
		toward(start, middle, 0.12),
		toward(end, middle, 0.12),
		toward(end, middle, 0.55),
		toward(start, middle, 0.55)
	];
	if (quad.some((point, i) => distance(point, quad[(i + 1) % quad.length]) < 1)) return;
	const { heightM, riseM, bandCount, bandHeightM, pitchM, radiusM } = civicShelter;
	const grade = Math.max(...quad.map(groundAt));
	const corners = quad.map(([x, y], index) => ({
		id: 'grip-' + index,
		position: [x, y, grade + heightM + (index % 2 ? 0 : riseM)] as Vec3
	})) as unknown as Parameters<typeof createTensionPatch>[0]['corners'];
	const canopy = createTensionPatch({ id: 'market-canopy', corners });
	const bands = createFacadeBands({
		id: 'market-frontage',
		grips: corners.slice(0, 2).map(({ id, position: [x, y] }) => ({
			id,
			position: [x, y, grade + heightM - bandCount * pitchM] as Vec3
		})),
		bandCount,
		bandHeightM,
		pitchM
	});
	const post = mesh();
	for (const {
		position: [x, y, z]
	} of corners)
		post.pier([x, y, groundAt([x, y])], z, radiusM);
	return { canopy, bands, posts: createMeshObject('market-posts', { post }, []), corners };
}
