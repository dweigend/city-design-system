import { stockRoof } from './stock-roof';
import { STORY } from '../../data/grid';
import { hash } from '../hash-random';
import { cellKey } from './cell-key';
import type { Primitive, Vec3 } from '../parametrik/types';
import { inradius } from '../quad-grid';
import { body } from './body';
import { pencilGables } from './stock-roof-axis';
import { part, type Site } from './form';
import type { Mass } from './massing';
import { profileOf } from './profile';
import { storiesOf } from './stacks';

const TERRACE_DEFAULTS = { wash: 0.014, pitch: 0.67, variation: 0.42, wobble: 0.026 };

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
	for (const { cell, level } of mass.stories) {
		if (storiesOf(site.stacks, cell.id).length !== level + 1) continue;

		const top = mass.floor + STORY + profile.tiers * profile.rise;
		if (site.roofBuilder && seat?.kind === 'prism') {
			const roof = stockRoof(
				site.roofBuilder,
				seat,
				cell,
				level,
				site.seed,
				top,
				profile.setback * profile.tiers
			);
			if (roof) {
				solids.push(roof);
				continue;
			}
		}
		const height =
			inradius(cell) * p.pitch * (1 + hash(site.seed, cellKey(cell), level) * p.variation);
		const ends = pencilGables(cell, site.seed, profile.setback * profile.tiers);
		if (ends.length !== 2) continue;
		for (const [i, { a, b, peak }] of ends.entries()) {
			const points: Vec3[] = [
				[...a, top],
				[...peak, top + height],
				[...b, top]
			];
			solids.push({
				...part(cell.id + '@' + level + ':gable' + i, '--paper', { kind: 'polyline', points }),
				roofCell: cell.id,
				role: 'bestand'
			});
		}
		solids.push({
			...part(cell.id + '@' + level + ':ridge', '--paper', {
				kind: 'polyline',
				points: [
					[...ends[0].peak, top + height],
					[
						(ends[0].peak[0] + ends[1].peak[0]) / 2,
						(ends[0].peak[1] + ends[1].peak[1]) / 2,
						top + height * (1 - p.wobble)
					],
					[...ends[1].peak, top + height]
				]
			}),
			roofCell: cell.id,
			role: 'bestand'
		});
	}
	return solids;
}
