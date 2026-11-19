/**
 * Pointer and wheel gestures of a picker dial (DOM only, no domain state). `schritt` receives a
 * signed number of options to move. Thresholds are CSS pixels.
 */
const SCHWELLE_PX = 36;
const RAD_PAUSE_MS = 120;

/**
 * Signed wheel delta that steps the dial, or 0 to let the page scroll. Horizontal gestures
 * always step; vertical turns only while the dial holds focus, so a page scroll passes over it.
 */
function radDelta(e: WheelEvent): number {
	if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return e.deltaX;
	const ziel = e.currentTarget;
	return ziel instanceof HTMLElement && ziel.matches(':focus-within') ? e.deltaY : 0;
}

/**
 * Creates the dial's gesture handlers: one step per wheel notch, a swipe steps by the swiped
 * distance in cells of `zelleRem`, and the click that ends a swipe is swallowed.
 */
export function radGesten(schritt: (d: number) => void, zelleRem: number) {
	let rest = 0;
	let sperreBis = 0;
	let startX: number | undefined;
	let gewischt = false;
	return {
		rad(this: void, e: WheelEvent) {
			const d = radDelta(e);
			if (d === 0) return;
			e.preventDefault();
			rest += d;
			if (Math.abs(rest) < SCHWELLE_PX || e.timeStamp < sperreBis) return;
			schritt(Math.sign(rest));
			rest = 0;
			sperreBis = e.timeStamp + RAD_PAUSE_MS;
		},
		start(this: void, e: PointerEvent) {
			startX = e.clientX;
			gewischt = false;
		},
		abbrechen(this: void) {
			startX = undefined;
		},
		ende(this: void, e: PointerEvent) {
			if (startX === undefined) return;
			const dx = e.clientX - startX;
			startX = undefined;
			if (Math.abs(dx) < SCHWELLE_PX) return;
			gewischt = true;
			const zellePx = zelleRem * parseFloat(getComputedStyle(document.documentElement).fontSize);
			schritt(-Math.sign(dx) * Math.max(1, Math.round(Math.abs(dx) / zellePx)));
		},
		klick(this: void, e: MouseEvent) {
			if (!gewischt) return;
			gewischt = false;
			e.preventDefault();
			e.stopPropagation();
		}
	};
}
