/** Loads the scene modules for headless sandbox projection tests. */
export async function loadStructureModules() {
	// Bun loads the Leitstil entry point without compiling the theme's Svelte rune.
	const shim = !('$state' in globalThis);
	if (shim)
		Object.defineProperty(globalThis, '$state', {
			configurable: true,
			value: (value: unknown) => value
		});
	return Promise.all([
		import('../structure-materials'),
		import('../structure-parts'),
		import('../structures')
	]).finally(() => {
		if (shim) Reflect.deleteProperty(globalThis, '$state');
	});
}
