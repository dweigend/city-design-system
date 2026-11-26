import { encodeKey } from '../../core/ref';
import { distance, isSimpleRing, measurePolygon, type Vec2 } from '../../core/geometry';
import { edgeFrame, lineHits } from './geometry';
import { frontageContacts, type Frontage } from './reserve';
import type {
	HoldingRule,
	AddressedParcel,
	ParcelPortal,
	ParcelTolerance,
	PlanPolygon
} from './types';

type Contact = ReturnType<typeof frontageContacts>[number];
type Ring = readonly Vec2[];

export function areaTolerance(areaM2: number, tolerance: ParcelTolerance) {
	return Math.max(tolerance.areaToleranceM2, areaM2 * tolerance.relativeAreaToleranceRatio);
}

export function eligibleContacts(
	ring: Ring,
	frontage: readonly Frontage[],
	minimumM: number,
	toleranceM: number
) {
	const contacts = frontageContacts(ring, frontage, toleranceM).filter(
		({ lengthM }) => lengthM >= minimumM
	);
	const byAddress = (a: Contact, b: Contact) =>
		(a.laneId < b.laneId ? -1 : Number(a.laneId > b.laneId)) ||
		a.points[0][0] - b.points[0][0] ||
		a.points[0][1] - b.points[0][1];
	contacts.sort((a, b) => b.lengthM - a.lengthM || byAddress(a, b));
	const [first, ...rest] = contacts;
	return first ? [first, ...rest.sort(byAddress)] : [];
}

