import type { FlowId } from '../../data/focus';
export type Vec3 = [number, number, number];
export type FamilieId =
	'faltwerk' | 'kuppel' | 'wabe' | 'raumfachwerk' | 'gitterschale' | 'orthogonal';
export type Ansicht = 'geruest' | 'huelle' | 'belegt';
export type Knoten = { id: string; p: Vec3; rolle: 'lager' | 'frei' | 'nabe' };
export type Kante = {
	id: string;
	a: string;
	b: string;
	klasse?: string;
	rolle: 'stab' | 'nebenstab' | 'rippe' | 'berg' | 'tal' | 'rand';
};
export type Flaeche = {
	id: string;
	knoten: string[];
	rolle: 'paneel' | 'glas' | 'membran' | 'boden' | 'offen';
	zelle?: string;
};
export type Zelle = {
	id: string;
	flaechen: string[];
	volumenM3: number;
	nutzung?: 'garten' | 'schacht' | 'raum';
};
export type TraegerPlan = {
	version: 1;
	familie: FamilieId;
	saat: number;
	werte: Record<string, number>;
	knoten: Knoten[];
	kanten: Kante[];
	flaechen: Flaeche[];
	zellen: Zelle[];
	belegung: Record<string, FlowId | 'leer'>;
};
export type Parameter =
	| {
			art: 'diskret';
			verborgen?: boolean;
			id: string;
			label: string;
			optionen: { wert: number; label: string }[];
			start: number;
	  }
	| {
			art: 'stetig';
			verborgen?: boolean;
			id: string;
			label: string;
			min: number;
			max: number;
			schritt: number;
			start: number;
			einheit: 'm' | 'rad' | '';
	  };
