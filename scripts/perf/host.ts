import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { homedir, loadavg } from 'node:os';
import { basename, join } from 'node:path';

export const bytesPerMiB = 1024 ** 2;
export const round = (value: number) => Number(value.toFixed(2));
const read = (path: string) => {
	try {
		return readFileSync(path, 'utf8');
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return '';
		throw error;
	}
};

function exclusiveOptions(args: string[]) {
	for (let index = 0; index < args.length; index++) {
		const option = args[index];
		if (option === '--exclusive') return true;
		if (!['--time', '--mem', '--wait'].includes(option)) return false;
		index++;
	}
	return false;
}

export function requireHeavySlot() {
	if (process.platform !== 'linux') return;
	const wrapper = Bun.which('heavy-slot') ?? join(homedir(), '.local/bin/heavy-slot');
	if (!existsSync(wrapper)) throw new Error('Install heavy-slot on PATH or in ~/.local/bin');
	const resolved = realpathSync(wrapper);
	for (let pid = process.ppid; pid > 1;) {
		const command = read(`/proc/${pid}/cmdline`).split('\0');
		const wrapperIndex = command
			.slice(0, 2)
			.findIndex((arg) => basename(arg) === 'heavy-slot' || arg === resolved);
		if (wrapperIndex >= 0 && exclusiveOptions(command.slice(wrapperIndex + 1))) return;
		pid = Number(read(`/proc/${pid}/status`).match(/^PPid:\s+(\d+)/m)?.[1]);
	}
	throw new Error(
		'Run heavy-slot --exclusive --mem 4G --time 600 --wait 900 -- bun run perf:baseline'
	);
}

export function hostContext() {
	const memory = read('/proc/meminfo');
	const mib = (field: string) => {
		const value = memory.match(new RegExp(`^${field}:\\s+(\\d+) kB`, 'm'))?.[1];
		return value ? round(Number(value) / 1024) : null;
	};
	const drm = '/sys/class/drm/renderD128/device';
	const sensors = existsSync(drm + '/hwmon') ? readdirSync(drm + '/hwmon') : [];
	const temperature = sensors
		.map((dir) => read(join(drm, 'hwmon', dir, 'temp1_input')).trim())
		.find(Boolean);
	return {
		loadAverage: loadavg(),
		memAvailableMiB: mib('MemAvailable'),
		swapTotalMiB: mib('SwapTotal'),
		swapFreeMiB: mib('SwapFree'),
		gpuBusyPercent: read(drm + '/gpu_busy_percent').trim() || null,
		gpuClocks: read(drm + '/pp_dpm_sclk').trim() || null,
		gpuTemperatureC: temperature ? Number(temperature) / 1000 : null
	};
}

export function rssMiB(pid: number) {
	const value = read(`/proc/${pid}/status`).match(/^VmRSS:\s+(\d+)/m)?.[1];
	return Number(value ?? 0) / 1024;
}
