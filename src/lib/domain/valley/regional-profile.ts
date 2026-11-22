import type { Random } from '../../core/random';
import type { RiverCourse } from './course';

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

/** Continues the local terrace profile along a smoothed meander belt beyond the measurement plot. */
export function regionalProfile(course: RiverCourse, random: Random) {
	const fx = Math.cos(course.bearing);
	const fy = Math.sin(course.bearing);
	const centerAt = alongCourse(course, fx, fy);
	const phase = random.derive('terrace-edge').number() * 2 * Math.PI;
	const bankPhase = random.derive('bank').number() * 2 * Math.PI;
	return (x: number, y: number) => {
		const station = x * fx + y * fy;
		const cross = y * fx - x * fy;
		const before = centerAt(station - 420);
		const after = centerAt(station + 420);
		const center = (before + 2 * centerAt(station) + after) / 4;
		const scallop = 49 * Math.sin(station / 337 + phase) + 14 * Math.sin(station / 126 - phase);
		const lateral = (cross - center - scallop) / Math.hypot(1, (after - before) / 840);
		const rate = smoothstep((Math.abs(station) - 1420) / 1100);
		const bankWidth =
			rate * (31 * Math.sin(station / 630 + bankPhase) + 14 * Math.sin(station / 220 - bankPhase));
		const highGround = smoothstep((Math.hypot(x, y) - 1420) / 950);
		const flank = smoothstep((Math.abs(lateral) - 650) / 1550);
		const shoulder = highGround * flank * (6 + 3 * Math.sin(station / 700 + phase));
		return { rate, lateral, bankWidth, shoulder };
	};
}
