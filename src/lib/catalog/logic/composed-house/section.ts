import { STORY } from '../../data/grid';
import { deckPlan } from './deck-plan';
import { houseAspect, houseProgramme } from '../district-frame';
import { footprintBay } from './footprint';
import type { Deck, HouseSite, Section } from './types';
import { assetSlots } from './slots';

function paintedBands(site: HouseSite) {
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
	return { cells, rows, start, end, stories, levels, uses, id };
}

/** Vertical step in metres shared by every deck, so neighbours meet at equal levels. */
const DATUM = STORY / 2;
/** Snaps a deck to the shared datum above its pad. The crown rounds down to keep its body height. */
function deckDatum(pad: number, height: number, crown: boolean) {
	const steps = (height - pad) / DATUM;
	return pad + Math.max(0.5, crown ? Math.floor(steps + 1e-6) : Math.round(steps)) * DATUM;
}
/** Groups the painted programme into height bands and surveys the floor and roof datums. */
export function planHouse(site: HouseSite): Section {
	const { cells, rows, start, end, stories, levels, uses, id } = paintedBands(site);
	const count = levels.length;
	const district = site.district ?? 'infill';
	const { plan, crown, kinds } = houseProgramme(id, stories, uses, district, site.seed);
	const aspect = houseAspect(id, site.seed);
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
		const free = crown ? top - bodyHeight : pad + (lo + Math.min(1, (end - lo) * 0.32)) * STORY;
		const height = deckDatum(pad, free, crown);
		const { kind, use } = kinds[i];
		const shape = deckPlan(i, count, round, aspect);
		return {
			position: [bay.x + width * shape.x, bay.y + depth * shape.y, height],
			width: width * shape.width,
			depth: depth * shape.depth,
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
		aspect,
		seed: site.seed,
		typology: stories >= 5 ? 'tower' : 'house',
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
