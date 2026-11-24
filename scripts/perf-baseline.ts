import { renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { format, resolveConfig } from 'prettier';
import { requireHeavySlot } from './perf/host';
import { measure, readRevision, type Baseline } from './perf/measure';
import { report } from './perf/report';

const reference = join(import.meta.dir, 'config/perf-baseline/baseline.json');

async function main(signal: AbortSignal) {
	const args = new Set(process.argv.slice(2).filter((arg) => arg !== '--'));
	const write = args.delete('--write');
	const compare = args.delete('--compare');
	const skipBuild = args.delete('--skip-build');
	if (args.size || (write && compare))
		throw new Error('Usage: bun run perf:baseline -- [--compare | --write] [--skip-build]');
	if (write && skipBuild) throw new Error('--write requires a fresh build');
	requireHeavySlot();
	const revision = readRevision();
	if (write && revision.dirty) throw new Error('--write requires a clean Git worktree');
	const baseline = write ? undefined : ((await Bun.file(reference).json()) as Baseline);
	const current = await measure(skipBuild, revision, signal);
	if (!report(current, baseline)) {
		process.exitCode = 1;
		return;
	}
	if (write) {
		const temporary = reference + '.tmp';
		try {
			const options = await resolveConfig(reference);
			const contents = await format(JSON.stringify(current), { ...options, filepath: reference });
			const beforeWrite = readRevision();
			if (beforeWrite.dirty || beforeWrite.gitRevision !== revision.gitRevision)
				throw new Error('The Git worktree changed during the reference run');
			signal.throwIfAborted();
			await Bun.write(temporary, contents);
			signal.throwIfAborted();
			renameSync(temporary, reference);
		} finally {
			rmSync(temporary, { force: true });
		}
		console.log('Updated scripts/config/perf-baseline/baseline.json');
	}
}

if (import.meta.main) {
	const controller = new AbortController();
	const interrupt = () => controller.abort(new Error('Performance baseline interrupted by SIGINT'));
	const terminate = () =>
		controller.abort(new Error('Performance baseline interrupted by SIGTERM'));
	process.on('SIGINT', interrupt);
	process.on('SIGTERM', terminate);
	try {
		await main(controller.signal);
		controller.signal.throwIfAborted();
	} catch (error) {
		if (!controller.signal.aborted) throw error;
		console.error(String(controller.signal.reason));
		process.exitCode = 1;
	} finally {
		process.off('SIGINT', interrupt);
		process.off('SIGTERM', terminate);
	}
}
