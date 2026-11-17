// Private skills must never be tracked (GW-23). Passes only if Git succeeds and lists nothing.
const { exitCode, stdout, stderr } = Bun.spawnSync([
	'git',
	'ls-files',
	'.agents/skills',
	'.claude/skills'
]);
const tracked = stdout.toString().trim();
if (exitCode !== 0) console.error(`git ls-files failed (exit ${exitCode}):\n${stderr.toString()}`);
if (tracked) console.error(`Tracked private skills:\n${tracked}`);
process.exitCode = exitCode !== 0 || tracked ? 1 : 0;
