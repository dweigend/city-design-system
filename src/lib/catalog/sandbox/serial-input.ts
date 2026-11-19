type Input = { run: () => void; control: boolean };

/** Replays raw input in order between commits. Controls wait for a held gesture to finish. */
export function createSerialInput() {
	const queued: Input[] = [];
	let held = false;
	let pending = false;
	let draining = false;

	function drain() {
		if (draining) return;
		draining = true;
		try {
			while (!pending && queued.length) {
				const index = held ? queued.findIndex((input) => !input.control) : 0;
				if (index < 0) break;
				queued.splice(index, 1)[0].run();
			}
		} finally {
			draining = false;
		}
	}

	function enqueue(run: () => void, control: boolean) {
		queued.push({ run, control });
		drain();
	}

	return {
		/** Receives a pointer or camera event before it picks a target or changes the view. */
		pointer: (run: () => void) => enqueue(run, false),
		/** Receives an action that may change the world or the active tool. */
		control: (run: () => void) => enqueue(run, true),
		/** Opens a gesture on the current displayed world. */
		hold() {
			held = true;
		},
		/** Locks the buffer until the released stroke has finished. */
		pause() {
			held = false;
			pending = true;
		},
		/** Releases controls after an empty or cancelled gesture. */
		cancel() {
			held = false;
			drain();
		},
		/** Finishes the only pending commit before any buffered input resumes. */
		finish(commit: () => void) {
			try {
				commit();
			} finally {
				pending = false;
				drain();
			}
		},
		/** Removes input belonging to a disposed canvas. */
		clear() {
			queued.length = 0;
			held = pending = false;
		}
	};
}
