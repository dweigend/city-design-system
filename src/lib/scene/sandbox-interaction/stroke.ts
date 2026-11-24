/** One pointer input already resolved to the hosts it crossed since the previous input. */
export type StrokeInput<P> = Readonly<{
	type: 'down' | 'move' | 'up' | 'cancel' | 'lost';
	pointer: number;
	/** Hosts under the pointer path since the last input, in path order; the last one is hovered. */
	hits: readonly P[];
	/** The tool active when the input happened. */
	tool: string;
}>;

/** What the caller does after an input: show a hover, open the stroke, add newly entered hosts,
 * keep the stroke, or revert it. */
export type StrokeEffect<P> =
	| Readonly<{ kind: 'hover'; host: P | undefined }>
	| Readonly<{ kind: 'begin'; tool: string }>
	| Readonly<{ kind: 'enter'; hosts: readonly P[]; tool: string }>
	| Readonly<{ kind: 'release'; hosts: readonly P[]; tool: string }>
	| Readonly<{ kind: 'cancel'; hosts: readonly P[]; tool: string }>;

/** Creates the preview state machine of one painting pointer. Idle, it reports hovers. A `down`
 * opens a stroke for that pointer; each host enters once, in path order, and is reported at once.
 * `up` releases and keeps the stroke. `lost` capture also keeps it, so painted work survives a
 * focus change; `cancel` (the system took the pointer) reverts it. Other pointers are ignored
 * while a stroke is open. */
export function createStrokeState<P extends Readonly<{ id: string }>>() {
	let open: { pointer: number; tool: string; hosts: Map<string, P> } | undefined;

	function enter(hits: readonly P[]) {
		if (!open) return [];
		const fresh: P[] = [];
		for (const host of hits) {
			if (open.hosts.has(host.id)) continue;
			open.hosts.set(host.id, host);
			fresh.push(host);
		}
		return fresh;
	}

	function close(kind: 'release' | 'cancel'): StrokeEffect<P> {
		const { hosts, tool } = open ?? { hosts: new Map<string, P>(), tool: '' };
		open = undefined;
		return { kind, hosts: [...hosts.values()], tool };
	}

	function read({ type, pointer, hits, tool }: StrokeInput<P>): StrokeEffect<P>[] {
		if (open && open.pointer !== pointer) return [];
		const hover: StrokeEffect<P> = { kind: 'hover', host: hits.at(-1) };
		if (type === 'cancel') return open ? [close('cancel')] : [];
		if (type === 'lost') return open ? [close('release')] : [];
		const effects: StrokeEffect<P>[] = [hover];
		if (type === 'down' && !open) {
			open = { pointer, tool, hosts: new Map() };
			effects.push({ kind: 'begin', tool });
		}
		if (!open) return effects;
		const fresh = enter(hits);
		if (fresh.length) effects.push({ kind: 'enter', hosts: fresh, tool: open.tool });
		if (type === 'up') effects.push(close('release'));
		return effects;
	}

	return Object.freeze({
		read,
		/** True while a stroke is open. */
		isOpen: () => Boolean(open),
		/** Ends an open stroke without effects, for example when a document is replaced. */
		reset() {
			open = undefined;
		}
	});
}

/** Stages ordered edits and visible overrides without touching the committed document or build
 * queue. An undefined override hides an existing body. Only release publishes the draft. */
export function createStrokeDraft<Edit, Body>() {
	let edits: Edit[] = [];
	const overrides = new Map<string, Body | undefined>();
	return {
		overrides: overrides as ReadonlyMap<string, Body | undefined>,
		add(edit: Edit, override?: Readonly<{ id: string; body?: Body }>) {
			edits.push(edit);
			if (override) overrides.set(override.id, override.body);
		},
		finish(
			kind: 'release' | 'cancel',
			publish: (edits: readonly Edit[], overrides: ReadonlyMap<string, Body | undefined>) => void
		) {
			try {
				if (kind === 'release' && edits.length) publish(edits, overrides);
			} finally {
				edits = [];
				overrides.clear();
			}
		}
	};
}
