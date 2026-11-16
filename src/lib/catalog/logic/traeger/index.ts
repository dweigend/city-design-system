export * from './plan';
export { kanal, einheit } from './hash';
export { belege } from './belegung';
import type { FamilieId, TraegerFamilie, TraegerPlan, Vec3 } from './plan';
import { faltwerk } from './familien/faltwerk';
import { kuppel } from './familien/kuppel';
import { wabe } from './familien/wabe';
import { raumfachwerk } from './familien/raumfachwerk';
import { gitterschale } from './familien/gitterschale';
import { orthogonal } from './familien/orthogonal';
export function familie(id: FamilieId): TraegerFamilie {
	switch (id) {
		case 'faltwerk':
			return faltwerk;
		case 'kuppel':
			return kuppel;
		case 'wabe':
			return wabe;
		case 'raumfachwerk':
			return raumfachwerk;
		case 'gitterschale':
			return gitterschale;
		case 'orthogonal':
			return orthogonal;
	}
}
export function planen(id: FamilieId, werte: Partial<Record<string, number>> = {}, saat = 42) {
	const f = familie(id),
		normal = Object.fromEntries(f.parameter.map((p) => [p.id, p.start]));
	for (const p of f.parameter) {
		const v = werte[p.id] ?? p.start;
		if (!Number.isFinite(v)) throw new RangeError(`Invalid parameter ${p.id}`);
		normal[p.id] =
			p.art === 'diskret'
				? p.optionen.some((o) => o.wert === v)
					? v
					: p.start
				: Math.max(p.min, Math.min(p.max, v));
	}
	return f.planen(normal, saat >>> 0);
}
/** Each step starts at the previous target. Discrete values switch at its beginning. */
export function loopZustand(f: TraegerFamilie, sekunden: number) {
	if (
		!Number.isFinite(sekunden) ||
		!f.loop.length ||
		f.loop.some((s) => !Number.isFinite(s.dauerS) || s.dauerS <= 0)
	)
		throw new RangeError('Invalid loop');
	const dauer = f.loop.reduce((n, s) => n + s.dauerS, 0);
	let t = ((sekunden % dauer) + dauer) % dauer,
		schritt = 0;
	while (t >= f.loop[schritt].dauerS && schritt < f.loop.length - 1) {
		t -= f.loop[schritt].dauerS;
		schritt++;
	}
	const start = Object.fromEntries(f.parameter.map((p) => [p.id, p.start]));
	const targets = f.loop.map((s) => {
		Object.assign(start, s.werte);
		return { ...start };
	});
	const current = targets[schritt],
		previous = targets[(schritt + targets.length - 1) % targets.length],
		anteil = t / f.loop[schritt].dauerS;
	const werte = Object.fromEntries(
		f.parameter.map((p) => [
			p.id,
			p.art === 'stetig'
				? previous[p.id] + (current[p.id] - previous[p.id]) * anteil
				: current[p.id]
		])
	);
	return { schritt, anteil, werte, ansicht: f.loop[schritt].ansicht };
}

/** Camera-facing extreme support, 1.2 m radially outside the plan footprint. */
export function figurOrt(plan: TraegerPlan): Vec3 {
	const nodes = plan.knoten;
	if (!nodes.length) return [-1.2, 0, 0];
	const center = [0, 1].map(
		(i) => (Math.min(...nodes.map((n) => n.p[i])) + Math.max(...nodes.map((n) => n.p[i]))) / 2
	);
	const supports = nodes.filter((n) => n.rolle === 'lager');
	const anchor = [...(supports.length ? supports : nodes)].sort(
		(a, b) => a.p[0] + a.p[1] - b.p[0] - b.p[1] || a.id.localeCompare(b.id)
	)[0].p;
	const dx = anchor[0] - center[0],
		dy = anchor[1] - center[1],
		length = Math.hypot(dx, dy);
	return length > 0
		? [anchor[0] + (1.2 * dx) / length, anchor[1] + (1.2 * dy) / length, 0]
		: [anchor[0] - 1.2, anchor[1], 0];
}
/** Lowest floor of each garden cell, plus explicitly food-occupied floor faces. */
export function gartenBoeden(plan: TraegerPlan) {
	const nodes = new Map(plan.knoten.map((n) => [n.id, n.p]));
	const height = (f: TraegerPlan['flaechen'][number]) =>
		f.knoten.reduce((sum, id) => sum + (nodes.get(id)?.[2] ?? 0), 0) / f.knoten.length;
	const selected = new Set(
		plan.flaechen
			.filter((f) => f.rolle === 'boden' && plan.belegung[f.id] === 'food')
			.map((f) => f.id)
	);
	for (const cell of plan.zellen.filter((z) => z.nutzung === 'garten')) {
		const floor = plan.flaechen
			.filter((f) => f.rolle === 'boden' && cell.flaechen.includes(f.id))
			.sort((a, b) => height(a) - height(b) || a.id.localeCompare(b.id))[0];
		if (floor) selected.add(floor.id);
	}
	return plan.flaechen.filter((f) => selected.has(f.id));
}
/** Exact target for a paused step, including inherited values. */
export function loopZiel(f: TraegerFamilie, schritt: number) {
	return Object.assign(
		Object.fromEntries(f.parameter.map((p) => [p.id, p.start])),
		...f.loop.slice(0, schritt + 1).map((s) => s.werte)
	) as Record<string, number>;
}
