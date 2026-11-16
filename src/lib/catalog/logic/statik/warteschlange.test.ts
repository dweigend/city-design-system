import { it as test } from 'node:test';
import { strict as assert } from 'node:assert';
import { erzeugeWarteschlange, schluessel, type Auftrag } from './index';

/** Accepted examples of the queue contract: the game asks, never waits, never computes twice. */
type Tor = { loese: (wert: string) => void; scheitere: (grund: Error) => void };
function gesteuert() {
	const gestartet: string[] = [];
	const tore = new Map<string, Tor>();
	const ausfuehren = (eingabe: string) =>
		new Promise<string>((loese, scheitere) => {
			gestartet.push(eingabe);
			tore.set(eingabe, { loese, scheitere });
		});
	const oeffne = (eingabe: string) => tore.get(eingabe)?.loese(`fertig:${eingabe}`);
	return { gestartet, tore, ausfuehren, oeffne };
}
const auftrag = (eingabe: string, kanal = eingabe, prioritaet = 0): Auftrag<string> => ({
	schluessel: schluessel(eingabe),
	kanal,
	prioritaet,
	eingabe
});

test('W1: the same input is computed once; the key does not depend on the order', async () => {
	const s = gesteuert();
	const w = erzeugeWarteschlange({ ausfuehren: s.ausfuehren });
	const erste = w.anfragen(auftrag('a'));
	s.oeffne('a');
	assert.deepEqual(await erste, { status: 'fertig', ergebnis: 'fertig:a', ausCache: false });
	assert.deepEqual(await w.anfragen(auftrag('a')), {
		status: 'fertig',
		ergebnis: 'fertig:a',
		ausCache: true
	});
	assert.deepEqual(s.gestartet, ['a']);
	assert.equal(
		schluessel({ saat: 42, stufe: 'abtrag' }),
		schluessel({ stufe: 'abtrag', saat: 42 })
	);
	assert.notEqual(schluessel({ saat: 42 }), schluessel({ saat: 43 }));
	assert.notEqual(schluessel([1, 2]), schluessel([2, 1]));
});

test('W2: a new job in the same channel makes the old one stale, whether waiting or running', async () => {
	const s = gesteuert();
	const w = erzeugeWarteschlange({ ausfuehren: s.ausfuehren });
	const laufend = w.anfragen(auftrag('alt', 'haus'));
	const wartend = w.anfragen(auftrag('mittel', 'haus'));
	const neu = w.anfragen(auftrag('neu', 'haus'));
	assert.deepEqual(await wartend, { status: 'veraltet' });
	assert.equal(w.stand().wartend, 1);
	s.oeffne('alt');
	assert.deepEqual(await laufend, { status: 'veraltet' });
	await Promise.resolve();
	s.oeffne('neu');
	assert.deepEqual(await neu, { status: 'fertig', ergebnis: 'fertig:neu', ausCache: false });
	// The waiting job never started; the stale result still fills the cache.
	assert.deepEqual(s.gestartet, ['alt', 'neu']);
	assert.equal((await w.anfragen(auftrag('alt', 'haus'))).status, 'fertig');
	assert.deepEqual(s.gestartet, ['alt', 'neu']);
});

test('W3: only one job runs at a time; waiting jobs start by priority, then by arrival', async () => {
	const s = gesteuert();
	const w = erzeugeWarteschlange({ ausfuehren: s.ausfuehren });
	const alle = [
		w.anfragen(auftrag('laeuft')),
		w.anfragen(auftrag('fern', 'fern', 0)),
		w.anfragen(auftrag('nah', 'nah', 5)),
		w.anfragen(auftrag('fern2', 'fern2', 0))
	];
	assert.deepEqual(w.stand(), { laufend: 1, wartend: 3 });
	for (const name of ['laeuft', 'nah', 'fern', 'fern2']) {
		assert.equal(s.gestartet[s.gestartet.length - 1], name);
		s.oeffne(name);
		await alle[['laeuft', 'fern', 'nah', 'fern2'].indexOf(name)];
		await Promise.resolve();
	}
	assert.deepEqual(s.gestartet, ['laeuft', 'nah', 'fern', 'fern2']);
	assert.deepEqual(w.stand(), { laufend: 0, wartend: 0 });
});

test('W4: an error is a result; the queue keeps working and does not remember it', async () => {
	const s = gesteuert();
	const w = erzeugeWarteschlange({ ausfuehren: s.ausfuehren });
	const kaputt = w.anfragen(auftrag('kaputt'));
	const danach = w.anfragen(auftrag('danach'));
	s.tore.get('kaputt')?.scheitere(new Error('zeit-ueberschritten'));
	assert.deepEqual(await kaputt, { status: 'fehler', grund: 'zeit-ueberschritten' });
	await Promise.resolve();
	s.oeffne('danach');
	assert.equal((await danach).status, 'fertig');
	const nochmal = w.anfragen(auftrag('kaputt'));
	assert.equal(s.gestartet.filter((e) => e === 'kaputt').length, 2);
	s.oeffne('kaputt');
	assert.equal((await nochmal).status, 'fertig');
});

test('W5: the cache is bounded and evicts the oldest entry; cancellation affects only the channel', async () => {
	const s = gesteuert();
	const w = erzeugeWarteschlange({ ausfuehren: s.ausfuehren, cacheGroesse: 2 });
	for (const name of ['a', 'b', 'c']) {
		const lauf = w.anfragen(auftrag(name));
		s.oeffne(name);
		await lauf;
	}
	assert.equal((await w.anfragen(auftrag('c'))).status, 'fertig');
	assert.deepEqual(s.gestartet, ['a', 'b', 'c']);
	const wieder = w.anfragen(auftrag('a'));
	assert.deepEqual(s.gestartet, ['a', 'b', 'c', 'a']);
	const anderer = w.anfragen(auftrag('d', 'anderer'));
	w.abbrechen('a');
	assert.deepEqual(await wieder, { status: 'veraltet' });
	s.oeffne('a');
	await Promise.resolve();
	await Promise.resolve();
	s.oeffne('d');
	assert.equal((await anderer).status, 'fertig');
});
