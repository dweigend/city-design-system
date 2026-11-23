import { defaults } from './settings';
import type { Random } from '../../core/random';
import type { RiverCourse } from './course';

const {
	regionalChordHalfSpanM,
	centralTerraceRadiusM,
	regionalTerraceBlendRunM,
	regionalShoulderBlendRunM,
	regionalFlankStartM,
	regionalFlankRiseRunM,
	terraceScallopLongAmplitudeM,
	terraceScallopLongScaleM,
	terraceScallopShortAmplitudeM,
	terraceScallopShortScaleM,
	regionalShoulderBaseRiseM,
	regionalShoulderAmplitudeM,
	regionalShoulderWaveScaleM
} = defaults;

// Exact arithmetic: the cubic smoothstep polynomial has zero derivative at both ends.
export function smoothstep(value: number) {
	const t = Math.max(0, Math.min(1, value));
	return t * t * (3 - 2 * t);
}

function alongCourse(course: RiverCourse, fx: number, fy: number) {
	const stations: number[] = [];
	const offsets: number[] = [];
	for (let i = 0; i < course.xy.length; i += 2) {
		const [x, y] = [course.xy[i], course.xy[i + 1]];
		stations.push(x * fx + y * fy);
		offsets.push(y * fx - x * fy);
	}
	return (station: number) => {
		let low = 0;
		let high = stations.length - 1;
		while (high - low > 1) {
			const middle = (low + high) >>> 1;
			if (stations[middle] < station) low = middle;
			else high = middle;
		}
		const t = Math.max(
			0,
			Math.min(1, (station - stations[low]) / (stations[high] - stations[low]))
		);
		return offsets[low] + (offsets[high] - offsets[low]) * t;
	};
}

// Exact arithmetic: the normalized three-point binomial stencil weights are 1:2:1.
function smoothChordCenter(before: number, at: number, after: number) {
	return (before + 2 * at + after) / 4;
}

// Exact arithmetic: the tangent slope is expressed per unit of longitudinal distance.
const longitudinalUnit = 1;

/** Continues the local terrace profile along a smoothed meander belt beyond the measurement plot. */
export function regionalProfile(course: RiverCourse, random: Random) {
	const fx = Math.cos(course.bearing);
	const fy = Math.sin(course.bearing);
	const centerAt = alongCourse(course, fx, fy);
	const phase = random.derive('terrace-edge').number() * 2 * Math.PI;
	return (x: number, y: number) => {
		const station = x * fx + y * fy;
		const cross = y * fx - x * fy;
		const before = centerAt(station - regionalChordHalfSpanM);
		const after = centerAt(station + regionalChordHalfSpanM);
		const center = smoothChordCenter(before, centerAt(station), after);
		const scallop =
			terraceScallopLongAmplitudeM * Math.sin(station / terraceScallopLongScaleM + phase) +
			terraceScallopShortAmplitudeM * Math.sin(station / terraceScallopShortScaleM - phase);
		const lateral =
			(cross - center - scallop) /
			Math.hypot(longitudinalUnit, (after - before) / (2 * regionalChordHalfSpanM));
		const rate = smoothstep((Math.abs(station) - centralTerraceRadiusM) / regionalTerraceBlendRunM);
		const highGround = smoothstep(
			(Math.hypot(x, y) - centralTerraceRadiusM) / regionalShoulderBlendRunM
		);
		const flank = smoothstep((Math.abs(lateral) - regionalFlankStartM) / regionalFlankRiseRunM);
		const shoulder =
			highGround *
			flank *
			(regionalShoulderBaseRiseM +
				regionalShoulderAmplitudeM * Math.sin(station / regionalShoulderWaveScaleM + phase));
		return { rate, lateral, shoulder };
	};
}
