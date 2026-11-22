<script lang="ts">
	import { Collapsible, Popover } from 'bits-ui';
	import { ChevronDown } from 'lucide-svelte';
	import type { ChapterStep } from '../data/chapters';
	import { designPrinciples } from '../data/design-principles';

	let { step, reroll, disabled }: { step: ChapterStep; reroll: () => void; disabled: boolean } =
		$props();
	const byId = new Map(designPrinciples.map((principle) => [principle.id, principle]));
</script>

<div class="card">
	<h2>{step.title}</h2>
	<p class="caption">{step.caption}</p>
	<div class="step-control">
		{#if step.control.kind === 'seed'}
			<button type="button" onclick={reroll} {disabled}>Reroll seed</button>
		{/if}
		<p>{step.control.hint}</p>
	</div>
	{#if step.principles.length}
		<div class="principles">
			{#each step.principles as id (id)}
				{@const principle = byId.get(id)}
				{#if principle}
					<Popover.Root>
						<Popover.Trigger>{principle.id} · {principle.title}</Popover.Trigger>
						<Popover.Portal>
							<Popover.Content
								class="chapter-principle"
								role="dialog"
								aria-label={principle.title}
								sideOffset={6}
								collisionPadding={12}
								trapFocus={false}
							>
								<p>{principle.rule}</p>
								<p>{principle.reason}</p>
							</Popover.Content>
						</Popover.Portal>
					</Popover.Root>
				{/if}
			{/each}
		</div>
	{/if}
	<Collapsible.Root class="details">
		<Collapsible.Trigger>
			{step.details.label}
			<ChevronDown size={16} aria-hidden="true" />
		</Collapsible.Trigger>
		<Collapsible.Content>
			<p>{step.details.text}</p>
		</Collapsible.Content>
	</Collapsible.Root>
</div>

<style>
	.card {
		display: grid;
		gap: var(--space-4);
		padding: var(--space-5) var(--space-4);
	}
	h2 {
		font-size: var(--text-l);
		font-weight: 650;
		line-height: 1.2;
		text-wrap: balance;
	}
	.caption {
		max-width: 34ch;
		text-wrap: pretty;
	}
	.step-control {
		display: grid;
		justify-items: start;
		gap: var(--space-1);
		color: var(--ink-2);
		font-size: var(--text-s);
	}
	.principles {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
	}
	:global(.chapter-principle) {
		z-index: 2;
		display: grid;
		gap: var(--space-2);
		box-sizing: border-box;
		width: min(320px, calc(100vw - 24px));
		max-height: var(--bits-popover-content-available-height);
		overflow: auto;
		padding: var(--space-3);
		border: var(--hair) solid var(--line);
		background: var(--paper);
		color: var(--ink);
		font-size: var(--text-s);
	}
	.card :global(.details) {
		border-top: var(--hair) solid var(--line);
		font-size: var(--text-s);
	}
	.card :global(.details button) {
		justify-content: space-between;
		width: 100%;
		padding-inline: 0;
		border: 0;
		text-align: start;
	}
	.card :global(.details button[data-state='open'] svg) {
		transform: rotate(180deg);
	}
	.card :global(.details p) {
		color: var(--ink-2);
	}
	@media (max-width: 760px) {
		.card {
			padding: var(--space-4) var(--space-3);
		}
	}
</style>
