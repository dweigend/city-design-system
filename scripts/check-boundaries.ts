// Run both gates even if one fails.
let failed = false;
for (const name of ['check:boundaries:runtime', 'check:boundaries:types']) {
	const result = Bun.spawnSync(['bun', 'run', name], { stdout: 'inherit', stderr: 'inherit' });
	console.log(name, 'exit', result.exitCode);
	if (result.exitCode !== 0) failed = true;
}
process.exitCode = failed ? 1 : 0;
