import { reserveCourt } from './court';
import { areaTolerance, partitionFrontage } from './frontage';
import { polygonArea } from './geometry';
import type { Frontage } from './reserve';
import type {
	HoldingRule,
	Parcel,
	ParcelBlock,
	ParcelPortal,
	ParcelTolerance,
	PlanPolygon
} from './types';

type BlockReserve = Pick<
	ParcelBlock,
	'id' | 'plannedKind' | 'grossAreaM2' | 'laneAreaM2' | 'netGround'
>;

function areaOf(polygons: readonly PlanPolygon[]) {
	return polygons.reduce((sum, part) => sum + polygonArea(part), 0);
}

export function realizeHoldings(
	block: BlockReserve,
	frontage: readonly Frontage[],
	rule: HoldingRule,
	tolerance: ParcelTolerance
) {
	const [net] = block.netGround;
	const court =
		rule.court && block.netGround.length === 1 && net.length === 1
			? reserveCourt(net, frontage, { ...rule, court: rule.court }, tolerance, block.id)
			: undefined;
	const land = court?.land ?? block.netGround;
	const parcelableGround: PlanPolygon[] = [];
	const openGround: PlanPolygon[] = [];
	const parcels: Parcel[] = [];
	const portals: ParcelPortal[] = [];
	for (const [component, polygon] of land.entries()) {
		const split = partitionFrontage(polygon, frontage, rule, tolerance, block, component);
		if (split.parcels.length === 0) {
			openGround.push(polygon);
			continue;
		}
		parcelableGround.push(polygon);
		parcels.push(...split.parcels);
		portals.push(...split.portals);
	}
	const courtGround = court ? [court.court] : [];
	const passageGround = court?.passage ?? [];
	const parcelAreaM2 = parcels.reduce((sum, { areaM2 }) => sum + areaM2, 0);
	const accounting = Object.freeze({
		parcelAreaM2,
		passageAreaM2: areaOf(passageGround),
		courtAreaM2: areaOf(courtGround),
		openAreaM2: areaOf(openGround)
	});
	const total = block.laneAreaM2 + Object.values(accounting).reduce((sum, area) => sum + area, 0);
	if (Math.abs(block.grossAreaM2 - total) > areaTolerance(block.grossAreaM2, tolerance))
		throw new Error('Public ground and holdings do not account for block ' + block.id);
	return {
		block: {
			courtFit: !rule.court ? 'not-planned' : court ? 'fit' : 'did-not-fit',
			parcelableGround: Object.freeze(parcelableGround),
			publicGround: Object.freeze({
				open: Object.freeze(openGround),
				court: Object.freeze(courtGround),
				passage: Object.freeze(passageGround),
				...(court ? { entrance: court.entrance } : {})
			}),
			accounting
		} as const,
		parcels: Object.freeze(parcels),
		portals: Object.freeze(portals)
	};
}
