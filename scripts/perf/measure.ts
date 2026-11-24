import { join } from 'node:path';
import type { Pipeline } from './pipeline';
import { hostContext } from './host';
import { measureBrowser } from './workloads';

const root = join(import.meta.dir, '../..');

function git(...args: string[]) {
	return Bun.spawnSync(['git', ...args], { cwd: root })
		.stdout.toString()
		.trim();
}

function command(args: string[]) {
	const { success, exitCode } = Bun.spawnSync(args, {
		cwd: root,
		stdout: 'inherit',
		stderr: 'inherit'
	});
	if (!success) throw new Error(`${args.join(' ')} exited ${exitCode}`);
}

function pipeline(name: string) {
	console.log(`Measuring headless ${name} pipeline`);
	const result = Bun.spawnSync(['bun', 'scripts/perf/pipeline.ts', name], {
		cwd: root,
		stderr: 'inherit'
	});
	if (!result.success) throw new Error(`Headless ${name} pipeline exited ${result.exitCode}`);
	return JSON.parse(result.stdout.toString()) as Pipeline;
}

async function preview<T>(run: (origin: URL) => Promise<T>) {
	const server = Bun.spawn(
		[
			'node',
			'node_modules/vite/bin/vite.js',
			'preview',
			'--host',
			'127.0.0.1',
			'--port',
			'0',
			'--strictPort'
		],
		{
			cwd: root,
			stdout: 'pipe',
			stderr: 'inherit',
			env: { ...process.env, NO_COLOR: '1' }
		}
	);
	const stop = () => server.kill();
	process.once('SIGINT', stop);
	process.once('SIGTERM', stop);
	const reader = server.stdout.pipeThrough(new TextDecoderStream()).getReader();
	const timer = setTimeout(stop, 30_000);
	try {
		let output = '';
		for (;;) {
			const { value, done } = await reader.read();
			if (done) throw new Error(`Vite preview did not report an address: ${output}`);
			output += value;
			const origin = output.match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+\/)/)?.[1];
			if (origin) {
				clearTimeout(timer);
				console.log(`Vite preview at ${origin} (PID ${server.pid})`);
				return await run(new URL(origin));
			}
		}
	} finally {
		clearTimeout(timer);
		server.kill();
		await server.exited;
		await reader.cancel();
		process.removeListener('SIGINT', stop);
		process.removeListener('SIGTERM', stop);
	}
}

export async function measure(skipBuild: boolean) {
	const gitRevision = git('rev-parse', 'HEAD');
	const dirty = git('status', '--porcelain') !== '';
	const startedAt = new Date().toISOString();
	const hostBefore = hostContext();
	if (!skipBuild) command(['bun', 'run', 'build']);
	const town = pipeline('town');
	const largest = pipeline('largest');
	const browser = await preview(measureBrowser);
	return {
		schemaVersion: 1,
		gitRevision,
		dirty,
		startedAt,
		bun: Bun.version,
		hostBefore,
		hostAfter: hostContext(),
		pipeline: { town, largest },
		browser
	};
}

export type Baseline = Awaited<ReturnType<typeof measure>>;
