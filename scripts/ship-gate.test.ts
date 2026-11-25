import { expect, test } from 'bun:test';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { runFastDeliveryChecks } from './ship-gate';

test('invalid setting bounds abort the fast delivery gate', () => {
	const root = resolve(import.meta.dir, '..');
	const cwd = mkdtempSync(resolve(root, 'node_modules/.city-delivery-check-'));
	try {
		for (const path of [
			'scripts/config-catalogue.ts',
			'scripts/config/validate.ts',
			'src/config/setting.ts',
			'src/routes/design-principles.ts'
		]) {
			const target = resolve(cwd, path);
			mkdirSync(dirname(target), { recursive: true });
			copyFileSync(resolve(root, path), target);
		}
		const slice = resolve(cwd, 'src/config/fixture/index.ts');
		mkdirSync(dirname(slice));
		writeFileSync(
			slice,
			`import { defineSettings } from '../setting';
		export const settings = defineSettings({
			widthM: {
				value: 4, unit: 'm', meaning: 'Lane width', rationale: 'Fixture',
				bounds: { exclusiveMin: 4 }
			}
		});`
		);
		writeFileSync(
			resolve(cwd, 'package.json'),
			JSON.stringify({
				scripts: { 'check:config': 'bun scripts/config-catalogue.ts --check' }
			})
		);
		const checks: string[] = [];
		expect(() =>
			runFastDeliveryChecks((command) => {
				const check = command[2];
				checks.push(check);
				if (check !== 'check:config') return;
				const result = Bun.spawnSync(command, { cwd });
				if (result.exitCode !== 0) throw new Error(result.stderr.toString());
			})
		).toThrow('src/config/fixture/index.ts:widthM: invalid bounds');
		expect(checks).toEqual(['lint', 'check', 'check:boundaries', 'check:config']);
	} finally {
		rmSync(cwd, { recursive: true, force: true });
	}
});
