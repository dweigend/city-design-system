// Quality gate: every step runs even if an earlier one fails; any failure exits 1.
const steps = ['lint', 'check', 'test', 'check:boundaries', 'check:skills', 'build'];
const results: Array<{ name: string; exitCode: number }> = [];
for (const name of steps) {
	const { exitCode } = Bun.spawnSync(['bun', 'run', name], {
		stdout: 'inherit',
		stderr: 'inherit'
	});
	results.push({ name, exitCode });
}
console.log('\nverify summary');
for (const { name, exitCode } of results) console.log(exitCode === 0 ? 'pass' : 'FAIL', name);
process.exitCode = results.some(({ exitCode }) => exitCode !== 0) ? 1 : 0;
