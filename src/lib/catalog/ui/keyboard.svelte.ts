let observed = $state(false);
const missingCodes = new Set(['', 'Unidentified']);

/** Whether the user has sent a hardware-style key event in this browser session. */
export const keyboard = {
	get observed() {
		return observed;
	}
};

/** Reveals key hints after a trusted keydown with a physical key code. */
export function observeKeyboard(event: KeyboardEvent) {
	if (event.isTrusted && !event.isComposing && !missingCodes.has(event.code)) observed = true;
}
