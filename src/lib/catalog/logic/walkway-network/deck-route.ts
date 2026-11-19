import { houseStair } from '../../data/house-stair';
import { distance, mix, nearest, separation, survey } from './clearance';
import { epsilon, type NetworkInput, type Point, type Position, type Segment } from './types';

type Port = { id: string; p: Position };
type Pair = { first: Port; second: Port; span: Segment };
type Field = ReturnType<typeof survey>;
function pairs(input: NetworkInput, field: Field) {
	const ports = input.houses.flatMap((h) => (h.ports ?? []).map((p) => ({ id: h.id, p })));
	const options: Pair[] = [];
	for (const first of ports)
		for (const second of ports) {
			if (first.id === second.id || first.p[2] !== second.p[2]) continue;
			const span = { a: plan(first.p), b: plan(second.p) },
				length = distance(span.a, span.b);
			if (length > epsilon && length <= 20 && field.clear(span.a, span.b))
				options.push({ first, second, span });
		}
	return options.sort(
		(a, b) =>
			distance(a.span.a, a.span.b) - distance(b.span.a, b.span.b) ||
			a.first.id.localeCompare(b.first.id)
	);
}
export function plan(p: Position): Point {
	return [p[0], p[1]];
}
function stairFoot(input: NetworkInput, entry: Point, top: Point, z: number) {
	const run = distance(entry, top);
	// Sample each possible stock flight at its actual foot, including on slopes.
	for (let count = 1; count * houseStair.going <= Math.min(run, 25) + epsilon; count++) {
		const foot = mix(top, entry, (count * houseStair.going) / run);
		const rise = z - input.terrain(...foot);
		if (rise > 0 && Math.ceil(rise / houseStair.rise) === count) return foot;
	}
}
function approach(input: NetworkInput, entry: Point, pair: Pair) {
	const top = pair.span.a,
		z = pair.first.p[2],
		rise = z - input.terrain(...entry);
	const run = distance(entry, top);
	if (rise <= 0 || run < epsilon) return;
	if (rise / run <= 0.08 && run <= 25) return { foot: entry, kind: 'ramp' as const };
	const foot = stairFoot(input, entry, top, z);
	if (foot) return { foot, kind: 'stair' as const };
}
function aboveTerrain(input: NetworkInput, span: Segment, startZ: number, endZ: number) {
	const n = Math.ceil(distance(span.a, span.b));
	for (let i = 0; i <= n; i++)
		if (input.terrain(...mix(span.a, span.b, i / n)) > startZ + ((endZ - startZ) * i) / n + epsilon)
			return false;
	return true;
}
function candidate(
	input: NetworkInput,
	tree: Segment[],
	pair: Pair,
	segment: Segment,
	field: Field
) {
	const entry = nearest(pair.span.a, segment);
	if (!field.clear(entry, pair.span.a)) return;
	const flight = approach(input, entry, pair);
	if (!flight) return;
	const lead = { a: entry, b: flight.foot },
		climb = { a: flight.foot, b: pair.span.a };
	if (!aboveTerrain(input, climb, input.terrain(...flight.foot), pair.first.p[2])) return;
	if (separation(lead, pair.span) < 3 - epsilon) return;
	if (
		tree.some((s) => separation(s, lead) < epsilon && distance(entry, nearest(entry, s)) > epsilon)
	)
		return;
	if (
		tree.some(
			(s) => distance(entry, nearest(entry, s)) > epsilon && separation(s, climb) < 3 - epsilon
		)
	)
		return;
	// A flight approaching from the far end would double back under the bridge.
	if (distance(climb.a, nearest(climb.a, pair.span)) + epsilon < distance(climb.a, climb.b)) return;
	return {
		pair,
		segment,
		entry,
		...flight,
		cost: distance(entry, pair.span.a) + distance(pair.span.a, pair.span.b)
	};
}
type Flight = NonNullable<ReturnType<typeof candidate>>;
function canExtend(route: Pair[], link: Pair, flight: Flight) {
	const tail = route[route.length - 1];
	if (link.first !== tail.second || route.some((s) => s.first.id === link.second.id)) return false;
	const approachSpan = { a: flight.entry, b: flight.pair.span.a };
	if (separation(link.span, approachSpan) < 3 - epsilon) return false;
	return (
		route.slice(0, -1).every((s) => separation(s.span, link.span) > epsilon) &&
		distance(tail.span.a, nearest(tail.span.a, link.span)) + epsilon >=
			distance(tail.span.a, tail.span.b)
	);
}
function extend(flight: Flight, links: Pair[]) {
	const route = [flight.pair],
		options = [];
	let cost = flight.cost;
	while (true) {
		options.push({ ...flight, route: [...route], cost });
		const next = links.find((link) => canExtend(route, link, flight));
		if (!next) return options;
		route.push(next);
		cost += distance(next.span.a, next.span.b);
	}
}
export function deckOptions(input: NetworkInput, tree: Segment[], field: Field) {
	const options = [];
	const links = pairs(input, field).filter(
		({ span, first }) =>
			tree.every((s) => separation(s, span) >= 3 - epsilon) &&
			aboveTerrain(input, span, first.p[2] - 0.25, first.p[2] - 0.25)
	);
	for (const pair of links)
		for (const segment of tree) {
			const option = candidate(input, tree, pair, segment, field);
			if (option) options.push(...extend(option, links));
		}
	return options.sort((a, b) => b.route.length - a.route.length || a.cost - b.cost);
}
