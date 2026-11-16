import { describe, it as test } from 'node:test';
import { strict as assert } from 'node:assert';
import { stadtstueck, type EnsemblePlan } from './ensemble';
function weltKnoten(e: EnsemblePlan) {
	const a = e.lage.drehungRad;
	return e.plan.knoten.map((n) => ({
		...n,
		p: [
			n.p[0] * Math.cos(a) - n.p[1] * Math.sin(a) + e.lage.versatz[0],
			n.p[0] * Math.sin(a) + n.p[1] * Math.cos(a) + e.lage.versatz[1],
			n.p[2] + e.lage.versatz[2]
		]
	}));
}
describe('City piece – public examples', () => {
	test('five building plots and a deterministic seed', () => {
		const a = stadtstueck(42);
		assert.deepEqual(a, stadtstueck(42));
		assert.deepEqual(
			a.plaene.map((p) => p.familie),
			['faltwerk', 'kuppel', 'wabe', 'raumfachwerk', 'gitterschale']
		);
	});
	test('focus changes only focus flags', () => {
		const a = stadtstueck(17);
		for (const id of a.plaene.map((p) => p.familie)) {
			const b = stadtstueck(17, id);
			assert.deepEqual(
				b.plaene.filter((p) => p.fokus).map((p) => p.familie),
				[id]
			);
			assert.deepEqual({ ...b, plaene: b.plaene.map((p) => ({ ...p, fokus: true })) }, a);
		}
	});
	test('the seed reaches every family', () => {
		for (const p of stadtstueck(123).plaene) assert.equal(p.plan.saat, 123);
	});
	test('existing stock has one to three four-meter floors, the elevated walkway lies at eight meters', () => {
		const a = stadtstueck();
		const koerper = a.bestand.filter((p) => p.kind === 'box' && !p.id.includes(':schornstein'));
		assert.ok(koerper.length >= 7);
		for (const p of koerper) if (p.kind === 'box') assert.ok([4, 8, 12].includes(p.size[2]));
		for (const p of a.hochweg) if (p.kind === 'box') assert.equal(p.position[2] + p.size[2], 8);
	});
	test('the folded plate adds a story, all other plans keep their height', () => {
		const a = stadtstueck();
		assert.equal(a.plaene[0].lage.versatz[2], 8);
		assert.equal(
			a.plaene.slice(1).every((p) => p.lage.versatz[2] === 0),
			true
		);
		assert.ok(a.figuren.length > 1);
		assert.ok(
			new Set(a.plaene.flatMap((p) => Object.values(p.plan.belegung)).filter((s) => s !== 'leer'))
				.size <= 3
		);
	});
	test('footprints keep at least twelve meters of distance, also with other seeds', () => {
		for (const saat of [0, 42, 123, 0xffffffff]) {
			const a = stadtstueck(saat);
			const bounds = a.plaene.map((e) => ({
				min: [0, 1].map((i) => Math.min(...weltKnoten(e).map((n) => n.p[i]))),
				max: [0, 1].map((i) => Math.max(...weltKnoten(e).map((n) => n.p[i])))
			}));
			for (let i = 0; i < bounds.length; i++)
				for (let j = i + 1; j < bounds.length; j++) {
					const a = bounds[i],
						b = bounds[j];
					const abstand = Math.hypot(
						...[0, 1].map((k) => Math.max(0, a.min[k] - b.max[k], b.min[k] - a.max[k]))
					);
					assert.ok(abstand >= 12 - 1e-9, `building plots ${i}/${j}: ${abstand} m`);
				}
		}
	});
	test('existing volumes stay clear; rooftop extension and bridge lie above the eaves', () => {
		const a = stadtstueck();
		const koerper = a.bestand.filter(
			(p) => p.kind === 'box' && p.id.startsWith('bestand:') && !p.id.includes(':schornstein')
		);
		for (const e of a.plaene) {
			const min = [0, 1].map((i) => Math.min(...weltKnoten(e).map((n) => n.p[i])));
			const max = [0, 1].map((i) => Math.max(...weltKnoten(e).map((n) => n.p[i])));
			for (const b of koerper) {
				if (b.kind !== 'box') continue;
				const overlap = [0, 1].every(
					(i) => min[i] < b.position[i] + b.size[i] - 1e-9 && max[i] > b.position[i] + 1e-9
				);
				if (!overlap) continue;
				if (e.familie === 'faltwerk') {
					assert.equal(b.id, 'bestand:faltwerk');
					assert.ok(Math.min(...e.plan.knoten.map((n) => n.p[2])) + e.lage.versatz[2] >= b.size[2]);
				} else {
					assert.equal(e.familie, 'raumfachwerk');
					assert.ok(b.id.startsWith('bestand:bruecke-'));
					assert.ok(
						Math.min(...e.plan.knoten.filter((n) => n.rolle !== 'lager').map((n) => n.p[2])) >
							b.size[2]
					);
					for (const n of e.plan.knoten.filter((n) => n.rolle === 'lager'))
						assert.ok(
							[0, 1].some(
								(i) =>
									n.p[i] + e.lage.versatz[i] <= b.position[i] ||
									n.p[i] + e.lage.versatz[i] >= b.position[i] + b.size[i]
							),
							'column inside the old building'
						);
				}
			}
		}
	});
});
