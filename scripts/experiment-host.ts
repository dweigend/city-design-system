import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { readFileSync, readlinkSync } from 'node:fs';

/** Read one Git result without invoking a shell. */
export function git(cwd: string, ...args: string[]) {
	return execFileSync('git', args, { cwd, encoding: 'utf8' }).trimEnd();
}

export const integration = dirname(
	git('.', 'rev-parse', '--path-format=absolute', '--git-common-dir')
);
export const research = resolve(integration, '../city-design-lab/research');
export const shots = resolve(research, 'runde-2/shots');
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

/** Bind the local Vite listener to the clean experiment checkout and revision. */
export function preview(revision: string) {
	if (
		git(integration, 'branch', '--show-current') !== 'experimente' ||
		git(integration, 'rev-parse', 'HEAD') !== revision ||
		git(integration, 'status', '--porcelain')
	)
		throw Error('Preview revision changed or checkout is dirty');
	return listenerOrigin();
}

function listenerOrigin() {
	const listener = execFileSync('ss', ['-Hlnpt', 'sport = :5181'], { encoding: 'utf8' }).trim();
	const pid = listener.match(/pid=(\d+)/)?.[1];
	if (!pid || readlinkSync('/proc/' + pid + '/cwd') !== integration)
		throw Error('Expected the experiment preview checkout on port 5181');
	const host = listener.split(/\s+/)[3];
	return 'http://' + host.replace(/^0\.0\.0\.0:/, '127.0.0.1:');
}