function midpoint([a, b]: readonly [Vec2, Vec2]): Vec2 {
	return Object.freeze([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
}

function arc(
	ring: Ring,
	start: Vec2,
	after: number,
	before: number,
	end: Vec2,
	toleranceM: number
) {
	const points = [start];
	for (
		let i = (after + 1) % ring.length;
		i !== (before + 1) % ring.length;
		i = (i + 1) % ring.length
	)
		points.push(ring[i]);
	if (distance(points[points.length - 1], end) <= toleranceM) points.pop();
	points.push(end);
	if (distance(points[0], points[1]) <= toleranceM)
		return Object.freeze([points[0], ...points.slice(2)]);
	return Object.freeze(points);
}

function splitFrom(ring: Ring, { points, edgeIndex }: Contact, toleranceM: number) {
	const frame = edgeFrame(...points);
	const entry = midpoint(points);
	const alongM = frame.lengthM / 2;
	const projected = ring.map(frame.read);
	const [exit] = lineHits(projected, alongM)
		.filter(({ left, edge }) => edge !== edgeIndex && left > toleranceM)
		.sort((a, b) => a.left - b.left || a.edge - b.edge);
	if (!exit) return;
	// A tangent vertex can be absent from lineHits, which counts crossings only.
	// A cut between two edge interiors must avoid every intervening vertex.
	for (const [along, left] of projected) {
		if (
			left > toleranceM &&
			left <= exit.left + toleranceM &&
			Math.abs(along - alongM) <= toleranceM
		)
			return;
	}
	const end = frame.pointAt(alongM, exit.left);
	return [
		arc(ring, entry, edgeIndex, exit.edge, end, toleranceM),
		arc(ring, end, exit.edge, edgeIndex, entry, toleranceM)
	] as const;
}

export function partitionFrontage(
	polygon: PlanPolygon,
	frontage: readonly Frontage[],
	rule: HoldingRule,
	tolerance: ParcelTolerance,
	block: { id: string; plannedKind: string },
	component: number
) {
	const parcels: AddressedParcel[] = [];
	const portals: ParcelPortal[] = [];
	const contacts = (ring: Ring) =>
		eligibleContacts(ring, frontage, rule.minimumFrontageM, tolerance.linearToleranceM);
	if (polygon.length !== 1) return { parcels, portals };
	const areaM2 = measurePolygon(polygon[0]).area;
	if (rule.partition && areaM2 < rule.partition.minimumAreaM2) return { parcels, portals };
	const root = contacts(polygon[0]);
	if (!root.length) return { parcels, portals };

	function visit(ring: Ring, areaM2: number, accessible: Contact[], splitPath: readonly number[]) {
		const partition = rule.partition;
		if (partition && areaM2 > partition.targetAreaM2) {
			for (const contact of accessible) {
				const halves = splitFrom(ring, contact, tolerance.linearToleranceM);
				if (!halves) continue;
				const areas = halves.map((half) => measurePolygon(half).area);
				if (areas.some((area) => area < partition.minimumAreaM2 || area >= areaM2)) continue;
				if (Math.abs(areas[0] + areas[1] - areaM2) > areaTolerance(areaM2, tolerance)) continue;
				const newContacts = halves.map(contacts);
				if (newContacts.some((list) => list.length === 0)) continue;
				halves.forEach((half, index) =>
					visit(half, areas[index], newContacts[index], Object.freeze([...splitPath, index]))
				);
				return;
			}
		}
		const { parcel, portal } = addressHolding(
			block,
			ring,
			splitPath,
			areaM2,
			accessible[0],
			rule.publicUse ?? false
		);
		parcels.push(parcel);
		portals.push(portal);
	}
	visit(polygon[0], areaM2, root, Object.freeze([component]));
	return { parcels, portals };
}

function addressHolding(
	block: { id: string; plannedKind: string },
	ring: Ring,
	splitPath: readonly number[],
	areaM2: number,
	contact: Contact,
	publicUse = false
) {
	// The published parcel address stores its split path as a nested array.
	const id = JSON.stringify([block.id, splitPath]);
	const { laneId, points, lengthM: frontageM, edgeIndex } = contact;
	const portalId = encodeKey([id, laneId, 'frontage']);
	// Relative to the addressed frontage, independent of the ring's starting vertex.
	const corners = Object.freeze(
		ring.map((position, index) =>
			Object.freeze({
				id:
					'corner/' +
					encodeKey([portalId, ring.length, (index - edgeIndex + ring.length) % ring.length]),
				position
			})
		)
	);
	const side = Object.freeze([
		corners[edgeIndex].id,
		corners[(edgeIndex + 1) % ring.length].id
	] as const);
	const parcel = Object.freeze({
		id,
		blockId: block.id,
		splitPath,
		plannedKind: block.plannedKind,
		publicUse,
		outline: ring,
		corners,
		areaM2,
		portalId
	});
	return {
		parcel,
		portal: Object.freeze({ id: portalId, parcelId: id, laneId, points, frontageM, side })
	};
}

export function subdivideParcelFrontage(
	parcel: AddressedParcel,
	portal: ParcelPortal,
	minimum: Readonly<{ areaM2: number; frontageM: number; depthM: number }>,
	linearToleranceM: number
):
	| readonly [
			Readonly<{ parcel: AddressedParcel; portal: ParcelPortal }>,
			Readonly<{ parcel: AddressedParcel; portal: ParcelPortal }>
	  ]
	| undefined {
	if (
		![minimum.areaM2, minimum.frontageM, minimum.depthM, linearToleranceM].every(
			(value) => Number.isFinite(value) && value > 0
		)
	)
		throw new RangeError('Split dimensions and tolerance must be positive and finite');
	if (parcel.publicUse || portal.parcelId !== parcel.id || portal.id !== parcel.portalId)
		return undefined;
	const { outline, corners } = parcel;
	const edgeIndex = corners.findIndex(({ id }) => id === portal.side[0]);
	if (edgeIndex < 0 || corners[(edgeIndex + 1) % corners.length].id !== portal.side[1])
		return undefined;
	const { laneId, points, frontageM: lengthM } = portal;
	const halves = splitFrom(outline, { laneId, points, lengthM, edgeIndex }, linearToleranceM);
	if (!halves || distance(halves[0][0], halves[1][0]) < minimum.depthM) return undefined;
	const areas = halves.map((ring) => measurePolygon(ring).area);
	// A linear displacement along the boundary bounds the first-order area error of the cut.
	const perimeterM = outline.reduce(
		(sum, point, i) => sum + distance(point, outline[(i + 1) % outline.length]),
		0
	);
	if (
		halves.some((ring, index) => areas[index] < minimum.areaM2 || !isSimpleRing(ring)) ||
		Math.abs(areas[0] + areas[1] - parcel.areaM2) > linearToleranceM * perimeterM
	)
		return undefined;
	const frontage = [
		{
			laneId,
			frame: edgeFrame(...points),
			depthM: /* Exact arithmetic: frame starts on the portal line. */ 0,
			sideIndex: edgeIndex
		}
	];
	const contacts = halves.map(
		(half) => eligibleContacts(half, frontage, minimum.frontageM, linearToleranceM)[0]
	);
	if (!contacts[0] || !contacts[1]) return undefined;
	const block = { id: parcel.blockId, plannedKind: parcel.plannedKind };
	const child = (index: 0 | 1) => {
		const ring = Object.freeze(
			halves[index].map((point) =>
				Object.isFrozen(point) ? point : Object.freeze<Vec2>([...point])
			)
		);
		const contact = contacts[index];
		return Object.freeze(
			addressHolding(
				block,
				ring,
				Object.freeze([...parcel.splitPath, index]),
				areas[index],
				contact
			)
		);
	};
	return Object.freeze([
		child(/* Exact arithmetic: first half. */ 0),
		child(/* Exact arithmetic: second half. */ 1)
	] as const);
}
