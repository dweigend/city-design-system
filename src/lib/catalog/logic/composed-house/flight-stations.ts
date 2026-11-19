import type { Section } from './types';
import { stairTrack, publicStair } from './stair-track';
import { roofLanding } from './roof-landing';
import { houseStair } from '../../data/house-stair';
const { going } = houseStair;
function flightEdge(s: Section, sign: number) {
	const { flightWidth: width } = s.composition;
	const bay = s.composition.bay;
	if (s.typology === 'cluster-mast') {
		const edges = s.composition.levels.flatMap((l) =>
			l.bodies.map(
				(b) =>
					sign * b.position[1] +
					(Math.abs(Math.sin(b.rotation)) * b.size[0] +
						Math.abs(Math.cos(b.rotation)) * b.size[1]) /
						2
			)
		);
		return (
			sign *
			Math.min(
				sign * bay.y + bay.depth / 2 + (width > 2 ? 0.45 : 0) - 2 * width,
				Math.max(...edges, sign * s.composition.core.position[1] + 0.2) + 0.015
			)
		);
	}
	return roofLanding(s)[1];
}
/** Reserves the two runs and rounded turns inside the surveyed facade strip. */
export function flightStations(s: Section) {
	const { flightWidth: width } = s.composition;
	const { x, width: bayWidth } = s.composition.bay;
	const court = s.composition.levels[0].court;
	const span = court ? court.width - 0.44 : bayWidth;
	const path = s.composition.path;
	const count = Math.min(width > 2 ? 16 : 17, Math.floor((span - width) / going));
	const flank = ['core', 'cascade', 'external'].includes(path);
	const length = count * going;
	const left =
		path === 'cascade' ? x + (span - width) / 2 - length : x - (flank ? span - width : length) / 2;
	const sign = s.composition.accessSide === 'north' ? 1 : -1;
	const rear = court
		? court.center[1] - (sign * court.width) / 2 + sign * 0.22
		: flightEdge(s, sign);
	return broadStations(x, span, rear, sign, left + length / 2);
}

function broadStations(x: number, span: number, rear: number, sign: number, preferred: number) {
	const { width, half, radius } = publicStair;
	const straight = Math.min(12, Math.max(0, Math.floor((span - 2 * radius - width) / going)));
	const halfSpan = radius + width / 2 + (straight * going) / 2;
	const cx = Math.max(x - span / 2 + halfSpan, Math.min(x + span / 2 - halfSpan, preferred));
	const cy = rear + sign * (radius + width / 2);
	return stairTrack([cx, cy], Math.PI / 2, straight, half).map((station, i) => ({
		x: station.xy[0],
		y: station.xy[1],
		turn: i % half === 0,
		station
	}));
}
