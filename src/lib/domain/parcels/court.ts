import { areaTolerance, eligibleContacts } from './frontage';
import { edgeFrame, intersect, lineHits, polygonArea, rectangle, subtract } from './geometry';
import { frontageContacts, type Frontage } from './reserve';
import type { CourtEntrance, HoldingRule, ParcelTolerance, PlanPolygon } from './types';

export function reserveCourt(
	net: PlanPolygon,
	frontage: readonly Frontage[],
	rule: HoldingRule & { court: NonNullable<HoldingRule['court']> },
	tolerance: ParcelTolerance,
	blockId: string
) {
	const [ring] = net;
	const { insetM, passageWidthM } = rule.court;
	const { linearToleranceM } = tolerance;
	const insets = subtract(
		net,
		ring.map((point, i) => {
			const frame = edgeFrame(point, ring[(i + 1) % ring.length]);
			return rectangle(frame, -insetM, frame.lengthM + insetM, -insetM, insetM);
		}),
		linearToleranceM
	);
	if (insets.length !== 1 || insets[0].length !== 1) return;
	const court = insets[0];
	const courtAreaM2 = polygonArea(court);
	if (courtAreaM2 <= tolerance.areaToleranceM2) return;
	const halfWidth = passageWidthM / 2;
	// Exact arithmetic: The frontage is the datum of the passage frame.
	const entranceLineM = 0;
	const contacts = eligibleContacts(ring, frontage, passageWidthM, linearToleranceM);
	const entrances = contacts.flatMap(({ points, laneId, edgeIndex }) => {
		const frame = edgeFrame(...points);
		const alongM = frame.lengthM / 2;
		const hits = lineHits(court[0], frame, alongM).filter(({ left }) => left > linearToleranceM);
		hits.sort((a, b) => a.left - b.left);
		const [entry, exit] = hits;
		if (!entry || !exit) return [];
		// Stop inside the court so independent polygon rounding still leaves a shared entrance.
		const far = (entry.left + exit.left) / 2;
		return [{ laneId, edgeIndex, frame, alongM, far, distanceM: entry.left }];
	});
	entrances.sort((a, b) => a.distanceM - b.distanceM || a.edgeIndex - b.edgeIndex);

	for (const { laneId, frame, alongM, far } of entrances) {
		const areaM2 = far * passageWidthM;
		const near = alongM - halfWidth;
		const end = alongM + halfWidth;
		const ribbon = rectangle(frame, near, end, entranceLineM, far);
		const covered = intersect(net, ribbon, linearToleranceM);
		if (covered.length !== 1 || covered[0].length !== 1) continue;
		const [clipped] = covered;
		if (Math.abs(polygonArea(clipped) - areaM2) > areaTolerance(areaM2, tolerance)) continue;
		const mouth = frontageContacts(
			clipped[0],
			[{ laneId, frame, depthM: entranceLineM }],
			linearToleranceM
		);
		if (!mouth.some(({ lengthM }) => lengthM >= passageWidthM - linearToleranceM)) continue;
		const endStrip = rectangle(frame, near, end, far - halfWidth, far);
		const courtContact = intersect(clipped, court, linearToleranceM);
		const endM2 = courtContact.reduce(
			(sum, part) =>
				sum +
				intersect(part, endStrip, linearToleranceM).reduce(
					(area, piece) => area + polygonArea(piece),
					0
				),
			0
		);
		const endToleranceM2 = 2 * (passageWidthM + halfWidth) * linearToleranceM;
		if (Math.abs(endM2 - passageWidthM * halfWidth) > endToleranceM2) continue;
		const passage = subtract(clipped, [court], linearToleranceM);
		const land = subtract(net, [court, clipped], linearToleranceM);
		if (
			!land.length ||
			land.some(
				(part) =>
					part.length !== 1 ||
					!eligibleContacts(part[0], frontage, rule.minimumFrontageM, linearToleranceM).length
			)
		)
			continue;
		const entrance: CourtEntrance = Object.freeze({
			id: JSON.stringify([blockId, laneId, 'court']),
			blockId,
			laneId,
			points: Object.freeze([
				frame.pointAt(near, entranceLineM),
				frame.pointAt(end, entranceLineM)
			] as const),
			frontageM: passageWidthM
		});
		return { court, passage, land, entrance };
	}
}
