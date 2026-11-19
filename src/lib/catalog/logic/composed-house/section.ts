import { STORY } from '../../data/grid';
import { houseProgramme } from '../district-frame';
import { footprintBay } from './footprint';
import type { Deck, HouseSite, Section } from './types';
import { assetSlots } from './slots';

/** Groups the painted programme into height bands and surveys the floor and roof datums. */
export function planHouse(site: HouseSite): Section {
	if (!site.cells.length) throw new RangeError('Empty painted footprint');
	const cells = [...site.cells].sort((a, b) => a.id.localeCompare(b.id));
	const rows = cells.map((c) => site.stacks.get(c.id) ?? []);
	const start = Math.min(...rows.map((r) => r.findIndex(Boolean)).filter((i) => i >= 0));
	const id = cells[0].id + (start > 0 ? '@' + start : '');
	const end = Math.max(...rows.map((r) => r.length)),
		stories = end - start;
	if (!Number.isFinite(stories) || stories < 1) throw new RangeError('Empty painted footprint');
	const count = stories <= 2 ? 1 : stories <= 5 ? 2 : Math.min(5, Math.ceil(stories / 2) + 1);
	const levels = Array.from({ length: count }, (_, i) => start + Math.floor((i * stories) / count));
	const uses = levels.map((lo, i) =>
		rows.flatMap((r) => r.slice(lo, levels[i + 1] ?? end).filter(Boolean))
	);
	const district = site.district ?? 'infill';
	const { plan, crown, kinds } = houseProgramme(id, stories, uses, district, site.seed);
	const bay = footprintBay(cells),
		round = plan === 'round';
	const width = (round ? Math.min(bay.width, bay.depth) : bay.width) * 0.94,
		depth = round ? width : bay.depth * 0.94;
	const pad = cells[0].pad,
		base: Section['base'] = [bay.x, bay.y, pad + start * STORY];
	const top = pad + end * STORY;
	const decks = levels.map((lo, i): Deck => {
		const crown = i === count - 1;
		const bodyHeight = Math.min(
			STORY * 1.42,
			Math.min(width, depth) * 0.38,
			(top - base[2]) * 0.68
		);
		const height = crown ? top - bodyHeight : pad + (lo + Math.min(1, (end - lo) * 0.32)) * STORY;
		const { kind, use } = kinds[i];
		return {
			position: [
				bay.x + (round ? 0 : (i % 2 ? 1 : -1) * Math.min(width * 0.085, 0.85)),
				bay.y,
				height
			],
			width: width * (1 - (i % 2) * 0.035),
			depth: depth * (1 - (i % 2) * 0.035),
			round,
			programme: uses[i],
			kind,
			use
		};
	});
	const section: Section = {
		id,
		cells,
		district,
		start,
		base,
		width,
		depth,
		top,
		stories,
		plan,
		crown,
		decks,
		slots: []
	};
	section.slots = assetSlots(section, rows.flat().filter(Boolean));
	return section;
}
