import { existsSync, statSync } from 'node:fs';

// Fallow gate: fails on findings absent from the committed baselines, on stale
// baseline entries and on baseline growth against the base ref (C-64).
// `--save` rewrites the baselines; allowed only to record a reduction or an
// owner-approved exception. Identity mode tracks findings, not metric ceilings.
const BASELINE_DIR = '.fallow-baselines';
const BASE_REF = process.env.FALLOW_BASELINE_BASE ?? 'main';
/** Fallow exits 1 for findings; anything higher is a tool failure. */
const MAX_FINDINGS_EXIT = 1;

type Analysis = { name: string; args: string[] };

const analyses: Analysis[] = [
	{ name: 'dead-code', args: [] },
	{ name: 'health', args: ['--complexity', '--baseline-mode', 'identity'] },
	{ name: 'dupes', args: [] }
];

function baselinePath(name: string): string {
	return `${BASELINE_DIR}/${name}.json`;
}

/** Compares one analysis against its baseline; returns true when the gate passes. */
function compare({ name, args }: Analysis): boolean {
	const gateArgs = ['--baseline', baselinePath(name), '--fail-on-stale-baseline'];
	const growthArgs = ['--fail-on-baseline-growth', '--baseline-base', BASE_REF];
	const failArgs = name === 'dupes' ? ['--fail-on-issues'] : [];
	const command = ['bunx', 'fallow', name, ...args, ...failArgs, ...gateArgs, ...growthArgs];
	const { exitCode } = Bun.spawnSync([...command, '--quiet'], {
		stdout: 'inherit',
		stderr: 'inherit'
	});
	console.log(`fallow ${name} exit ${exitCode}`);
	return exitCode === 0;
}

/** Modification time in ms, or 0 when the file does not exist. */
function modifiedAt(path: string): number {
	return existsSync(path) ? statSync(path).mtimeMs : 0;
}

/** Saves one baseline; returns true only if Fallow ran without error and wrote the file. */
function save({ name, args }: Analysis): boolean {
	const path = baselinePath(name);
	const before = modifiedAt(path);
	const command = ['bunx', 'fallow', name, ...args, '--save-baseline', path, '--quiet'];
	const { exitCode } = Bun.spawnSync(command, { stdout: 'ignore', stderr: 'inherit' });
	const ok = exitCode <= MAX_FINDINGS_EXIT && modifiedAt(path) > before;
	console.log(`fallow ${name}`, ok ? 'baseline saved' : `baseline NOT saved (exit ${exitCode})`);
	return ok;
}

const saveMode = process.argv.includes('--save');
let passed = true;
for (const analysis of analyses) {
	passed = (saveMode ? save(analysis) : compare(analysis)) && passed;
}
process.exitCode = passed ? 0 : 1;
