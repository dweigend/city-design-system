import { renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { requireHeavySlot } from './perf/host';
import { measure, type Baseline } from './perf/measure';
import { report } from './perf/report';

const reference = join(import.meta.dir, 'config/perf-baseline/baseline.json');

async function main() {
	const args = new Set(process.argv.slice(2).filter((arg) => arg !== '--'));
	const write = args.delete('--write');
	const compare = args.delete('--compare');
	const skipBuild = args.delete('--skip-build');
	if (args.size || (write && compare))
		throw new Error('Usage: bun run perf:baseline -- [--compare | --write] [--skip-build]');
	requireHeavySlot();
	const baseline = write ? undefined : ((await Bun.file(reference).json()) as Baseline);
	const current = await measure(skipBuild);
	if (!report(current, baseline)) {
		process.exitCode = 1;
		return;
	}
	if (write) {
		const temporary = reference + '.tmp';
		try {
			await Bun.write(temporary, JSON.stringify(current, null, '\t') + '\n');
			renameSync(temporary, reference);
		} finally {
			rmSync(temporary, { force: true });
		}
		console.log('Updated scripts/config/perf-baseline/baseline.json');
	}
}

if (import.meta.main) await main();
