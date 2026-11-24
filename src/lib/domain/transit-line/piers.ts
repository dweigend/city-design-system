import { defaults } from '../../../config/transit-line';
import type { Vec2 } from '../../core/geometry';
import type { Frame } from './corridor';
import type { RailPier, StraightLevelRailSurvey } from './types';

export function railPiers(
	axis: Frame,
	survey: StraightLevelRailSurvey,
	heightM: number
): RailPier[] {
	const { pierIntervalM, pierDryClearanceM, pierSearchM, surveyStepM } = defaults;
	const intervals = Math.ceil(axis.lengthM / pierIntervalM);
	const anchors = (survey.anchors ?? []).flatMap(({ id, point }) => {
		const [station, offset] = axis.locate(point);
		if (station < 0 || station > axis.lengthM || Math.abs(offset) > pierSearchM) return [];
		const ground = survey.readGround(...point);
		return ground.dryClearanceM < pierDryClearanceM || ground.heightM >= heightM
			? []
			: [{ id, point, station, offset, ground }];
	});
	const used = new Set<string>();
	const piers: RailPier[] = [];
	for (let i = 0; i <= intervals; i++) {
		const station = (i * axis.lengthM) / intervals;
		const point = axis.at(station);
		const existing = anchors
			.filter(
				(anchor) => !used.has(anchor.id) && Math.abs(anchor.station - station) <= pierIntervalM / 2
			)
			.sort(
				(a, b) =>
					Math.hypot(a.station - station, a.offset) - Math.hypot(b.station - station, b.offset) ||
					(a.id < b.id ? -1 : 1)
			)[0];
		if (existing) {
			used.add(existing.id);
			piers.push({
				top: [...axis.at(existing.station), heightM],
				base: [...existing.point, existing.ground.heightM],
				anchorId: existing.id
			});
		} else {
			const candidates: Vec2[] = [point];
			for (let offset = surveyStepM; offset <= pierSearchM; offset += surveyStepM)
				candidates.push(axis.at(station, offset), axis.at(station, -offset));
			for (const base of candidates) {
				if (survey.requiresAnchor?.(base)) continue;
				const ground = survey.readGround(...base);
				if (ground.dryClearanceM < pierDryClearanceM || ground.heightM >= heightM) continue;
				piers.push({ top: [...point, heightM], base: [...base, ground.heightM] });
				break;
			}
		}
	}
	return piers;
}
