/**
 * Clock of an explainer loop: counts seconds while it runs and the stage is in view.
 * The image itself arises purely from time (logic/stadt/zeitleiste.ts); the clock is the
 * only state. With reduced motion it never starts on its own.
 */
export function reduzierteBewegung(): boolean {
	return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export class LoopUhr {
	sekunden = $state(0);
	laeuft = $state(false);
	sichtbar = $state(false);
	/** Tempo factor, 1 = real time. */
	speed = 1;
	#frame = 0;
	#last = 0;

	/** Whether the clock starts on its own at the first `abgleichen()`; undefined afterwards. */
	#autoplay: boolean | undefined;

	/**
	 * Server and first frame in the browser start the same: paused, on the still image. Only the
	 * first `abgleichen()` (after mount) reads the motion setting and, with autoplay, starts
	 * from the beginning. This way button, symbol and image already match during hydration.
	 */
	constructor(autoplay = true, standbildS = 0) {
		this.#autoplay = autoplay;
		this.sekunden = standbildS;
	}

	#tick = (now: number) => {
		const dt = this.#last ? Math.min((now - this.#last) / 1000, 0.1) : 0;
		this.#last = now;
		this.sekunden += dt * this.speed;
		this.#frame = requestAnimationFrame(this.#tick);
	};

	/** Must be called after every change of laeuft/sichtbar (the $effect in the caller does that, so only in the browser). */
	abgleichen() {
		if (this.#autoplay !== undefined) {
			const start = this.#autoplay && !reduzierteBewegung();
			this.#autoplay = undefined;
			if (start) {
				this.sekunden = 0;
				this.laeuft = true;
			}
		}
		const go = this.laeuft && this.sichtbar;
		if (go && !this.#frame) {
			this.#last = 0;
			this.#frame = requestAnimationFrame(this.#tick);
		}
		if (!go && this.#frame) {
			cancelAnimationFrame(this.#frame);
			this.#frame = 0;
		}
	}

	set(sekunden: number) {
		this.sekunden = sekunden;
	}

	toggle() {
		this.laeuft = !this.laeuft;
	}

	stopp() {
		if (this.#frame) cancelAnimationFrame(this.#frame);
		this.#frame = 0;
	}
}

/** Phase and share within it for equally long, repeating phases. */
export function phaseBei(sekunden: number, anzahl: number, dauer: number) {
	const t = ((sekunden % (anzahl * dauer)) + anzahl * dauer) % (anzahl * dauer);
	const index = Math.min(anzahl - 1, Math.floor(t / dauer));
	return { index, anteil: (t - index * dauer) / dauer };
}
