import { resolve } from 'node:path';
import { designPrinciples } from '../src/routes/design-principles';
import { buildModuleCatalogue } from './module-catalogue';

/** Reads the source tree used by the catalogue CLI and the executable example tests. */
export async function readModuleCatalogue(root = resolve(import.meta.dir, '..')) {
	const paths = ['src/lib/**/*.{ts,svelte,md}', 'src/config/**/*.ts'].flatMap((pattern) =>
		Array.from(new Bun.Glob(pattern).scanSync(root))
	);
	const files = await Promise.all(
		Array.from(paths, async (path) => [path, await Bun.file(resolve(root, path)).text()] as const)
	);
	return buildModuleCatalogue(
		Object.fromEntries(files),
		new Set(designPrinciples.map(({ id }) => id))
	);
}

if (import.meta.main) {
	const rows = await readModuleCatalogue();
	console.log(JSON.stringify(rows, null, 2));
	const failures = rows.filter(({ errors }) => errors.length);
	for (const { module, errors } of failures) console.error(`${module}: ${errors.join(', ')}`);
	console.error(`${rows.length - failures.length} pass, ${failures.length} fail.`);
	if (!rows.length || failures.length) process.exitCode = 1;
}
