import { existsSync, lstatSync, mkdirSync, readFileSync, symlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createServer } from 'node:net';

// Reproducible setup for a fresh worktree: pinned bun, frozen install,
// SvelteKit sync, private skill links, git orientation and a free dev port.
// Changes nothing outside this worktree. The bun pin lives in the CI workflow, the one source.
const WORKFLOW = '.github/workflows/verify.yml';
/**
 * 5180 is the shared live preview (bibel-preview); never hand it out.
 * 5191 is the Playwright server of `bun run test:browser` (playwright.config.ts). */
const RESERVED_PORTS = new Set([5180, 5191]);
/** Untracked private skill folders; the main checkout holds the only copy. */
const SKILL_DIRS = ['.claude/skills', '.agents/skills'];
const PORT_START = 5190;
const PORT_ATTEMPTS = 50;
const BUSY = new Set(['EADDRINUSE', 'EACCES']);

/** The bun version pinned in the CI workflow. */
function pinnedBunVersion(): string {
	const match = readFileSync(WORKFLOW, 'utf8').match(/bun-version:\s*['"]?([\d.]+)/);
	if (!match) throw new Error(`no bun-version pin found in ${WORKFLOW}`);
	return match[1];
}

/** Runs a command with inherited output and throws when it fails. */
function step(command: string[]): void {
	console.log(`\n$ ${command.join(' ')}`);
	const { exitCode } = Bun.spawnSync(command, { stdout: 'inherit', stderr: 'inherit' });
	if (exitCode !== 0) throw new Error(`${command.join(' ')} failed (exit ${exitCode})`);
}

function gitLine(args: string[]): string {
	const { exitCode, stdout } = Bun.spawnSync(['git', ...args], { stderr: 'ignore' });
	return exitCode === 0 ? stdout.toString().trimEnd() : '';
}

/** Prints branch, upstream and working-tree status as an ownership hint. */
function printGitState(): void {
	const branch = gitLine(['branch', '--show-current']) || '(detached HEAD)';
	const upstream = gitLine(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}']);
	const status = gitLine(['status', '--short']);
	console.log(`\nbranch   ${branch}`);
	console.log(`upstream ${upstream || 'none (local branch, not pushed yet)'}`);
	console.log(status ? `changes\n${status}` : 'changes  none');
	console.log('Changes listed above may belong to other agents: preserve them.');
}

/** Absolute path of the main checkout, the parent of the shared git directory. */
function mainCheckout(): string {
	const common = gitLine(['rev-parse', '--path-format=absolute', '--git-common-dir']);
	if (!common) throw new Error('not inside a git repository');
	return dirname(common);
}

/** Links one private skill folder of the main checkout into this worktree unless it already exists. */
function linkSkillDir(dir: string, main: string): string {
	const target = resolve(main, dir);
	if (lstatSync(dir, { throwIfNoEntry: false })) return `${dir} exists, left as is`;
	if (!existsSync(target)) return `${target} missing, not linked`;
	mkdirSync(dirname(dir), { recursive: true });
	symlinkSync(target, dir);
	return `${dir} -> ${target}`;
}

/** Throws unless every private skill folder is untracked and gitignored (no trailing slash: links are not directories to git). */
function assertSkillsPrivate(): void {
	if (gitLine(['ls-files', ...SKILL_DIRS])) throw new Error('private skills are tracked');
	const exposed = SKILL_DIRS.filter(
		(dir) => Bun.spawnSync(['git', 'check-ignore', '-q', dir]).exitCode !== 0
	);
	if (exposed.length) throw new Error(`not gitignored: ${exposed.join(', ')}`);
}

/**
 * Links the private skill folders of the main checkout into this worktree so agents discover
 * them here too. Existing folders or links stay untouched.
 */
function linkPrivateSkills(): void {
	const main = mainCheckout();
	const isMain = resolve(main) === resolve(process.cwd());
	const lines = isMain
		? ['main checkout, nothing to link']
		: SKILL_DIRS.map((dir) => linkSkillDir(dir, main));
	for (const line of lines) console.log(`private skills: ${line}`);
	assertSkillsPrivate();
}

/** True unless binding `host:port` fails because the port is taken or forbidden. */
function canBind(port: number, host: string): Promise<boolean> {
	return new Promise((done) => {
		const server = createServer();
		server.once('error', (error: NodeJS.ErrnoException) => done(!BUSY.has(error.code ?? '')));
		server.listen(port, host, () => server.close(() => done(true)));
	});
}

/** Free on IPv4 and IPv6, so a dev server on either localhost cannot collide. */
async function isFree(port: number): Promise<boolean> {
	return (await canBind(port, '0.0.0.0')) && (await canBind(port, '::'));
}

/** First free port from PORT_START on, skipping reserved ports. */
async function freeDevPort(): Promise<number> {
	for (let port = PORT_START; port < PORT_START + PORT_ATTEMPTS; port += 1) {
		if (!RESERVED_PORTS.has(port) && (await isFree(port))) return port;
	}
	throw new Error(`no free port in ${PORT_START}-${PORT_START + PORT_ATTEMPTS - 1}`);
}

const pinned = pinnedBunVersion();
if (Bun.version !== pinned) {
	throw new Error(
		`bun ${Bun.version} found, ${pinned} pinned in ${WORKFLOW}; install bun ${pinned}`
	);
}
console.log(`bun ${Bun.version} matches the pin`);
step(['bun', 'install', '--frozen-lockfile']);
step(['bunx', 'svelte-kit', 'sync']);
linkPrivateSkills();
printGitState();
const port = await freeDevPort();
console.log(`\ndev server: bun run dev -- --port ${port} --strictPort`);
