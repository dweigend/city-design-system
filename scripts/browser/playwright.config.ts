import { defineConfig } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ci = process.env.CI === 'true';
const hardware = !ci && existsSync('/dev/dri/renderD128');
const project = join(import.meta.dirname, '../..');

if (!ci && process.platform === 'linux') requireHeavySlot();

export default defineConfig({
	testDir: '.',
	testMatch: 'flows.browser.ts',
	outputDir: '../../_lokal/browser-tests',
	timeout: 90_000,
	expect: { timeout: 15_000 },
	workers: 1,
	reporter: 'list',
	use: {
		browserName: 'chromium',
		actionTimeout: 15_000,
		viewport: { width: 1366, height: 900 },
		launchOptions: hardware
			? {
					channel: 'chrome',
					chromiumSandbox: true,
					ignoreDefaultArgs: ['--enable-unsafe-swiftshader'],
					env: { ...process.env, VK_DRIVER_FILES: '/usr/share/vulkan/icd.d/radeon_icd.json' },
					args: [
						'--use-angle=vulkan',
						'--use-vulkan=native',
						'--enable-features=Vulkan',
						'--enable-unsafe-webgpu',
						'--ignore-gpu-blocklist'
					]
				}
			: {}
	},
	webServer: {
		cwd: project,
		command:
			'if [ ! -f .svelte-kit/output/server/index.js ]; then bun run build || exit; fi; ' +
			'exec bun run preview --host 127.0.0.1 --port 0 --strictPort',
		wait: { stdout: /Local:\s+(?<city_browser_url>http:\/\/127\.0\.0\.1:\d+\/)/ },
		timeout: 180_000
	}
});

function requireHeavySlot() {
	const wrapper = execFileSync('sh', ['-c', 'command -v heavy-slot || true'], {
		encoding: 'utf8'
	}).trim();
	if (!wrapper) return;
	for (let pid = process.ppid; pid > 1;) {
		const proc = '/proc/' + pid;
		if (readFileSync(proc + '/cmdline', 'utf8').split('\0')[1] === wrapper) return;
		pid = Number(readFileSync(proc + '/status', 'utf8').match(/^PPid:\s+(\d+)/m)?.[1]);
	}
	throw new Error(
		'Run heavy-slot --exclusive --mem 4G --wait 900 -- bun run test:browser scripts/browser/flows.browser.ts'
	);
}
