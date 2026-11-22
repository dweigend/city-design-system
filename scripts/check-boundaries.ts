import { resolve } from 'node:path';
import type { ICruiseResult } from 'dependency-cruiser';

const root = resolve(import.meta.dir, '..');
const domainModule = /^(src\/lib\/domain\/[^/]+)\//;

/** Read the real dependency graph and its named violations for a source tree. */
export function readImportGraph(cwd: string, roots: string[]): ICruiseResult {
	const result = Bun.spawnSync(
		[
			'node',
			resolve(root, 'node_modules/.bin/depcruise'),
			'--config',
			resolve(root, '.dependency-cruiser.cjs'),
			'--ts-config',
			resolve(root, 'tsconfig.json'),
			'--output-type',
			'json',
			...roots
		],
		{ cwd, stderr: 'inherit' }
	);
	if (result.exitCode !== 0) throw Error(`dependency-cruiser exited with ${result.exitCode}`);
	return JSON.parse(result.stdout.toString()) as ICruiseResult;
}

/** Report domain folders that import more than three distinct peer folders. */
export function checkDomainFanout({ modules }: ICruiseResult): string[] {
	const peersByModule = new Map<string, Set<string>>();
	for (const { source, dependencies } of modules) {
		const from = domainModule.exec(source)?.[1];
		if (!from) continue;
		const peers = peersByModule.get(from) ?? new Set<string>();
		for (const { resolved } of dependencies) {
			const to = domainModule.exec(resolved)?.[1];
			if (to && from !== to) peers.add(to);
		}
		peersByModule.set(from, peers);
	}
	return Array.from(peersByModule)
		.filter(([, peers]) => peers.size > 3)
		.map(([from, peers]) => `domain-max-three: ${from} imports ${[...peers].sort().join(', ')}`);
}

if (import.meta.main) {
	const graph = readImportGraph(root, ['src', 'scripts']);
	const errors = graph.summary.violations.filter(({ rule }) => rule.severity === 'error');
	for (const { rule, from, to } of errors) console.error(`${rule.name}: ${from} → ${to}`);
	const fanout = checkDomainFanout(graph);
	for (const message of fanout) console.error(message);
	if (errors.length + fanout.length > 0) process.exitCode = 1;
	else console.log('Import boundaries passed.');
}
