/**
 * Web worker of the structural simulation: runs the pure house job off the main thread and
 * reports how long it took. Time is measured here, in the host layer, never in `logic/`.
 */
import { rechneHaus, type HausAuftrag } from '../../logic/traeger/hausAuftrag';

/** The worker global, typed locally so that worker types do not leak into the page. */
const kontext = self as unknown as {
	onmessage: (ereignis: MessageEvent<{ nr: number; auftrag: HausAuftrag }>) => void;
	postMessage(nachricht: unknown): void;
};
kontext.onmessage = (ereignis) => {
	const { nr, auftrag } = ereignis.data;
	const start = performance.now();
	try {
		const ergebnis = rechneHaus(auftrag);
		kontext.postMessage({ nr, ergebnis, ms: performance.now() - start });
	} catch (fehler) {
		kontext.postMessage({ nr, grund: fehler instanceof Error ? fehler.message : String(fehler) });
	}
};
