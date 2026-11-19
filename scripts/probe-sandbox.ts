import {
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	symlinkSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

// Isolated copies of the working tree for the gate probes (probe-gates.ts):
// tracked plus untracked, non-ignored files, node_modules symlinked, and a
// fresh git repository whose first commit is the base ref. The real worktree
// and its git index are never touched.

/** A temporary repository copy that a probe may change freely. */
export type Sandbox = {
	root: string;
	write: (path: string, text: string) => void;
	git: (args: string[]) => void;
};

const repo = resolve(import.meta.dir, '..');
const GIT_IDENTITY = [
	'-c',
	'user.name=probe',
	'-c',
	'user.email=probe@invalid',
	'-c',
	'commit.gpgsign=false'
];

/** Runs a command and returns its exit code with stdout and stderr combined. */
export function run(command: string[], cwd: string, env: Record<string, string> = {}) {
	const result = Bun.spawnSync(command, { cwd, env: { ...process.env, ...env } });
	return { exitCode: result.exitCode, output: result.stdout.toString() + result.stderr.toString() };
}

function sandboxGit(root: string, args: string[]): void {
	const { exitCode, output } = run(['git', ...GIT_IDENTITY, ...args], root);
	if (exitCode !== 0) throw new Error(`git ${args.join(' ')} failed in sandbox:\n${output}`);
}

/** Working-tree files that a commit of the current tree would contain. */
function treeFiles(): string[] {
	const { output } = run(['git', 'ls-files', '-z', '-c', '-o', '--exclude-standard'], repo);
	return output.split('\0').filter(Boolean);
}

/** Copies the working tree into `root`; files deleted but still tracked stay absent. */
function copyTree(root: string): void {
	for (const file of treeFiles()) {
		if (existsSync(join(repo, file))) cpSync(join(repo, file), join(root, file));
	}
}

/** Creates a sandbox; `formatFirst` runs Prettier on the copy before the base commit. */
export function createSandbox(formatFirst = false): Sandbox {
	const root = mkdtempSync(join(tmpdir(), 'city-gate-probe-'));
	copyTree(root);
	symlinkSync(join(repo, 'node_modules'), join(root, 'node_modules'));
	const git = (args: string[]) => sandboxGit(root, args);
	git(['init', '-q', '-b', 'main']);
	if (formatFirst) run(['bunx', 'prettier', '--write', '--log-level', 'silent', '.'], root);
	git(['add', '-A']);
	git(['commit', '-q', '--no-verify', '-m', 'probe base']);
	const write = (path: string, text: string) => {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), text);
	};
	return { root, write, git };
}

/** Rewrites a JSON file in the sandbox through `change`, keeping tab indentation. */
export function editJson<T>(box: Sandbox, path: string, change: (value: T) => T): void {
	const value = JSON.parse(readFileSync(join(box.root, path), 'utf8')) as T;
	box.write(path, `${JSON.stringify(change(value), null, '\t')}\n`);
}
