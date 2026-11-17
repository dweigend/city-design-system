import { rmSync } from 'node:fs';
import { probes, type Probe } from './probe-cases';
import { createSandbox, run } from './probe-sandbox';

// Negative probes: each gate must fail on an injected violation, and its output
// must name that violation (so an unrelated failure never counts as proof).
// Every probe runs in its own sandbox copy (probe-sandbox.ts).
// Usage: `bun run probe:gates [name-prefix ...]` runs all probes or the matching ones.

/** Injects the probe's violation into a fresh sandbox and runs its gate there. */
function gateOutcome(probe: Probe): { exitCode: number; output: string } {
	const box = createSandbox(probe.formatFirst);
	try {
		probe.inject(box);
		if (probe.commit) box.git(['commit', '-q', '-a', '--no-verify', '-m', 'probe injection']);
		return run(probe.gate, box.root, { BASELINE_BASE: 'HEAD' });
	} finally {
		rmSync(box.root, { recursive: true, force: true });
	}
}

/** Runs one probe; returns true when the gate failed and named the injected violation. */
function runProbe(probe: Probe): boolean {
	const { exitCode, output } = gateOutcome(probe);
	const proven = exitCode !== 0 && probe.expect.test(output);
	console.log(
		proven ? 'proven' : `NOT PROVEN\n${output.slice(-4000)}`,
		`exit ${exitCode}`,
		probe.name
	);
	return proven;
}

const prefixes = process.argv.slice(2);
const matches = (name: string) => prefixes.some((prefix) => name.startsWith(prefix));
const chosen = prefixes.length === 0 ? probes : probes.filter(({ name }) => matches(name));
const results = chosen.map(runProbe);
console.log(`\n${results.filter(Boolean).length}/${results.length} gates proven`);
process.exitCode = results.length > 0 && results.every(Boolean) ? 0 : 1;
