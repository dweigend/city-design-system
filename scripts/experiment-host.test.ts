import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { git, requireSlot } from './experiment-host';

test('study startup checks the current slot from a detached checkout without rebuild', () => {
	const cwd = mkdtempSync(resolve(import.meta.dir, '../node_modules/.city-study-checkout-'));
	try {
		git(cwd, 'init', '-q', '--template=', '-b', 'study');
		git(
			cwd,
			'-c',
			'user.name=Fixture',
			'-c',
			'user.email=fixture@example.com',
			'commit',
			'--allow-empty',
			'-qm',
			'Study fixture'
		);
		git(cwd, 'switch', '--detach', '-q');
		const module = JSON.stringify(resolve(import.meta.dir, 'experiment-host.ts'));
		const result = Bun.spawnSync(
			[
				process.execPath,
				'-e',
				`import { requireSlot } from ${module}; requireSlot(); console.log('slot ready');`
			],
			{ cwd }
		);
		let expectsSlot = true;
		try {
			requireSlot();
		} catch {
			expectsSlot = false; // CI can run verify without the shared server wrapper.
		}
		if (expectsSlot) {
			expect(result.stderr.toString()).toBe('');
			expect(result.exitCode).toBe(0);
			expect(result.stdout.toString().trim()).toBe('slot ready');
		} else {
			expect(result.exitCode).toBe(1);
			expect(result.stderr.toString()).toContain('requires heavy-slot');
		}
	} finally {
		rmSync(cwd, { recursive: true, force: true });
	}
});
