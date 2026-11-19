import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Each benchmark file gets its own process and runs after the preceding file exits.
const root = fileURLToPath(new URL('../', import.meta.url));
const pattern = new Bun.Glob('**/*.perf.test.ts');
const files = ['src', 'scripts'].flatMap((dir) =>
	[...pattern.scanSync({ cwd: join(root, dir), onlyFiles: true })].map((path) => dir + '/' + path)
);

if (!files.length) {
	console.error('No performance test files found.');
	process.exit(1);
}

let failed = false;
for (const file of files.sort()) {
	const { exitCode } = Bun.spawnSync([process.execPath, 'test', './' + file], {
		cwd: root,
		stdout: 'inherit',
		stderr: 'inherit'
	});
	if (exitCode !== 0) failed = true;
}
process.exitCode = failed ? 1 : 0;
