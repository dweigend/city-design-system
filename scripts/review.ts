// Full-stock reports (never blocking), then the blocking quality gate.
const reports = ['analyze:health', 'analyze:unused', 'analyze:duplication'];
for (const name of reports) {
	const result = Bun.spawnSync(['bun', 'run', name], { stdout: 'inherit', stderr: 'inherit' });
	console.log(name, 'exit', result.exitCode);
}
const gate = Bun.spawnSync(['bun', 'run', 'verify'], { stdout: 'inherit', stderr: 'inherit' });
process.exitCode = gate.exitCode === 0 ? 0 : 1;