export type LoopSchritt = {
	name: string;
	werte: Partial<Record<string, number>>;
	ansicht: Ansicht;
	dauerS: number;
};
export type TraegerFamilie = {
	id: FamilieId;
	parameter: Parameter[];
	planen(werte: Record<string, number>, saat: number): TraegerPlan;
	loop: LoopSchritt[];
};
export type Befund = { code: string; elementId: string };
/** JSON tuple avoids collisions even when rule paths contain punctuation. */
export function kantenId(a: string, b: string): string {
	return JSON.stringify(a < b ? [a, b] : [b, a]);
}
/** Relative tolerances in meters / cubic meters, scaled by the model extent. */
export const LAENGEN_TOLERANZ = 1e-9;
export const VOLUMEN_TOLERANZ = 1e-8;
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [
	a[1] * b[2] - a[2] * b[1],
	a[2] * b[0] - a[0] * b[2],
	a[0] * b[1] - a[1] * b[0]
];
const dot = (a: Vec3, b: Vec3) => a.reduce((s, v, i) => s + v * b[i], 0);
export function pruefePlan(plan: TraegerPlan): Befund[] {
	const out: Befund[] = [];
	const add = (code: string, elementId: string) => out.push({ code, elementId });
	const ids = new Set<string>();
	for (const e of [...plan.knoten, ...plan.kanten, ...plan.flaechen, ...plan.zellen]) {
		if (ids.has(e.id)) add('id-doppelt', e.id);
		ids.add(e.id);
	}
	const nodes = new Map(plan.knoten.map((k) => [k.id, k.p]));
	const finite = plan.knoten.filter((k) => k.p.every(Number.isFinite));
	const span = Math.max(
		1,
		...[0, 1, 2].map((i) =>
			finite.length
				? Math.max(...finite.map((k) => k.p[i])) - Math.min(...finite.map((k) => k.p[i]))
				: 0
		)
	);
	const epsM = LAENGEN_TOLERANZ * span,
		epsM3 = VOLUMEN_TOLERANZ * span ** 3;
	for (const k of plan.knoten) if (!k.p.every(Number.isFinite)) add('koordinate-endlich', k.id);
	for (const [id, v] of Object.entries(plan.werte))
		if (!Number.isFinite(v)) add('wert-endlich', id);
	const edges = new Set<string>();
	for (const k of plan.kanten) {
		const a = nodes.get(k.a),
			b = nodes.get(k.b),
			key = kantenId(k.a, k.b);
		if (!a || !b) add('kanten-knoten', k.id);
		if (edges.has(key)) add('kante-doppelt', k.id);
		edges.add(key);
		if (k.a === k.b || (a && b && Math.hypot(...sub(a, b)) <= epsM)) add('nullkante', k.id);
	}
	const faces = new Map(plan.flaechen.map((f) => [f.id, f]));
	const owners = new Map<string, number>();
	for (const z of plan.zellen)
		for (const id of z.flaechen) owners.set(id, (owners.get(id) ?? 0) + 1);
	const incidence = new Map<string, number>();
	for (const f of plan.flaechen) {
		if (f.knoten.length < 3 || new Set(f.knoten).size !== f.knoten.length)
			add('flaeche-ring', f.id);
		if (f.knoten.some((id) => !nodes.has(id))) add('flaechen-knoten', f.id);
		for (let i = 0; i < f.knoten.length; i++) {
			const key = kantenId(f.knoten[i], f.knoten[(i + 1) % f.knoten.length]);
			if (!edges.has(key)) add('flaechen-rand', f.id);
			// Cellular complexes have internal partitions: manifold incidence applies to their exterior.
			if ((owners.get(f.id) ?? 0) < 2) incidence.set(key, (incidence.get(key) ?? 0) + 1);
		}
	}
	for (const [id, n] of owners) if (n > 2) add('flaeche-zellen', id);
	for (const [id, n] of incidence) if (n > 2) add('kante-nichtmannigfaltig', id);
	for (const z of plan.zellen) {
		const fs = z.flaechen.map((id) => faces.get(id));
		if (fs.some((f) => !f)) {
			add('zellen-flaeche', z.id);
			continue;
		}
		const counts = new Map<string, number>();
		const ps = [...new Set(fs.flatMap((f) => f?.knoten ?? []))]
			.map((id) => nodes.get(id))
			.filter((p): p is Vec3 => !!p);
		if (!ps.length) {
			add('zelle-offen', z.id);
			continue;
		}
		// Propagate face orientation across shared edges. This supports concave cells too.
		const incidences = new Map<string, { face: number; direction: number }[]>();
		fs.forEach((f, face) => {
			if (!f) return;
			for (let i = 0; i < f.knoten.length; i++) {
				const a = f.knoten[i],
					b = f.knoten[(i + 1) % f.knoten.length],
					key = kantenId(a, b);
				incidences.set(key, [...(incidences.get(key) ?? []), { face, direction: a < b ? 1 : -1 }]);
				counts.set(key, (counts.get(key) ?? 0) + 1);
			}
		});
		const signs = new Map<number, number>([[0, 1]]),
			queue = [0];
		let orientable = true;
		while (queue.length) {
			const face = queue.shift();
			if (face === undefined) break;
			const f = fs[face];
			if (!f) continue;
			for (let i = 0; i < f.knoten.length; i++) {
				const pair =
					incidences.get(kantenId(f.knoten[i], f.knoten[(i + 1) % f.knoten.length])) ?? [];
				const a = pair.find((e) => e.face === face);
				if (!a) continue;
				for (const b of pair) {
					if (b.face === face) continue;
					const sign = -(signs.get(face) ?? 1) * a.direction * b.direction;
					if (signs.has(b.face)) {
						if (signs.get(b.face) !== sign) orientable = false;
					} else {
						signs.set(b.face, sign);
						queue.push(b.face);
					}
				}
			}
		}
		const origin = ps[0];
		let signedVolume = 0;
		fs.forEach((f, index) => {
			if (!f) return;
			const points = f.knoten.map((id) => nodes.get(id));
			const a = points[0];
			if (!a) return;
			for (let i = 1; i + 1 < points.length; i++) {
				const b = points[i],
					c = points[i + 1];
				if (!b || !c) continue;
				signedVolume +=
					((signs.get(index) ?? 1) * dot(sub(a, origin), cross(sub(b, origin), sub(c, origin)))) /
					6;
			}
		});
		const volume = Math.abs(signedVolume);
		if (!orientable || signs.size !== fs.length) add('zelle-orientierung', z.id);
		if (
			fs.length < 4 ||
			new Set(z.flaechen).size !== fs.length ||
			[...counts.values()].some((n) => n !== 2)
		)
			add('zelle-offen', z.id);
		if (
			!Number.isFinite(volume) ||
			volume <= epsM3 ||
			!Number.isFinite(z.volumenM3) ||
			z.volumenM3 <= epsM3
		)
			add('zellen-volumen', z.id);
		else if (Math.abs(volume - z.volumenM3) > epsM3) add('zellen-volumen-abweichung', z.id);
	}
	const targets = new Set([...plan.zellen, ...plan.flaechen].map((e) => e.id));
	for (const id of Object.keys(plan.belegung)) if (!targets.has(id)) add('belegung-id', id);
	if (new Set(Object.values(plan.belegung).filter((v) => v !== 'leer')).size > 3)
		add('belegung-stroeme', plan.familie);
	return out;
}
