/**
 * Queue contract between a game and its structural computations. The caller asks and goes on;
 * the answer arrives later or not at all. Headless: the executor is injected (a web worker in
 * the browser, a plain function in a test), so this module owns no thread, clock or timer.
 *
 * Rules: one job runs at a time. Waiting jobs start by priority, then by arrival. A new job in a
 * channel makes every older job of that channel stale. A finished result is kept under its key.
 */
export type Auftrag<E> = {
	/** Cache key of the input, see `schluessel`. */
	schluessel: string;
	/** What the answer is for, e.g. one house. Only the newest job of a channel counts. */
	kanal: string;
	/** Higher starts first; what the player looks at beats what is far away. */
	prioritaet: number;
	eingabe: E;
};
export type Antwort<A> =
	| { status: 'fertig'; ergebnis: A; ausCache: boolean }
	/** Superseded or cancelled; the caller keeps what it shows. */
	| { status: 'veraltet' }
	/** The executor rejected, e.g. a time limit of the host. Never cached. */
	| { status: 'fehler'; grund: string };
export type Warteschlange<E, A> = {
	/** Never rejects. Resolves at once from the cache, else when the job ends or goes stale. */
	anfragen(auftrag: Auftrag<E>): Promise<Antwort<A>>;
	/** Makes all jobs of a channel stale. A running job ends unseen. */
	abbrechen(kanal: string): void;
	stand(): { laufend: number; wartend: number };
};

type Eintrag<E, A> = {
	auftrag: Auftrag<E>;
	folge: number;
	veraltet: boolean;
	antworte: (antwort: Antwort<A>) => void;
};

/**
 * Creates an independent queue with its own bounded cache (oldest entry leaves first).
 * `ausfuehren` computes one input; it is never called twice at the same time.
 */
export function erzeugeWarteschlange<E, A>(optionen: {
	ausfuehren: (eingabe: E) => Promise<A>;
	cacheGroesse?: number;
}): Warteschlange<E, A> {
	const groesse = optionen.cacheGroesse ?? 32;
	const cache = new Map<string, A>();
	const wartend: Eintrag<E, A>[] = [];
	let laufend: Eintrag<E, A> | undefined;
	let folge = 0;

	function merke(key: string, ergebnis: A) {
		cache.delete(key);
		cache.set(key, ergebnis);
		while (cache.size > groesse) cache.delete(cache.keys().next().value as string);
	}
	function verwerfe(kanal: string) {
		for (let i = wartend.length - 1; i >= 0; i--)
			if (wartend[i].auftrag.kanal === kanal)
				wartend.splice(i, 1)[0].antworte({ status: 'veraltet' });
		// A running job cannot be recalled; its answer is settled now, its result still cached.
		if (laufend && laufend.auftrag.kanal === kanal && !laufend.veraltet) {
			laufend.veraltet = true;
			laufend.antworte({ status: 'veraltet' });
		}
	}
	function starte() {
		if (laufend || !wartend.length) return;
		wartend.sort((a, b) => b.auftrag.prioritaet - a.auftrag.prioritaet || a.folge - b.folge);
		const eintrag = wartend.shift() as Eintrag<E, A>;
		const { schluessel } = eintrag.auftrag;
		const bekannt = cache.get(schluessel);
		if (bekannt !== undefined) {
			eintrag.antworte({ status: 'fertig', ergebnis: bekannt, ausCache: true });
			return starte();
		}
		laufend = eintrag;
		optionen.ausfuehren(eintrag.auftrag.eingabe).then(
			(ergebnis) => {
				merke(schluessel, ergebnis);
				if (!eintrag.veraltet) eintrag.antworte({ status: 'fertig', ergebnis, ausCache: false });
				laufend = undefined;
				starte();
			},
			(fehler: unknown) => {
				const grund = fehler instanceof Error ? fehler.message : String(fehler);
				if (!eintrag.veraltet) eintrag.antworte({ status: 'fehler', grund });
				laufend = undefined;
				starte();
			}
		);
	}
	return {
		anfragen(auftrag) {
			const bekannt = cache.get(auftrag.schluessel);
			verwerfe(auftrag.kanal);
			if (bekannt !== undefined)
				return Promise.resolve({ status: 'fertig', ergebnis: bekannt, ausCache: true });
			return new Promise((antworte) => {
				wartend.push({ auftrag, folge: folge++, veraltet: false, antworte });
				starte();
			});
		},
		abbrechen: verwerfe,
		stand: () => ({ laufend: laufend ? 1 : 0, wartend: wartend.length })
	};
}
