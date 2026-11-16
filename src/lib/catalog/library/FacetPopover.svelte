<script lang="ts">
	import { Command, Popover } from 'bits-ui';
	import { Check, ChevronDown } from 'lucide-svelte';

	/** One facet as a compact button; the list opens below it, with search and hit count. */
	let {
		label,
		terms,
		selected,
		ontoggle
	}: {
		label: string;
		terms: { term: string; count: number }[];
		selected: string[];
		ontoggle: (term: string) => void;
	} = $props();
</script>

<Popover.Root>
	<Popover.Trigger class="cg-lib-trigger" data-active={selected.length > 0 ? '' : undefined}>
		{label}
		{#if selected.length}<span class="cg-lib-n">{selected.length}</span>{/if}
		<ChevronDown size={14} strokeWidth={1.5} aria-hidden="true" />
	</Popover.Trigger>
	<Popover.Portal>
		<Popover.Content class="cg-lib-pop" align="start" sideOffset={4}>
			<Command.Root label={`Choose ${label}`}>
				<Command.Input class="cg-lib-search" placeholder={`Search ${label}`} />
				<Command.List class="cg-lib-list">
					<Command.Viewport>
						<Command.Empty class="cg-lib-empty">No term matches.</Command.Empty>
						{#each terms as t (t.term)}
							{@const on = selected.includes(t.term)}
							<Command.Item
								value={t.term}
								onSelect={() => ontoggle(t.term)}
								class="cg-lib-item"
								data-on={on ? '' : undefined}
								data-empty={t.count === 0 && !on ? '' : undefined}
							>
								<span class="cg-lib-box" aria-hidden="true">
									{#if on}<Check size={12} strokeWidth={2} />{/if}
								</span>
								<span class="cg-lib-term">{t.term}</span>
								<span class="cg-sr">{on ? ', selected' : ''}</span>
								<span class="cg-lib-count">{t.count}</span>
							</Command.Item>
						{/each}
					</Command.Viewport>
				</Command.List>
			</Command.Root>
		</Popover.Content>
	</Popover.Portal>
</Popover.Root>

<style>
	/* Selection state only for screen readers; the checkmark shows it visibly. */
	.cg-sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	:global(.cg-lib-trigger) {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		height: var(--ctl-m);
		padding: 0 var(--space-3);
		border: var(--hair) solid var(--line);
		background: var(--paper);
		color: var(--ink);
		font: inherit;
		font-size: var(--text-s);
		cursor: pointer;
		transition: border-color var(--fast) var(--ease);
	}
	:global(.cg-lib-trigger:hover),
	:global(.cg-lib-trigger[data-state='open']) {
		border-color: var(--ink);
	}
	:global(.cg-lib-trigger[data-active]) {
		border-color: var(--ink);
	}
	:global(.cg-lib-n) {
		min-width: var(--space-4);
		padding: 0 var(--space-1);
		background: var(--ink);
		color: var(--paper);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		text-align: center;
	}
	:global(.cg-lib-pop) {
		z-index: 50;
		width: min(17rem, calc(100vw - 2 * var(--space-4)));
		border: var(--hair) solid var(--ink);
		background: var(--paper);
		color: var(--ink);
		font-size: var(--text-s);
	}
	:global(.cg-lib-search) {
		width: 100%;
		height: var(--ctl-m);
		padding: 0 var(--space-3);
		border: 0;
		border-bottom: var(--hair) solid var(--line);
		background: none;
		color: inherit;
		font: inherit;
	}
	:global(.cg-lib-search:focus-visible) {
		outline: none;
		border-bottom-color: var(--ink);
	}
	:global(.cg-lib-list) {
		max-height: min(20rem, 50vh);
		overflow-y: auto;
		padding: var(--space-1) 0;
	}
	:global(.cg-lib-empty) {
		padding: var(--space-3);
		color: var(--ink-2);
	}
	:global(.cg-lib-item) {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		height: calc(var(--ctl-s) + var(--space-2));
		padding: 0 var(--space-3);
		cursor: pointer;
	}
	:global(.cg-lib-item[data-selected]) {
		background: var(--paper-2);
	}
	:global(.cg-lib-item[data-empty]) {
		color: var(--ink-2);
	}
	:global(.cg-lib-box) {
		display: grid;
		place-items: center;
		width: 14px;
		height: 14px;
		border: var(--hair) solid currentColor;
	}
	:global(.cg-lib-item[data-on] .cg-lib-box) {
		background: var(--ink);
		border-color: var(--ink);
		color: var(--paper);
	}
	:global(.cg-lib-term) {
		flex: 1;
	}
	:global(.cg-lib-count) {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--ink-2);
	}
</style>
