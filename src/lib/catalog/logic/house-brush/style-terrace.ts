import { stockRoof } from './stock-roof';
import { STORY } from '../../data/grid';
import { hash } from '../hash-random';
import { cellKey } from './cell-key';
import type { Primitive, Vec3 } from '../parametrik/types';
import { inradius, type QuadCell } from '../quad-grid';
import { body } from './body';
import { pencilGables } from './stock-roof-axis';
import { part, type Site } from './form';
import { massStoreys, type Mass } from './massing';
import { profileOf } from './profile';
import { storiesOf } from './stacks';

const TERRACE_DEFAULTS = { wash: 0.014, pitch: 0.67, variation: 0.42, wobble: 0.026 };

function pencilRoof(
	cell: QuadCell,
	level: number,
	seed: number,
	top: number,
	inset: number,
	p: typeof TERRACE_DEFAULTS
): Primitive[] {
	const ends = pencilGables(cell, seed, inset);
	if (ends.length !== 2) return [];
	const height = inradius(cell) * p.pitch * (1 + hash(seed, cellKey(cell), level) * p.variation);
	const roofLine = (name: string, points: Vec3[]): Primitive => ({
		...part(cell.id + '@' + level + name, '--paper', { kind: 'polyline', points }),
		roofCell: cell.id,
		role: 'bestand'
	});
	const [a, b] = ends;
	const ridge: Vec3 = [
		(a.peak[0] + b.peak[0]) / 2,
		(a.peak[1] + b.peak[1]) / 2,
		top + height * (1 - p.wobble)
	];
	return [
		...ends.map(({ a, b, peak }, i) =>
			roofLine(':gable' + i, [
				[...a, top],
				[...peak, top + height],
				[...b, top]
			])
		),
		roofLine(':ridge', [[...a.peak, top + height], ridge, [...b.peak, top + height]])
	];
}

function fittedRoof(
	site: Site,
	seat: Primitive | undefined,
	cell: QuadCell,
	level: number,
	top: number,
	inset: number
) {
	if (!site.roofBuilder || seat?.kind !== 'prism') return undefined;
	return stockRoof(site.roofBuilder, seat, cell, level, site.seed, top, inset);
}

/** Historic walls and terraces with lightly broken pencil ridges on exposed roofs. */
export function terraceMass(site: Site, mass: Mass, p = TERRACE_DEFAULTS): Primitive[] {
	const profile = profileOf(site, mass);
	const solids = body(site, mass, profile).map((piece): Primitive => ({
		...piece,
		role: 'bestand',
		material: 'paper',
		token: '--paper',
		shade: p.wash
	}));
	const seatId = mass.id + (profile.tiers ? ':tier' + (profile.tiers - 1) : ':plate');
	const seat = solids.find((part) => part.id === seatId);
	const lift = massStoreys(mass) - 1;
	for (const { cell, level: start } of mass.stories) {
		if (storiesOf(site.stacks, cell.id).length !== start + lift + 1) continue;
		const level = start + lift - (site.ensembles?.cells.get(cell.id)?.surcharge ?? 0);
		const top = mass.floor + STORY * massStoreys(mass) + profile.tiers * profile.rise;
		const inset = profile.setback * profile.tiers;
		const roof = fittedRoof(site, seat, cell, level, top, inset);
		if (roof) solids.push(roof);
		else solids.push(...pencilRoof(cell, level, site.seed, top, inset, p));
	}
	return solids;
}
