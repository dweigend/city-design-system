import { defineConfig } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { basename, join } from 'node:path';

const ci = process.env.CI === 'true';
const project = join(import.meta.dirname, '../..');

requireHeavySlot();
if (!ci && !existsSync('/dev/dri/renderD128')) {
	throw new Error('Local browser tests require the AMD render device /dev/dri/renderD128');
}

const webGpuArgs = ['--enable-features=Vulkan', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'];
const reuseBuild = ci || process.env.CITY_BROWSER_SKIP_BUILD === '1';
const build = reuseBuild
	? 'if [ ! -f .svelte-kit/output/server/index.js ]; then bun run build || exit; fi; '
	: 'bun run build && ';

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
		launchOptions: ci
			? {
					// Keep the compositor and Dawn on SwiftShader. Mixing native Vulkan
					// with SwiftShader can leave the WebGPU canvas texture invalid.
					args: ['--use-angle=swiftshader', '--use-vulkan=swiftshader', ...webGpuArgs]
				}
			: {
					channel: 'chrome',
					chromiumSandbox: true,
					ignoreDefaultArgs: ['--enable-unsafe-swiftshader'],
					env: { ...process.env, VK_DRIVER_FILES: '/usr/share/vulkan/icd.d/radeon_icd.json' },
					args: ['--use-angle=vulkan', '--use-vulkan=native', ...webGpuArgs]
				}
	},
	webServer: {
		cwd: project,
		command: build + 'exec bun run preview --host 127.0.0.1 --port 0 --strictPort',
		wait: { stdout: /Local:\s+(?<city_browser_url>http:\/\/127\.0\.0\.1:\d+\/)/ },
		timeout: 180_000
	}
});

function requireHeavySlot() {
	const found = execFileSync('sh', ['-c', 'command -v heavy-slot || true'], {
		encoding: 'utf8'
	}).trim();
	const wrapper = found || '/home/david/.local/bin/heavy-slot';
	if (!existsSync(wrapper)) return;
	const resolvedWrapper = realpathSync(wrapper);
	for (let pid = process.ppid; pid > 1;) {
		const proc = '/proc/' + pid;
		const command = readFileSync(proc + '/cmdline', 'utf8')
			.split('\0')
			.slice(0, 2);
		if (command.some((arg) => basename(arg) === 'heavy-slot' || arg === resolvedWrapper)) return;
		pid = Number(readFileSync(proc + '/status', 'utf8').match(/^PPid:\s+(\d+)/m)?.[1]);
	}
	throw new Error('Run heavy-slot --exclusive --mem 4G --wait 900 -- bun run test:browser');
}
