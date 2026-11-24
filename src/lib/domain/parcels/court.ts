import { areaTolerance, eligibleContacts } from './frontage';
import { edgeFrame, intersect, lineHits, polygonArea, rectangle, subtract } from './geometry';
import { inwardStrip, type Frontage } from './reserve';
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
		ring.map((point, i) => inwardStrip(edgeFrame(point, ring[(i + 1) % ring.length]), insetM)),
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
		const coveredM2 = intersect(net, ribbon, linearToleranceM).reduce(
			(sum, part) => sum + polygonArea(part),
			0
		);
		if (Math.abs(coveredM2 - areaM2) > areaTolerance(areaM2, tolerance)) continue;
		const widthAtCourt = intersect(
			court,
			rectangle(frame, near, end, far - halfWidth, far),
			linearToleranceM
		);
		const endM2 = passageWidthM * halfWidth;
		if (
			Math.abs(widthAtCourt.reduce((sum, part) => sum + polygonArea(part), 0) - endM2) >
			areaTolerance(endM2, tolerance)
		)
			continue;
		const passage = subtract(ribbon, [court], linearToleranceM);
		const land = subtract(net, [court, ribbon], linearToleranceM);
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
