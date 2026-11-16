/**
 * Stock balance as a flow band: new stock = old stock + inflow − outflow.
 * Every stage distributes its full quantity; internal reallocation creates no raw material.
 */
export type Fluss = { von: string; nach: string; menge: number };
export type Band = { von: string; nach: string; menge: number; y0: number; y1: number; h: number };
export type Saeule = { id: string; menge: number; y: number; h: number; spalte: number };

/** Conservation of quantity: whatever flows into an inner node flows out of it entirely. */
export function erhalten(fluesse: Fluss[]): boolean {
	const knoten = new Set(fluesse.flatMap((f) => [f.von, f.nach]));
	for (const k of knoten) {
		const ein = fluesse.filter((f) => f.nach === k).reduce((s, f) => s + f.menge, 0),
			aus = fluesse.filter((f) => f.von === k).reduce((s, f) => s + f.menge, 0);
		if (ein > 0 && aus > 0 && Math.abs(ein - aus) > 1e-9) return false;
	}
	return true;
}

/**
 * Bars per column (column = depth from the source) and bands between them, height proportional
 * to the quantity. `hoehe` is the height of the largest column, `luecke` the gap between bars
 * of one column.
 */
export function flussbild(fluesse: Fluss[], hoehe = 200, luecke = 12) {
	const knoten = [...new Set(fluesse.flatMap((f) => [f.von, f.nach]))];
	const spalte = new Map<string, number>();
	const tiefe = (k: string): number => {
		if (spalte.has(k)) return spalte.get(k)!;
		const vor = fluesse.filter((f) => f.nach === k);
		const t = vor.length ? Math.max(...vor.map((f) => tiefe(f.von) + 1)) : 0;
		spalte.set(k, t);
		return t;
	};
	knoten.forEach(tiefe);
	const menge = (k: string) =>
		Math.max(
			fluesse.filter((f) => f.nach === k).reduce((s, f) => s + f.menge, 0),
			fluesse.filter((f) => f.von === k).reduce((s, f) => s + f.menge, 0)
		);
	const spalten = Math.max(...spalte.values()) + 1;
	const proSpalte = Array.from({ length: spalten }, (_, s) =>
		knoten.filter((k) => spalte.get(k) === s)
	);
	const groesste = Math.max(
		...proSpalte.map((ks) => ks.reduce((s, k) => s + menge(k), 0) + luecke * (ks.length - 1))
	);
	const skala = hoehe / groesste;
	const saeulen: Saeule[] = [];
	proSpalte.forEach((ks, s) => {
		let y = 0;
		for (const k of ks) {
			const h = menge(k) * skala;
			saeulen.push({ id: k, menge: menge(k), y, h, spalte: s });
			y += h + luecke * skala;
		}
	});
	const aus = new Map<string, number>(),
		ein = new Map<string, number>();
	const baender: Band[] = fluesse.map((f) => {
		const a = saeulen.find((x) => x.id === f.von)!,
			b = saeulen.find((x) => x.id === f.nach)!;
		const h = f.menge * skala;
		const y0 = a.y + (aus.get(f.von) ?? 0),
			y1 = b.y + (ein.get(f.nach) ?? 0);
		aus.set(f.von, (aus.get(f.von) ?? 0) + h);
		ein.set(f.nach, (ein.get(f.nach) ?? 0) + h);
		return { ...f, y0, y1, h };
	});
	return { saeulen, baender, spalten };
}
