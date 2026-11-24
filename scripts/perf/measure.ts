import { join } from 'node:path';
import type { Pipeline } from './pipeline';
import { hostContext } from './host';
import { measureBrowser } from './workloads';

const root = join(import.meta.dir, '../..');

function git(...args: string[]) {
	const result = Bun.spawnSync(['git', ...args], { cwd: root, stderr: 'inherit' });
	if (!result.success) throw new Error(`git ${args.join(' ')} exited ${result.exitCode}`);
	return result.stdout.toString().trim();
}

export function readRevision() {
	return { gitRevision: git('rev-parse', 'HEAD'), dirty: git('status', '--porcelain') !== '' };
}

async function command(args: string[], signal: AbortSignal) {
	signal.throwIfAborted();
	const child = Bun.spawn(args, { cwd: root, stdout: 'inherit', stderr: 'inherit', signal });
	const exitCode = await child.exited;
	signal.throwIfAborted();
	if (exitCode !== 0) throw new Error(`${args.join(' ')} exited ${exitCode}`);
}

async function pipeline(name: string, signal: AbortSignal) {
	signal.throwIfAborted();
	console.log(`Measuring headless ${name} pipeline`);
	const child = Bun.spawn(['bun', 'scripts/perf/pipeline.ts', name], {
		cwd: root,
		stdout: 'pipe',
		stderr: 'inherit',
		signal
	});
	const output = await new Response(child.stdout).text();
	const exitCode = await child.exited;
	signal.throwIfAborted();
	if (exitCode !== 0) throw new Error(`Headless ${name} pipeline exited ${exitCode}`);
	return JSON.parse(output) as Pipeline;
}

async function preview(signal: AbortSignal) {
	signal.throwIfAborted();
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
			env: { ...process.env, NO_COLOR: '1' },
			signal
		}
	);
	const stop = () => server.kill();
	const reader = server.stdout.pipeThrough(new TextDecoderStream()).getReader();
	const timer = setTimeout(stop, 30_000);
	try {
		let output = '';
		for (;;) {
			const { value, done } = await reader.read();
			signal.throwIfAborted();
			if (done) throw new Error(`Vite preview did not report an address: ${output}`);
			output += value;
			const origin = output.match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+\/)/)?.[1];
			if (origin) {
				clearTimeout(timer);
				console.log(`Vite preview at ${origin} (PID ${server.pid})`);
				return await measureBrowser(new URL(origin), signal);
			}
		}
	} finally {
		clearTimeout(timer);
		server.kill();
		await server.exited;
		await reader.cancel();
	}
}

export async function measure(
	skipBuild: boolean,
	revision: ReturnType<typeof readRevision>,
	signal: AbortSignal
) {
	const startedAt = new Date().toISOString();
	const hostBefore = hostContext();
	if (!skipBuild) await command(['bun', 'run', 'build'], signal);
	const town = await pipeline('town', signal);
	const largest = await pipeline('largest', signal);
	const browser = await preview(signal);
	signal.throwIfAborted();
	return {
		schemaVersion: 2,
		...revision,
		startedAt,
		bun: Bun.version,
		hostBefore,
		hostAfter: hostContext(),
		pipeline: { town, largest },
		browser
	};
}

export type Baseline = Awaited<ReturnType<typeof measure>>;
