const reports = ['analyze:health', 'analyze:unused', 'analyze:duplication'];
// check:boundaries runs the runtime graph and the Svelte type supplement, even on failure.
const gates = ['check', 'lint', 'test', 'build', 'check:boundaries'];
let failed = false;
for (const name of [...reports, ...gates]) {
	const result = Bun.spawnSync(['bun', 'run', name], { stdout: 'inherit', stderr: 'inherit' });
	console.log(name, 'exit', result.exitCode);
	if (gates.includes(name) && result.exitCode !== 0) failed = true;
}
process.exitCode = failed ? 1 : 0;
