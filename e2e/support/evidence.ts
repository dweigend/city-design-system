import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Browser, Page } from '@playwright/test';

/**
 * Opt-in screenshot evidence (DS-70, DS-73). Each capture writes one entry file; the global
 * teardown merges them into `manifest.json`. Software-rendered WebGL is visual evidence only.
 */
export type EvidenceEntry = {
	file: string;
	target: string;
	route: string;
	demo: string | null;
	viewport: string;
	theme: string;
	seed: string;
	state: string;
	browser: string;
	renderer: string;
	webgpu: string;
	fonts: string;
	gitHead: string;
	gitDiffStatSha256: string;
	capturedAt: string;
};

const ENTRIES = '.entries';

/** Target directory of the evidence run (absolute path from `EVIDENCE_DIR`). */
export function evidenceDir(): string {
	const dir = process.env.EVIDENCE_DIR;
	if (!dir) throw new Error('EVIDENCE_DIR is not set');
	mkdirSync(join(dir, ENTRIES), { recursive: true });
	return dir;
}

function git(...args: string[]): string {
	return execFileSync('git', args, { encoding: 'utf8' });
}

/** HEAD and a hash of `git diff --stat`, read at capture time (other agents edit concurrently). */
export function worktreeState() {
	return {
		gitHead: git('rev-parse', 'HEAD').trim(),
		gitDiffStatSha256: createHash('sha256').update(git('diff', '--stat')).digest('hex')
	};
}

/** Browser name and version, the unmasked WebGL renderer and whether WebGPU found an adapter. */
export async function renderInfo(page: Page, browser: Browser) {
	const gpu = await page.evaluate(async () => {
		const gl = document.createElement('canvas').getContext('webgl2');
		const ext = gl?.getExtension('WEBGL_debug_renderer_info');
		const renderer = gl
			? String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER))
			: 'no WebGL';
		gl?.getExtension('WEBGL_lose_context')?.loseContext();
		const nav = navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } };
		const adapter = nav.gpu ? await nav.gpu.requestAdapter().catch(() => null) : null;
		return { renderer, webgpu: adapter ? 'adapter available' : 'no adapter (WebGL2 backend)' };
	});
	return { browser: `${browser.browserType().name()} ${browser.version()}`, ...gpu };
}

/** Writes one manifest entry next to the screenshots. */
export function recordEntry(entry: EvidenceEntry) {
	writeFileSync(
		join(evidenceDir(), ENTRIES, `${entry.file}.json`),
		JSON.stringify(entry, null, '\t')
	);
}

/** Merges all entry files into `manifest.json`, sorted by file name. */
export function writeManifest(dir: string) {
	const entriesDir = join(dir, ENTRIES);
	const entries = readdirSync(entriesDir)
		.filter((f) => f.endsWith('.json'))
		.map((f) => JSON.parse(readFileSync(join(entriesDir, f), 'utf8')) as EvidenceEntry)
		.sort((a, b) => a.file.localeCompare(b.file));
	writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ entries }, null, '\t') + '\n');
	return entries.length;
}
