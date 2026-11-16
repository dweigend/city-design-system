<script lang="ts">
	import { asset } from '$app/paths';
	import type { ArchivItem } from '../data/archiv';

	/**
	 * Grid of all images. A click selects an image; the detail stands beside it (desktop) or
	 * opens above it (mobile). Protected external works carry a © before the number.
	 */
	let {
		items,
		selected,
		onselect
	}: { items: ArchivItem[]; selected?: string; onselect: (key: string) => void } = $props();
	const src = (datei: string) => asset(datei as Parameters<typeof asset>[0]);
</script>

<ol class="raster">
	{#each items as a (a.key)}
		{@const fremd = a.herkunft === 'fremd' || a.herkunft === 'ui'}
		<li>
			<button
				type="button"
				aria-pressed={a.key === selected}
				onclick={() => onselect(a.key)}
				data-key={a.key}
			>
				<img src={src(a.datei)} alt="" loading="lazy" />
				<span class="meta">
					<span class="nr"
						>{#if fremd}<span aria-hidden="true">© </span><span class="sr"
								>Protected external work,
							</span>{/if}{a.nr}</span
					>
					<span class="titel">{a.titel}</span>
				</span>
			</button>
		</li>
	{:else}
		<li class="leer">No image matches all filters. Remove a term.</li>
	{/each}
</ol>

<style>
	.raster {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: var(--space-6) var(--space-4);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		min-width: 0;
	}
	button {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		width: 100%;
		padding: 0;
		border: 0;
		background: none;
		color: var(--ink-2);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	img {
		display: block;
		width: 100%;
		aspect-ratio: 4 / 3;
		object-fit: contain;
		background: var(--paper-2);
		outline: var(--stroke) solid transparent;
		outline-offset: var(--space-1);
		transition:
			opacity var(--fast) var(--ease),
			outline-color var(--fast) var(--ease);
	}
	button:hover img {
		opacity: 0.85;
	}
	button[aria-pressed='true'] {
		color: var(--ink);
	}
	button[aria-pressed='true'] img {
		outline-color: var(--ink);
	}
	button:focus-visible {
		outline: none;
	}
	button:focus-visible img {
		outline-color: var(--blueprint);
	}
	.meta {
		display: flex;
		gap: var(--space-2);
		align-items: baseline;
		min-width: 0;
		font-size: var(--text-xs);
	}
	.nr {
		flex: none;
		font-family: var(--font-mono);
		color: var(--ink-2);
	}
	button[aria-pressed='true'] .nr {
		color: var(--ink);
	}
	.titel {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	.leer {
		grid-column: 1 / -1;
		padding: var(--space-10) 0;
		color: var(--ink-2);
	}
	@media (max-width: 640px) {
		.raster {
			grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
			gap: var(--space-4) var(--space-3);
		}
	}
</style>
