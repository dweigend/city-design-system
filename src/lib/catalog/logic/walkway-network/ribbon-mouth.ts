import { ribbonProfile } from './ribbon-column';
import type { Section } from './ribbon-curve';
/** Seats the end face on the surveyed portal; edge bearings blend over one deck width. */
export function seatMouth(sections: Section[], heading: number) {
	const end = sections[0],
		half = ribbonProfile.width / 2;
	let u = -Math.sin(heading),
		v = Math.cos(heading);
	if ((end.left[0] - end.right[0]) * u + (end.left[1] - end.right[1]) * v < 0) {
		u = -u;
		v = -v;
	}
	let run = 0;
	for (const [i, s] of sections.entries()) {
		if (i) {
			const p = sections[i - 1].centre;
			run += Math.hypot(s.centre[0] - p[0], s.centre[1] - p[1]);
		}
		const t = Math.min(1, run / ribbonProfile.width);
		if (t >= 1) break;
		const nx = (1 - t) * u + (t * (s.left[0] - s.centre[0])) / half,
			ny = (1 - t) * v + (t * (s.left[1] - s.centre[1])) / half;
		const scale = half / Math.hypot(nx, ny);
		s.left = [s.centre[0] + nx * scale, s.centre[1] + ny * scale, s.centre[2]];
		s.right = [s.centre[0] - nx * scale, s.centre[1] - ny * scale, s.centre[2]];
	}
}
