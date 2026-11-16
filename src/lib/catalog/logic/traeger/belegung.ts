import type { FlowId } from '../../data/focus';
import { kanal, einheit } from './hash';
import type { FamilieId } from './plan';
/** Unordered eligible IDs. No silent cap (PT-10): families own the 3/5 neutral rule. */
export function belege(
	plan: { zellen: { id: string }[]; flaechen: { id: string; rolle: string }[] },
	saat: number,
	familie: FamilieId,
	optionen: { anteil: number; stroeme: FlowId[]; ziele?: string[] }
): Record<string, FlowId | 'leer'> {
	const stroeme = [...new Set(optionen.stroeme)].sort();
	if (stroeme.length > 3) throw new RangeError('At most three flows');
	if (!Number.isFinite(optionen.anteil) || optionen.anteil < 0 || optionen.anteil > 1)
		throw new RangeError('Share must lie between 0 and 1');
	const eligible = new Set([...plan.zellen, ...plan.flaechen].map((e) => e.id));
	if (optionen.ziele?.some((id) => !eligible.has(id)))
		throw new RangeError('Unknown occupancy target');
	const ids = [
		...new Set(
			optionen.ziele ??
				(plan.zellen.length ? plan.zellen : plan.flaechen.filter((f) => f.rolle === 'paneel')).map(
					(e) => e.id
				)
		)
	].sort();
	const ranked = [...ids].sort(
		(a, b) =>
			kanal(saat, familie, a, 'belegung') - kanal(saat, familie, b, 'belegung') ||
			a.localeCompare(b)
	);
	const occupied = new Set(ranked.slice(0, Math.floor(ids.length * optionen.anteil)));
	return Object.fromEntries(
		ids.map((id) => [
			id,
			occupied.has(id) && stroeme.length
				? stroeme[Math.floor(einheit(kanal(saat, familie, id, 'strom')) * stroeme.length)]
				: 'leer'
		])
	);
}
