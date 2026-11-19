/**
 * Color mode of the whole Bible: single owner (A-51).
 *
 * - `choice` is the reader's choice: 'system' (default), 'light' or 'dark'.
 * - `mode` is the effective mode. With 'system' it follows `prefers-color-scheme`, live as well.
 * - Projection: `data-theme` (effective) and `data-theme-choice` (choice) on <html>.
 *   app.css swaps the tokens there; the script in app.html sets both before the first paint.
 *
 * Svelte components read `theme.mode` (reactive). Code without runes subscribes with `onThemeChange`.
 */
export type ThemeMode = 'light' | 'dark';
export type ThemeChoice = 'system' | ThemeMode;

/** Key in localStorage; the same literal appears in the startup script in app.html. */
export const THEME_STORAGE_KEY = 'cg-theme';

const QUERY = '(prefers-color-scheme: dark)';
const browser = typeof document !== 'undefined';

const state = $state<{ choice: ThemeChoice; mode: ThemeMode }>({ choice: 'system', mode: 'light' });
let listeners: ((mode: ThemeMode) => void)[] = [];

/** Reactive, read-only view of the mode. `value` = `mode` (older callers). */
export const theme = {
	get choice(): ThemeChoice {
		return state.choice;
	},
	get mode(): ThemeMode {
		return state.mode;
	},
	get value(): ThemeMode {
		return state.mode;
	}
};

function isChoice(value: unknown): value is ThemeChoice {
	return value === 'system' || value === 'light' || value === 'dark';
}

function systemMode(): ThemeMode {
	return browser && matchMedia(QUERY).matches ? 'dark' : 'light';
}

function apply(choice: ThemeChoice) {
	const mode = choice === 'system' ? systemMode() : choice;
	const root = document.documentElement;
	root.dataset.theme = mode;
	root.dataset.themeChoice = choice;
	const changed = mode !== state.mode;
	state.choice = choice;
	state.mode = mode;
	if (changed) for (const listener of listeners) listener(mode);
}

/** Public action: set the choice, store it and apply it everywhere at once. */
export function setThemeChoice(choice: ThemeChoice) {
	if (!browser) return;
	apply(choice);
	try {
		if (choice === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
		else localStorage.setItem(THEME_STORAGE_KEY, choice);
	} catch {
		// Storage unavailable (e.g. private window): the choice applies to this session only.
	}
}

/** Calls `listener` on every change of the effective mode. Returns the unsubscribe function. */
export function onThemeChange(listener: (mode: ThemeMode) => void): () => void {
	listeners = [...listeners, listener];
	return () => {
		listeners = listeners.filter((l) => l !== listener);
	};
}

function storedChoice(): ThemeChoice {
	try {
		const saved = localStorage.getItem(THEME_STORAGE_KEY);
		return isChoice(saved) ? saved : 'system';
	} catch {
		return 'system';
	}
}

if (browser) {
	// Adopt the initial state that app.html has already set; then keep it live.
	const preset = document.documentElement.dataset.themeChoice;
	apply(isChoice(preset) ? preset : storedChoice());
	matchMedia(QUERY).addEventListener('change', () => {
		if (state.choice === 'system') apply('system');
	});
	// Choice made in another tab.
	window.addEventListener('storage', (event) => {
		if (event.key === THEME_STORAGE_KEY || event.key === null) apply(storedChoice());
	});
}
