import type { MovementPort } from '../movement-network';
import type { Vec3 } from '../parametrik/types';
import { fitApproaches } from './ribbon-fit';
import { ribbonCurve } from './ribbon-curve';
import { walkingProfile } from './walking-profile';
import type { TownSpan } from './town-stations';

function meetSill(
	section: ReturnType<typeof ribbonCurve>[number],
	port: MovementPort | undefined,
	sign: number
) {
	if (!port) return;
	const [x, y, z] = port.position;
	const h = (sign * walkingProfile.width) / 2;
	const offset = (scale: number): Vec3 => [
		x - Math.sin(port.heading) * scale,
		y + Math.cos(port.heading) * scale,
		z
	];
	section.centre = [x, y, z];
	section.left = offset(h);
	section.right = offset(-h);
}

/** Groups consecutive spans sharing a cover condition. Sills remain exact edge endpoints. */
export function passageReaches(route: TownSpan[], ground: (x: number, y: number) => number) {
	const groups: TownSpan[][] = [];
	for (const span of route) {
		const tail = groups.at(-1);
		if (!span.adapter && tail && !tail[0].adapter && !!tail[0].inside === !!span.inside)
			tail.push(span);
		else groups.push([span]);
	}
	return groups.map((spans, i) => {
		const first = spans[0],
			last = spans[spans.length - 1];
		const reach = {
			id: last.id,
			ends: [first.a, last.b],
			hubs: [],
			terminals: [first.id + '/start', last.id + '/end'],
			sections: ribbonCurve([first.a, ...spans.map((s) => s.b)], walkingProfile.width, false)
		};
		if (!first.adapter && !first.inside) fitApproaches({ reaches: [reach], forks: [] }, ground);
		meetSill(reach.sections[0], groups[i - 1]?.at(-1)?.port, first.inside ? -1 : 1);
		meetSill(reach.sections[reach.sections.length - 1], last.port, first.inside ? 1 : -1);
		return {
			reach,
			port: last.port,
			adapter: first.adapter,
			inside: first.inside,
			last: i === groups.length - 1
		};
	});
}
