import { STORY } from '../../data/grid';
import { hash } from '../hash-random';
import type { Primitive } from '../parametrik/types';
import { inradius } from '../quad-grid';
import { body } from './body';
import { bayOf } from './collage-bay';
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
	for (const { cell, level } of mass.stories) {
		if (storiesOf(site.stacks, cell.id).length !== level + 1) continue;
		const at = bayOf(cell, mass.stories[0].cell.index % 4);
		const top = mass.floor + STORY + profile.tiers * profile.rise;
		const height =
			inradius(cell) * p.pitch * (1 + hash(site.seed, cell.index, level) * p.variation);
		const span = (profile.setback * profile.tiers) / Math.max(inradius(cell) * 2, Number.EPSILON);
		for (const [i, v] of [span, 1 - span].entries()) {
			const points = [at(span, v, top), at(0.5, v, top + height), at(1 - span, v, top)];
			solids.push({
				...part(cell.id + '@' + level + ':gable' + i, '--paper', { kind: 'polyline', points }),
				role: 'bestand'
			});
		}
		solids.push({
			...part(cell.id + '@' + level + ':ridge', '--paper', {
				kind: 'polyline',
				points: [
					at(0.5, span, top + height),
					at(0.5 + p.wobble, 0.5, top + height * (1 - p.wobble)),
					at(0.5, 1 - span, top + height)
				]
			}),
			role: 'bestand'
		});
	}
	return solids;
}
