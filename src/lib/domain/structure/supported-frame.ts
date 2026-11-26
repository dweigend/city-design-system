import { defaults } from '../../../config/structure';
import type { Vec2, Vec3 } from '../../core/geometry';
import { PlaceableObject, type Part } from '../../core/object';
import { encodeKey } from '../../core/ref';
import { createFaceSocket, type FaceSocket } from '../face-dock';
import {
	collarHalfM,
	half,
	selectFramePlan,
	type FrameBearing,
	type FramePlan,
	type FrameRejection
} from './frame-plan';
import type { SupportedFrameSpec } from './frame-input';
import {
	createMemberGraph,
	type MemberGraph,
	type StructuralJoint,
	type StructuralMember
} from './graph';

const {
	primaryWidthM,
	secondaryWidthM,
	frameCollarDepthM,
	frameCollarWidthM,
	supportedFrameDeckThicknessM,
	frameBayHeightM
} = defaults;
const centerline = /* Exact arithmetic: local transverse coordinate on the baseline. */ 0;

type PlannedFrame = Extract<ReturnType<typeof selectFramePlan>, { status: 'planned' }>;

export type FrameBaySocket = Readonly<{
	socket: FaceSocket;
	clearHeightM: number;
}>;

export type SupportedFrame = Readonly<{
	status: 'supported';
	object: PlaceableObject;
	graph: MemberGraph;
	bearings: readonly FrameBearing[];
	sockets: readonly FrameBaySocket[];
}>;

function buildBox(plan: FramePlan, parts: Part[]) {
	return (id: string, slot: string, [x, y]: Vec2, base: number, size: Vec3) => {
		parts.push({
			id,
			slot,
			shape: {
				kind: 'box',
				center: [...plan.point(x, y), base + size[2] / half],
				size,
				rotation: plan.rotation
			}
		});
	};
}

function buildFrameObject(
	id: string,
	{ plan, stations, rows }: PlannedFrame,
	sockets: readonly FrameBaySocket[]
) {
	const { deckZ, soffitZ, widthM, length, rightM, leftM } = plan;
	const upperZ = deckZ + frameBayHeightM;
	const parts: Part[] = [];
	const box = buildBox(plan, parts);
	box('deck', 'deck', [length / half, centerline], deckZ - supportedFrameDeckThicknessM, [
		length + frameCollarWidthM,
		widthM,
		supportedFrameDeckThicknessM
	]);

	for (const [i, { id: stationId, offsetM }] of stations.entries()) {
		const cross: Vec2 = [offsetM, centerline];
		box(encodeKey([stationId, 'crosshead']), 'frame', cross, soffitZ, [
			frameCollarWidthM,
			widthM,
			primaryWidthM
		]);
		box(encodeKey([stationId, 'header']), 'frame', cross, upperZ, [
			secondaryWidthM,
			leftM - rightM + secondaryWidthM,
			secondaryWidthM
		]);
		for (const [side, y] of [rightM, leftM].entries()) {
			const bearing = rows[i][side];
			const stemSlot = bearing.support.kind === 'pier' ? 'pier' : 'frame';
			const seatZ = bearing.seat[2];
			const column = (role: string, slot: string, low: number, high: number, width: number) =>
				box(encodeKey([bearing.id, role]), slot, [offsetM, y], low, [width, width, high - low]);
			column('foot', 'joint', seatZ, seatZ + frameCollarDepthM, frameCollarWidthM);
			column(
				'stem',
				stemSlot,
				seatZ + frameCollarDepthM,
				soffitZ - frameCollarDepthM,
				primaryWidthM
			);
			column('capital', 'joint', soffitZ - frameCollarDepthM, soffitZ, frameCollarWidthM);
			column('post-base', 'joint', deckZ, deckZ + frameCollarDepthM, frameCollarWidthM);
			column(
				'post',
				'frame',
				deckZ + frameCollarDepthM,
				upperZ - frameCollarDepthM,
				secondaryWidthM
			);
			column('post-cap', 'joint', upperZ - frameCollarDepthM, upperZ, frameCollarWidthM);

			const next = stations[i + 1];
			if (!next) continue;
			const span = next.offsetM - offsetM;
			const x = offsetM + span / half;
			box(encodeKey([bearing.id, next.id, 'girder']), 'frame', [x, y], soffitZ, [
				span - frameCollarWidthM,
				primaryWidthM,
				primaryWidthM
			]);
			box(encodeKey([bearing.id, next.id, 'header']), 'frame', [x, y], upperZ, [
				span - secondaryWidthM,
				secondaryWidthM,
				secondaryWidthM
			]);
		}
	}
	return PlaceableObject.create({
		id,
		parts,
		slots: [...new Set(parts.map(({ slot }) => slot))],
		footprint: { width: length + frameCollarWidthM, depth: widthM },
		anchors: sockets.map(({ socket }) => ({
			name: socket.id,
			position: socket.center,
			normal: socket.normal
		}))
	});
}

