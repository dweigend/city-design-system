import { fitApproaches } from './ribbon-fit';
import { ribbonCurve } from './ribbon-curve';
import { walkingProfile } from './walking-profile';
import type { TownSpan } from './town-stations';

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
		return { reach, adapter: first.adapter, inside: first.inside, last: i === groups.length - 1 };
	});
}
