/** Runs the checks that must pass before delivery can capture or publish a package. */
export function runFastDeliveryChecks(run: (command: string[]) => void) {
	for (const check of ['lint', 'check', 'check:boundaries', 'check:config', 'check:skills'])
		run(['bun', 'run', check]);
}
