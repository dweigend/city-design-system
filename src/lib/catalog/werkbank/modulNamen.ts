/** Workbench: readable names of the selectable modules (selection menu and caption). Headless. */
import type { Tag } from '../logic/ansicht/tags';
import { auswahlKey } from '../logic/ansicht/fokus';
import { flows } from '../data/focus';
import { schichtLabels } from '../data/werkbank';

/**
 * Selectable modules with readable names: layer, flow, floor; equal names get a
 * number. The internal key (auswahlKey) stays a value, never text. Order: floor, name.
 */
export function modulNamen(tags: Iterable<Tag>): { value: string; label: string }[] {
	const erste = new Map<string, Tag>();
	for (const t of tags)
		if (!t.line && t.schicht !== 'boden' && !erste.has(auswahlKey(t))) erste.set(auswahlKey(t), t);
	const basis = (t: Tag) => {
		const name = schichtLabels.find((x) => x.value === t.schicht)?.label ?? t.schicht;
		const f = t.flow ? flows.find((x) => x.id === t.flow)?.name : undefined;
		return `${name}${f ? `, ${f}` : ''}, floor ${t.level}`;
	};
	const liste = [...erste.entries()]
		.map(([value, t]) => ({ value, t, b: basis(t) }))
		.sort(
			(a, b) => a.t.level - b.t.level || a.b.localeCompare(b.b) || a.value.localeCompare(b.value)
		);
	const gesamt = new Map<string, number>();
	for (const m of liste) gesamt.set(m.b, (gesamt.get(m.b) ?? 0) + 1);
	const zaehler = new Map<string, number>();
	return liste.map((m) => {
		const n = (zaehler.get(m.b) ?? 0) + 1;
		zaehler.set(m.b, n);
		return { value: m.value, label: (gesamt.get(m.b) ?? 0) > 1 ? `${m.b}, Nr. ${n}` : m.b };
	});
}
