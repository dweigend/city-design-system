/**
 * Runtime side of the structural simulation in the browser: one web worker behind the queue of
 * `logic/statik/warteschlange.ts`. The page asks and keeps drawing; a job that exceeds its time
 * limit is stopped by replacing the worker. Owner of the worker: whoever created the computer.
 */
import { erzeugeWarteschlange, type Antwort } from '../../logic/statik';
import {
	hausSchluessel,
	type HausAuftrag,
	type HausErgebnis
} from '../../logic/traeger/hausAuftrag';

/** A job in the bible may take this long before it is stopped, milliseconds. */
const ZEITLIMIT_MS = 5000;
/**
 * A superseded job may finish within this time and fill the cache; after that its worker is
 * replaced so that the newest job does not wait behind work nobody will see, milliseconds.
 */
const NACHLAUF_MS = 250;
export type Gemessen = HausErgebnis & { ms: number };
type Nachricht = { nr: number; ergebnis?: HausErgebnis; ms?: number; grund?: string };

export function erzeugeHausRechner(zeitlimitMs = ZEITLIMIT_MS) {
	let worker: Worker | undefined;
	let nr = 0;
	/** The job the worker is busy with, and how to stop it. */
	let laufend: { schluessel: string; stoppe: () => void } | undefined;
	let nachlauf: ReturnType<typeof setTimeout> | undefined;
	const starte = () => new Worker(new URL('./haus.worker.ts', import.meta.url), { type: 'module' });
	function ausfuehren(auftrag: HausAuftrag): Promise<Gemessen> {
		const aktiv = (worker ??= starte());
		const meine = ++nr;
		return new Promise((loese, scheitere) => {
			const ende = (aufraeumen: () => void) => {
				clearTimeout(frist);
				clearTimeout(nachlauf);
				laufend = undefined;
				aktiv.removeEventListener('message', hoere);
				aktiv.removeEventListener('error', stuerze);
				aufraeumen();
			};
			// The only way to stop a running computation: end its thread and start a fresh one.
			const ersetze = () => {
				aktiv.terminate();
				if (worker === aktiv) worker = undefined;
			};
			const frist = setTimeout(
				() => ende(() => (ersetze(), scheitere(new Error('zeit-ueberschritten')))),
				zeitlimitMs
			);
			const hoere = (ereignis: MessageEvent<Nachricht>) => {
				const { nr: antwortNr, ergebnis, ms, grund } = ereignis.data;
				if (antwortNr !== meine) return;
				ende(() =>
					ergebnis ? loese({ ...ergebnis, ms: ms ?? 0 }) : scheitere(new Error(grund ?? 'fehler'))
				);
			};
			const stuerze = () => ende(() => (ersetze(), scheitere(new Error('worker-abgestuerzt'))));
			laufend = {
				schluessel: hausSchluessel(auftrag),
				stoppe: () => ende(() => (ersetze(), scheitere(new Error('veraltet'))))
			};
			aktiv.addEventListener('message', hoere);
			aktiv.addEventListener('error', stuerze);
			aktiv.postMessage({ nr: meine, auftrag });
		});
	}
	const schlange = erzeugeWarteschlange<HausAuftrag, Gemessen>({ ausfuehren });
	return {
		/** Latest request per channel wins; resolves with the measured result or its fate. */
		anfragen(auftrag: HausAuftrag, kanal = 'haus', prioritaet = 0): Promise<Antwort<Gemessen>> {
			// One channel in the bible: whatever still runs for another input is stale from now on.
			const alt = laufend;
			clearTimeout(nachlauf);
			if (alt && alt.schluessel !== hausSchluessel(auftrag))
				nachlauf = setTimeout(() => laufend === alt && alt.stoppe(), NACHLAUF_MS);
			return schlange.anfragen({
				schluessel: hausSchluessel(auftrag),
				kanal,
				prioritaet,
				eingabe: auftrag
			});
		},
		abbrechen: schlange.abbrechen,
		schliessen() {
			clearTimeout(nachlauf);
			worker?.terminate();
			worker = undefined;
		}
	};
}
