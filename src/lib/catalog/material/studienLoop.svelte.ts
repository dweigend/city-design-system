import { onMount } from 'svelte';
import { LoopUhr, phaseBei } from '../bibel/loopUhr.svelte';

/** Runs equally timed study phases while their host is visible. Durations are seconds. A paused
 * step opens at the authored still fraction (0–1). Mount owns the observer and clock cleanup. */
export function studienLoop(
	host: () => HTMLElement,
	anzahl: number,
	dauerS: number,
	still: number,
	rootMargin = '100px'
) {
	const uhr = new LoopUhr(true, still * dauerS);
	const stand = $derived(phaseBei(uhr.sekunden, anzahl, dauerS));
	onMount(() => {
		const io = new IntersectionObserver(([e]) => (uhr.sichtbar = e.isIntersecting), { rootMargin });
		io.observe(host());
		return () => {
			io.disconnect();
			uhr.stopp();
		};
	});
	$effect(() => uhr.abgleichen());
	return {
		uhr,
		get stand() {
			return stand;
		},
		schritte: {
			get index() {
				return stand.index;
			},
			get anteil() {
				return stand.anteil;
			},
			get laeuft() {
				return uhr.laeuft;
			},
			onwahl(i: number) {
				uhr.set((i + (uhr.laeuft ? 0 : still)) * dauerS);
			},
			onumschalten() {
				uhr.toggle();
			}
		}
	};
}
