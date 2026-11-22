import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { readFileSync, readlinkSync } from 'node:fs';

/** Read one Git result without invoking a shell. */
export function git(cwd: string, ...args: string[]) {
	return execFileSync('git', args, { cwd, encoding: 'utf8' }).trimEnd();
}

export const lane = 'rebuild';

const worktrees = git('.', 'worktree', 'list', '--porcelain', '-z').split('\0\0');
const worktree = worktrees.find((entry) => entry.split('\0').includes('branch refs/heads/' + lane));
if (!worktree) throw Error('Expected a worktree on ' + lane);
export const integration = worktree.split('\0')[0].slice('worktree '.length);

const repository = dirname(git('.', 'rev-parse', '--path-format=absolute', '--git-common-dir'));
export const research = resolve(repository, '../city-design-lab/research');
export const shots = resolve(integration, '_lokal/rebuild-shots');
export const previewPort = 5182;
export const slot = [
	'heavy-slot',
	'--exclusive',
	'--mem',
	'2G',
	'--time',
	'600',
	'--wait',
	'900',
	'--'
];

/** Require the actual server slot wrapper among our living ancestors. */
export function requireSlot() {
	const wrapper = Bun.which('heavy-slot');
	for (let pid = process.ppid; pid > 1;) {
		const proc = '/proc/' + pid;
		if (readFileSync(proc + '/cmdline', 'utf8').split('\0')[1] === wrapper) return;
		pid = Number(readFileSync(proc + '/status', 'utf8').match(/^PPid:\s+(\d+)/m)?.[1]);
	}
	throw Error('Browser requires heavy-slot. Run ' + slot.join(' ') + ' bun run shot');
}

/** Bind the local Vite listener to the clean rebuild worktree and revision. */
export function preview(revision: string) {
	if (
		git(integration, 'branch', '--show-current') !== lane ||
		git(integration, 'rev-parse', 'HEAD') !== revision ||
		git(integration, 'status', '--porcelain')
	)
		throw Error('Preview revision changed or checkout is dirty');
	return listenerOrigin();
}

function listenerOrigin() {
	const listener = execFileSync('ss', ['-Hlnpt', 'sport = :' + previewPort], {
		encoding: 'utf8'
	}).trim();
	const pid = listener.match(/pid=(\d+)/)?.[1];
	if (!pid || readlinkSync('/proc/' + pid + '/cwd') !== integration)
		throw Error('Expected the rebuild preview worktree on port ' + previewPort);
	const host = listener.split(/\s+/)[3];
	return 'http://' + host.replace(/^0\.0\.0\.0:/, '127.0.0.1:');
}
