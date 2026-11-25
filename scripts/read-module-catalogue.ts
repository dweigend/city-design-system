import { resolve } from 'node:path';
import { readdir } from 'node:fs/promises';
import { designPrinciples } from '../src/routes/design-principles';
import { buildModuleCatalogue } from './module-catalogue';

/** Reads the source tree used by the catalogue CLI and the executable example tests. */
export async function readModuleCatalogue(root = resolve(import.meta.dir, '..')) {
	const layers = ['core', 'domain', 'world', 'scene', 'ui'];
	const folders = await Promise.all(
		layers.map(async (layer) => {
			const path = `src/lib/${layer}`;
			const entries = await readdir(resolve(root, path), { withFileTypes: true });
			return entries.filter((entry) => entry.isDirectory()).map(({ name }) => `${path}/${name}`);
		})
	);
	const paths = [
		'docs/standards/ARCHITECTURE.md',
		...['src/lib/**/*.{ts,svelte,md}', 'src/config/**/*.ts'].flatMap((pattern) =>
			Array.from(new Bun.Glob(pattern).scanSync(root))
		)
	];
	const files = await Promise.all(
		Array.from(paths, async (path) => [path, await Bun.file(resolve(root, path)).text()] as const)
	);
	return buildModuleCatalogue(
		Object.fromEntries(files),
		new Set(designPrinciples.map(({ id }) => id)),
		folders.flat()
	);
}

if (import.meta.main) {
	const rows = await readModuleCatalogue();
	console.log(JSON.stringify(rows, null, 2));
	const failures = rows.filter(({ errors }) => errors.length);
	for (const { module, errors } of failures) console.error(`${module}: ${errors.join(', ')}`);
	const documented = rows.reduce(
		(count, row) => count + Object.keys(row.exportDocumentation).length,
		0
	);
	console.error(
		`${rows.length - failures.length} pass, ${failures.length} fail. ${documented} exports documented.`
	);
	if (!rows.length || failures.length) process.exitCode = 1;
}
