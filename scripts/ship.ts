import { execFileSync } from 'node:child_process';
import {
	appendFileSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	unlinkSync,
	readFileSync,
	renameSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { git, integration, preview, research, slot } from './experiment-host';

const { positionals, values } = parseArgs({
	args: process.argv.slice(2),
	allowPositionals: true,
	options: {
		package: { type: 'string' },
		'started-at': { type: 'string' },
		reference: { type: 'string' },
		before: { type: 'string' }
	}
});
const [branch] = positionals;
if (positionals.length !== 1 || !branch || ['main', 'experimente'].includes(branch))
	throw Error('Usage: bun run ship <package branch> [--package ID] [--started-at UTC]');
git('.', 'check-ref-format', '--branch', branch);
const id = values.package ?? branch.replaceAll('/', '-');
if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw Error('Invalid package ID');
const common = git('.', 'rev-parse', '--path-format=absolute', '--git-common-dir');
if (!process.env.EXPERIMENT_SHIP_LOCK) {
	const lock = Bun.spawnSync(
		[
			'flock',
			'-n',
			'-E',
			'75',
			resolve(common, 'experiment-ship.lock'),
			process.execPath,
			import.meta.path,
			...process.argv.slice(2)
		],
		{ env: { ...process.env, EXPERIMENT_SHIP_LOCK: '1' }, stdout: 'inherit', stderr: 'inherit' }
	);
	if (lock.exitCode === 75) console.error('Delivery slot unavailable');
	process.exit(lock.exitCode);
}
const work = git('.', 'rev-parse', '--show-toplevel');
function clean(path: string, expected: string) {
	if (git(path, 'branch', '--show-current') !== expected || git(path, 'status', '--porcelain'))
		throw Error('Expected clean ' + expected + ' worktree at ' + path);
}
clean(work, branch);
clean(integration, 'experimente');
const target = (...args: string[]) => git(integration, ...args);
const packageGit = (...args: string[]) => git(work, ...args);
const heavy = (args: string[], capture = false) => {
	console.log('$', ...slot, ...args);
	return (
		execFileSync(slot[0], [...slot.slice(1), ...args], {
			cwd: work,
			encoding: 'utf8',
			maxBuffer: 128 * 1024 * 1024,
			stdio: ['ignore', capture ? 'pipe' : 'inherit', 'inherit']
		}) ?? ''
	);
};

function gate(base: string) {
	for (const check of ['lint', 'check', 'check:boundaries', 'check:skills'])
		heavy(['bun', 'run', check]);
	const changed = packageGit('diff', '--name-only', '-z', base, 'HEAD').split('\0').filter(Boolean);
	const sources = changed.filter((file) => file.startsWith('src/') || file.startsWith('scripts/'));
	if (!sources.length) return;
	const reaches =
		'^(' + sources.map((file) => file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')$';
	const output = heavy(
		[
			'bunx',
			'depcruise',
			'src',
			'scripts',
			'--config',
			'.dependency-cruiser.cjs',
			'--ignore-known',
			'.dependency-cruiser-baseline.json',
			'--reaches',
			reaches,
			'-T',
			'json'
		],
		true
	);
	const graph: { modules: { source: string }[] } = JSON.parse(output);
	const files = new Set(
		[...sources, ...graph.modules.map((m) => m.source)].filter(
			(f) => f.endsWith('.test.ts') && existsSync(resolve(work, f))
		)
	);
	for (const file of files) heavy(['bun', 'test', file]);
}

const referenceArgs = values.reference ? ['--reference', values.reference] : [];
function shot(revision: string, before?: string) {
	const args = ['bun', 'run', 'shot', '--revision', revision];
	args.push(...referenceArgs);
	if (before) args.push('--before', before);
	const output = heavy(args, true).trimEnd();
	console.log(output);
	const folder = output.split('\n').at(-1);
	if (!folder || !existsSync(resolve(folder, 'manifest.json')))
		throw Error('Missing capture manifest');
	return folder;
}

const stateFile = resolve(common, 'ship-' + id + '.json');
type Delivery = { branch: string; tip: string; base: string; before: string; startedAt: string };
function baseShot(base: string) {
	const before = values.before ?? shot(base);
	if (JSON.parse(readFileSync(resolve(before, 'manifest.json'), 'utf8')).revision !== base)
		throw Error('Before capture must match the integration base');
	return before;
}
function startTime() {
	const startedAt = new Date(values['started-at'] ?? new Date()).toISOString();
	if (Date.parse(startedAt) > Date.now()) throw Error('Start time is in the future');
	return startedAt;
}
function prepare(): Delivery {
	if (existsSync(resolve(research, 'ship-receipts', id + '.json')))
		throw Error('Package ID already has a receipt');
	const base = target('rev-parse', 'HEAD');
	if (base !== target('rev-parse', 'origin/experimente'))
		throw Error('Synchronize experimente with origin before delivery');
	preview(base);
	if (packageGit('merge-base', base, 'HEAD') === packageGit('rev-parse', 'HEAD'))
		throw Error('Package already integrated');
	packageGit('merge', '--no-edit', base);
	const tip = packageGit('rev-parse', 'HEAD');
	const startedAt = startTime();
	gate(base);
	const before = baseShot(base);
	const state = { branch, tip, base, before, startedAt };
	writeFileSync(stateFile, JSON.stringify(state));
	return state;
}

target('fetch', 'origin', 'experimente');
let state: Delivery | undefined = existsSync(stateFile)
	? JSON.parse(readFileSync(stateFile, 'utf8'))
	: undefined;
if (state && state.branch !== branch) throw Error('Package ID belongs to another branch');
const remote = target('rev-parse', 'origin/experimente');
const parents = target('show', '-s', '--format=%P', remote);
const published = state && parents === [state.base, state.tip].join(' ');
if (!published && state && state.base !== remote) state = undefined;
target('merge', '--ff-only', remote);
if (target('rev-parse', 'HEAD') !== remote)
	throw Error('Local experimente has unpublished commits');
state ??= prepare();
clean(work, branch);
clean(integration, 'experimente');
if (state.tip !== packageGit('rev-parse', 'HEAD')) throw Error('Package changed after gates');

function publish(delivery: Delivery) {
	preview(delivery.base);
	const candidate = mkdtempSync(resolve(tmpdir(), 'experiment-merge-'));
	target('worktree', 'add', '--detach', candidate, delivery.base);
	try {
		git(candidate, 'merge', '--no-ff', '--no-edit', delivery.tip);
		const sha = git(candidate, 'rev-parse', 'HEAD');
		if (
			git(candidate, 'rev-parse', 'HEAD^{tree}') !==
			packageGit('rev-parse', delivery.tip + '^{tree}')
		)
			throw Error('Candidate tree changed');
		target('push', 'origin', sha + ':refs/heads/experimente');
		target('merge', '--ff-only', sha);
		return sha;
	} finally {
		target('worktree', 'remove', candidate);
	}
}
const sha = published ? remote : publish(state);
const receipts = resolve(research, 'ship-receipts');
mkdirSync(receipts, { recursive: true });
const receiptPath = resolve(receipts, id + '.json');
const existing = existsSync(receiptPath)
	? JSON.parse(readFileSync(receiptPath, 'utf8'))
	: undefined;
if (existing && existing.sha !== sha) throw Error('Package ID already has a different receipt');
const receipt = existing ?? {
	taskId: id,
	branch,
	sha,
	startedAt: state.startedAt,
	mergedAt: target('show', '-s', '--format=%cI', sha),
	shotFolder: shot(sha, state.before),
	renderedAt: new Date().toISOString()
};
writeFileSync(receiptPath + '.tmp', JSON.stringify(receipt, null, 2) + '\n');
renameSync(receiptPath + '.tmp', receiptPath);
const ledger = resolve(research, 'runde-2/belege.jsonl');
const line = JSON.stringify(receipt);
if (!existsSync(ledger) || !readFileSync(ledger, 'utf8').split('\n').includes(line))
	appendFileSync(ledger, line + '\n');
clean(work, branch);
if (packageGit('rev-parse', 'HEAD') !== state.tip) throw Error('Package advanced before cleanup');
process.chdir(integration);
target('worktree', 'remove', work);
target('branch', '-d', '--', branch);
unlinkSync(stateFile);
console.log(sha, receipt.shotFolder);