function buildFrameGraph({ rows, plan }: PlannedFrame) {
	const joints: StructuralJoint[] = [];
	const members: StructuralMember[] = [];
	const link = (from: string, to: string, role: string, section: string) =>
		members.push({ id: encodeKey([from, to]), from, to, role, section });
	for (const [i, row] of rows.entries()) {
		for (const [side, bearing] of row.entries()) {
			const [x, y] = bearing.at;
			const foundation = encodeKey([bearing.id, 'seat']);
			const head = encodeKey([bearing.id, 'head']);
			joints.push({ id: foundation, position: bearing.seat, support: 'pinned' });
			joints.push({ id: bearing.id, position: bearing.at, support: 'free' });
			joints.push({ id: head, position: [x, y, plan.deckZ + frameBayHeightM], support: 'free' });
			link(foundation, bearing.id, 'column', 'heavy');
			link(bearing.id, head, 'column', 'light');

			const next = rows[i + 1]?.[side];
			if (!next) continue;
			link(bearing.id, next.id, 'beam', 'heavy');
			link(head, encodeKey([next.id, 'head']), 'beam', 'light');
		}
		const [right, left] = row;
		link(right.id, left.id, 'beam', 'heavy');
		link(encodeKey([right.id, 'head']), encodeKey([left.id, 'head']), 'beam', 'light');
	}
	return createMemberGraph({ joints, members });
}

function buildSockets(id: string, { plan, stations }: PlannedFrame): readonly FrameBaySocket[] {
	return Object.freeze(
		stations.slice(1).map((right, i) => {
			const left = stations[i];
			const polygon = plan
				.ring(
					left.offsetM + collarHalfM,
					right.offsetM - collarHalfM,
					plan.rightM + collarHalfM,
					plan.leftM - collarHalfM
				)
				.map(([x, y]): Vec3 => [x, y, plan.deckZ]);
			return Object.freeze({
				socket: createFaceSocket({ id: encodeKey([id, left.id, right.id]), polygon }),
				clearHeightM: frameBayHeightM
			});
		})
	);
}

/** Builds an elevated frame over ordered bearing lines in world meters. Each line has two
 * grounded bearings. Roofs are tried highest first with address tie-breaking, then piers
 * unless allowPiers is false. Invalid coordinates, addresses or bounds throw RangeError.
 * Missing supports, obstructed runs and out-of-limit spans return typed rejections.
 * An accepted frame is detached and frozen, with bay sockets in baseline order. */
export function createSupportedFrame(spec: SupportedFrameSpec): SupportedFrame | FrameRejection {
	const result = selectFramePlan(spec);
	if (result.status === 'rejected') return Object.freeze(result);
	const sockets = buildSockets(spec.id, result);
	return Object.freeze({
		status: 'supported',
		sockets,
		object: buildFrameObject(spec.id, result, sockets),
		graph: buildFrameGraph(result),
		bearings: Object.freeze(result.rows.flat())
	});
}
