import { bicycle, pushcart, wheel } from './deck-vehicles';
import { block, plate } from '../assembly';
import { rod } from '../parts';
import { rounded } from './kit-recipe';
import { streetSeries, lengths, lengthNames, supports } from './street-series';

function parkedCycle(cargo: boolean) {
	return streetSeries(
		cargo ? 'cargo-bike' : 'bicycle',
		['commuter', 'basket', 'pannier', 'courier'],
		() => [cargo ? 3.75 : 2.5, 1.25],
		['frame', 'trim', 'accent'],
		['small-wheel', 'road-wheel', 'touring-wheel'],
		(i, v) => {
			const parts = bicycle(0, 0, cargo, 0.25 + v * 0.05);
			parts.push(
				block(-0.4, 0, 0.75, 0.45, 0.35, 0.05, 'accent'),
				rod([-0.4, 0, 0.75], [-0.55, 0, 0.25 + v * 0.05], 0.06, 'frame')
			);
			if (i === 1) parts.push(rounded(0.5, 0, 0.95, 0.4, 0.45, 0.3, 'accent'));
			if (i === 2)
				for (const y of [-0.2, 0.2]) parts.push(block(-0.4, y, 0.4, 0.45, 0.15, 0.35, 'accent'));
			if (i === 3) parts.push(rounded(-0.4, 0, 0.8, 0.5, 0.5, 0.5, 'accent'));
			return parts;
		}
	);
}
function trolley(two: boolean) {
	return streetSeries(
		two ? 'handcart' : 'cart',
		['platform', 'sideboard', 'crate-bed', 'canopy'],
		() => [3.75, 1.25],
		['frame', 'trim', 'body'],
		['short-bed', 'standard-bed', 'long-bed'],
		(i, v) => {
			const w = 0.8 + v * 0.2,
				h = two ? 0.5 : 0.45;
			const parts = two
				? [
						wheel(0, -0.4, 0.3),
						wheel(0, 0.4, 0.3),
						rounded(0, 0, 0.35, w, 0.75, 0.15, 'frame'),
						...[-0.25, 0.25].map((y) => rod([-w / 2, y, h], [-w / 2 - 0.6, y, 0.9], 0.06, 'frame'))
					]
				: pushcart(0, 0, false, w);
			parts.push(rounded(0, 0, h, w, 0.75, 0.05, 'body'));
			if (i === 1)
				for (const y of [-0.3, 0.3]) parts.push(block(0, y, h + 0.05, w, 0.12, 0.25, 'body'));
			if (i === 2) parts.push(rounded(0, 0, h + 0.05, w, 0.75, 0.55, 'body'));
			if (i === 3)
				parts.push(
					...[-0.3, 0.3].map((y) => block(0, y, h + 0.05, 0.12, 0.12, 0.85, 'frame')),
					rounded(0, 0, h + 0.9, w, 0.75, 0.15, 'body')
				);
			return parts;
		}
	);
}
function boat(canoe: boolean) {
	const sizes = [2.5, 3.75, 5, 6.25];
	return streetSeries(
		canoe ? 'canoe' : 'skiff',
		['2p5m', '3p75m', '5m', '6p25m'],
		(i) => [sizes[i], canoe ? 1.25 : 2.5],
		['body', 'edge', 'accent'],
		['single-thwart', 'two-thwart', 'three-thwart'],
		(i, v) => {
			const l = sizes[i] / 2,
				b = canoe ? 0.5 : 0.9;
			const outline = (x: number, y: number): [number, number][] => [
				[-l + x, 0],
				[-l * 0.55, -y],
				[l * 0.55, -y],
				[l - x, 0],
				[l * 0.55, y],
				[-l * 0.55, y]
			];
			const hull = outline(0, b);
			return [
				plate(hull, 0, 0.15, 'body'),
				plate(hull, 0.15, 0.35, 'edge', outline(0.3, b - 0.15).reverse()),
				...Array.from({ length: v + 1 }, (_, j) =>
					block((j - v / 2) * l * 0.4, 0, 0.5, 0.3, 2 * b, 0.1, 'accent')
				)
			];
		}
	);
}
function jetty(landing: boolean) {
	return streetSeries(
		landing ? 'ferry-landing' : 'jetty',
		lengthNames,
		(i) => [lengths[i], landing ? 2.5 : 1.25],
		['frame', 'deck', 'edge'],
		['low-pier', 'tidal-pier', 'high-pier'],
		(i, v) => {
			const w = lengths[i],
				d = landing ? 2.5 : 1.25,
				h = 0.5 + v * 0.25;
			return [
				...supports(w, d, h),
				rounded(0, 0, h, w, d, 0.15, 'deck'),
				...[-1, 1].map((s) =>
					block(s * (w / 2 - 0.15), d / 2 - 0.15, h + 0.15, 0.3, 0.3, landing ? 1.1 : 0.35, 'edge')
				),
				...(landing ? [block(0, d / 2 - 0.15, h + 1.25, w, 0.12, 0.12, 'edge')] : [])
			];
		}
	);
}
export const streetTransport = [
	...parkedCycle(false),
	...parkedCycle(true),
	...trolley(false),
	...trolley(true),
	...boat(false),
	...boat(true),
	...jetty(false),
	...jetty(true)
];
