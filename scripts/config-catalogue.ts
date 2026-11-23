import { resolve } from 'node:path';
import type { Setting } from '../src/config/setting';
import { designPrinciples } from '../src/routes/design-principles';
import { validateConfig } from './config/validate';

const root = resolve(import.meta.dir, '..');
const files = Array.from(new Bun.Glob('{src,scripts}/config/*/index.ts').scanSync(root)).sort();
const slices = await Promise.all(
	files.map(async (path) => {
		const { settings: entries } = (await import(resolve(root, path))) as Record<
			string,
			Readonly<Record<string, Setting>>
		>;
		if (!entries) throw Error(`${path}: export the settings table as settings`);
		return { path, entries };
	})
);
const errors = validateConfig(slices, new Set(designPrinciples.map(({ id }) => id)));
if (errors.length) {
	for (const error of errors) console.error(error);
	process.exitCode = 1;
} else if (process.argv.includes('--check')) {
	console.log(`Configuration checked across ${slices.length} slices.`);
} else {
	const rows = slices.flatMap(({ path, entries }) =>
		Object.entries(entries).map(([key, entry]) => ({
			capability: path.split('/')[2],
			key,
			...entry
		}))
	);
	console.log(JSON.stringify(rows, null, 2));
}
