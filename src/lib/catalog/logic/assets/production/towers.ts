import { drum, cap, surface } from '../parts';
import { plate, circle, pipe, crescent } from '../assembly';
import { series } from './series';
import type { Vec3 } from '../../parametrik/types';
import type { ObjectGeometry } from '../object-geometry';

const tower = series(
	'stair-towers',
	'deck',
	[3.75, 5, 6.25],
	['one-turn', 'two-turn', 'three-turn']
);
type Crown = 'lantern' | 'belvedere' | 'funnel' | 'parasol' | 'garden' | 'beacon' | 'open';
function crown(shape: Crown, r: number, z: number): ObjectGeometry[] {
	switch (shape) {
		case 'lantern':
			return [
				drum([0, 0, z], r * 0.65, 1.6, 'glass'),
				cap([0, 0, z + 1.6], r * 0.69, 0.42, 'body')
			];
		case 'belvedere':
			return [
				...circle(r * 0.6, 3).map(([x, y]) => drum([x, y, z], 0.17, 1.8, 'body')),
				cap([0, 0, z + 1.8], r * 0.9, 0.35, 'body')
			];
		case 'funnel':
			return [
				{
					...surface('brass'),
					kind: 'halfpipe',
					position: [0, 0, z],
					width: r * 1.8,
					length: r * 1.45,
					rise: r,
					thickness: 0.24
				}
			];
		case 'parasol':
			return [drum([0, 0, z], 0.24, 1.8, 'body'), cap([0, 0, z + 1.8], r, 0.65, 'body')];
		case 'garden':
			return [...circle(r * 0.46, 3).map(([x, y]) => cap([x, y, z], 0.42 * r, 0.85, 'planting'))];
		case 'beacon':
			return [
				drum([0, 0, z], r * 0.42, 1.5, 'glass'),
				cap([0, 0, z + 1.5], r * 0.43, 0.45, 'glass')
			];
		case 'open':
			return [drum([0, 0, z], r * 0.29, 0.32, 'body')];
	}
}
function stair(shape: Crown) {
	const trim =
		shape === 'beacon' || shape === 'lantern'
			? 'glass'
			: shape === 'garden'
				? 'planting'
				: shape === 'funnel'
					? 'brass'
					: 'body';
	return tower(
		shape + '-spiral-tower',
		[...new Set(['body', 'slats', trim] as const)],
		(w) => w,
		(w, v) => {
			const r = w / 2 - 0.12,
				turns = v + 1,
				steps = turns * 16,
				rise = 0.18,
				h = steps * rise;
			const xy = (t: number, d: number): [number, number] => [d * Math.cos(t), d * Math.sin(t)];
			const rail: Vec3[] = [],
				parts: ObjectGeometry[] = [drum([0, 0, 0], r * 0.3, h, 'body')];
			for (let i = 0; i < steps; i++) {
				const a = (i * Math.PI) / 8,
					b = a + Math.PI / 8,
					z = rise * i;
				parts.push(
					plate(
						[xy(a, r * 0.26), xy(a, r), xy((a + b) / 2, r), xy(b, r), xy(b, r * 0.26)],
						z,
						0.22,
						'slats'
					)
				);
				const [x, y] = xy(a, r - 0.1);
				rail.push([x, y, z + 1.05]);
				if (i % 4 === 0) parts.push(drum([x, y, z + 0.2], 0.075, 0.85, 'body'));
			}
			rail.push([...xy(turns * 2 * Math.PI, r - 0.1), h + 1.05]);
			return [
				...parts,
				pipe(rail, 0.075, 'body'),
				crescent(r, r * 0.28, h, 0.3, Math.PI * 1.38, 'slats'),
				...crown(shape, r, h + 0.3)
			];
		}
	);
}
export const towers = (
	['lantern', 'belvedere', 'funnel', 'parasol', 'garden', 'beacon', 'open'] as const
).flatMap(stair);
