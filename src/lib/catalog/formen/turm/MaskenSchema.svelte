<script lang="ts">
	import { Toggle } from 'bits-ui';
	import { eckeGesetzt, eckeUmschalten } from '../../logic/formen';

	/**
	 * The eight corners of a slot as a plan: bottom on the left, top on the right, four corners each in the quad.
	 * Keyboard route to the click in the image (DS-63). Order of the corners as in the slot (counterclockwise).
	 */
	let { value = $bindable(0), onwechsel }: { value?: number; onwechsel?: () => void } = $props();
	// Plan from above: corner 0 bottom left, 1 bottom right, 2 top right, 3 top left.
	const lage = ['lu', 'ru', 'ro', 'lo'];
	const ebenen = [
		{ name: 'Bottom', basis: 0 },
		{ name: 'Top', basis: 4 }
	];
</script>

<div class="schema" role="group" aria-label="Corners of the slot">
	{#each ebenen as e (e.name)}
		<div class="ebene">
			<span class="name">{e.name}</span>
			<div class="viereck">
				{#each lage as l, i (l)}
					<Toggle.Root
						class="cg-ecke {l}"
						pressed={eckeGesetzt(value, e.basis + i)}
						onPressedChange={() => {
							value = eckeUmschalten(value, e.basis + i);
							onwechsel?.();
						}}
						aria-label="Corner {i + 1} {e.name.toLowerCase()}"
					/>
				{/each}
			</div>
		</div>
	{/each}
</div>

<style>
	.schema {
		display: flex;
		gap: var(--space-6);
	}
	.ebene {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		font-size: var(--text-s);
		color: var(--ink-2);
	}
	.viereck {
		position: relative;
		width: 64px;
		height: 64px;
		margin: 16px;
		border: var(--hair) solid var(--ink-3);
	}
	.viereck :global(.cg-ecke) {
		position: absolute;
		width: 32px;
		height: 32px;
		margin: -16px;
		padding: 0;
		border: 0;
		background: none;
		cursor: pointer;
	}
	.viereck :global(.cg-ecke)::after {
		content: '';
		position: absolute;
		inset: 10px;
		border: var(--stroke) solid var(--ink-3);
		border-radius: 50%;
		background: var(--paper);
		transition:
			background var(--fast) var(--ease),
			border-color var(--fast) var(--ease);
	}
	.viereck :global(.cg-ecke[data-state='on'])::after {
		inset: 7px;
		border-color: var(--signal);
		background: var(--signal);
	}
	@media (max-width: 960px) {
		.viereck {
			margin: 22px;
		}
		.viereck :global(.cg-ecke) {
			width: 44px;
			height: 44px;
			margin: -22px;
		}
		.viereck :global(.cg-ecke)::after {
			inset: 16px;
		}
		.viereck :global(.cg-ecke[data-state='on'])::after {
			inset: 13px;
		}
	}
	.viereck :global(.cg-ecke:focus-visible) {
		outline: 2px solid var(--ink);
		outline-offset: -2px;
	}
	.viereck :global(.lu) {
		left: 0;
		top: 100%;
	}
	.viereck :global(.ru) {
		left: 100%;
		top: 100%;
	}
	.viereck :global(.ro) {
		left: 100%;
		top: 0;
	}
	.viereck :global(.lo) {
		left: 0;
		top: 0;
	}
</style>
