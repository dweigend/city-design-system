import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	checkTypeEdges,
	collectTypeEdges,
	createTypeResolver,
	type GraphModule
} from './svelte-type-boundaries';

const root = process.cwd();
const config = createRequire(import.meta.url)(resolve(root, '.dependency-cruiser.cjs'));
// The supplement intentionally supports exactly today's rule shapes; never silently ignore new options.
for (const rule of config.forbidden) {
	if (
		Object.keys(rule.from).some((key) => key !== 'path') ||
		Object.keys(rule.to).some((key) => !['path', 'circular'].includes(key))
	) {
		throw new Error(`Unsupported boundary rule shape: ${rule.name}`);
	}
}
const result = Bun.spawnSync(
	[
		process.execPath,
		fileURLToPath(
			new URL('../../bin/dependency-cruiser.mjs', import.meta.resolve('dependency-cruiser'))
		),
		'src',
		'--config',
		'.dependency-cruiser.cjs',
		'--output-type',
		'json'
	],
	{ cwd: root, stdout: 'pipe', stderr: 'inherit' }
);
// The JSON reporter includes existing violations; extraction failures must never pass.
if (result.exitCode !== 0 && result.exitCode !== 1)
	throw new Error(`depcruise exit ${result.exitCode}`);
const graph: { modules: GraphModule[] } = JSON.parse(result.stdout.toString());
const edges = collectTypeEdges(
	graph.modules,
	root,
	createTypeResolver(root, config.options.enhancedResolveOptions.extensions)
);
const findings = checkTypeEdges(graph.modules, edges, config.forbidden);
for (const finding of findings) console.error(finding);
console.log(
	`Svelte type boundaries: ${edges.length} type dependencies, ${findings.length} new violations`
);
process.exitCode = findings.length ? 1 : 0;
