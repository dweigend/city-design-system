import { defaults } from '../../../config/transit-line';
import type { Frame } from './corridor';
import type { RailPier, RailStation, StraightLevelRailSurvey } from './types';

export function railStations(
	axis: Frame,
	piers: readonly RailPier[],
	survey: StraightLevelRailSurvey
): RailStation[] {
	const bearings = piers
		.map(({ top, base }) => ({
			top,
			base,
			stationM: axis.locate([top[0], top[1]])[0]
		}))
		.filter(
			({ stationM }) =>
				stationM >= defaults.stationMarginM && stationM <= axis.lengthM - defaults.stationMarginM
		);
	return (survey.catchments ?? []).flatMap(({ id, approaches }) => {
		const pairs = approaches.flatMap((approach) => {
			const [stationM, offsetM] = axis.locate(approach.point);
			if (
				Math.abs(offsetM) > survey.dockReachM ||
				stationM < -survey.dockReachM ||
				stationM > axis.lengthM + survey.dockReachM ||
				survey.readGround(...approach.point).dryClearanceM <= 0
			)
				return [];
			return bearings.flatMap(({ top, base, stationM }) => {
				const distanceM = Math.hypot(approach.point[0] - top[0], approach.point[1] - top[1]);
				return distanceM <= survey.dockReachM ? [{ approach, top, base, stationM, distanceM }] : [];
			});
		});
		pairs.sort(
			(a, b) =>
				a.distanceM - b.distanceM ||
				(a.approach.id < b.approach.id ? -1 : Number(a.approach.id > b.approach.id)) ||
				a.stationM - b.stationM
		);
		const best = pairs.find(({ approach, top }) => survey.acceptsApproach?.(approach, top) ?? true);
		return best
			? [
					{
						id,
						approachId: best.approach.id,
						stationM: best.stationM,
						position: best.top,
						base: best.base
					}
				]
			: [];
	});
}
