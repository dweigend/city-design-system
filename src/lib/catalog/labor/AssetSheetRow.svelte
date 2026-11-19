<script lang="ts">
	import type { SheetRow } from '../logic/material/contact-sheet';

	let {
		a,
		photos,
		busy
	}: {
		a: SheetRow;
		photos: Record<string, string | null>;
		busy: boolean;
	} = $props();
</script>

<section aria-busy={busy}>
	<div class="label">
		<h3>{a.label}</h3>
		{#if a.dimensions}<small>{a.dimensions}</small>{/if}
	</div>
	<div class="variants">
		{#each a.samples as sample (sample.id)}
			{@const photo = photos[a.id + '/' + sample.id]}
			<figure>
				{#if photo}<img
						width="440"
						height="300"
						src={photo}
						alt={a.label + ' — ' + sample.label}
					/>{:else if photo === null}<p>Preview unavailable</p>
				{:else}<div class="pending"></div>{/if}
				<figcaption>{sample.label}</figcaption>
			</figure>{/each}
	</div>
</section>

<style>
	h3,
	figure {
		margin: 0;
	}
	h3 {
		font: 600 1rem var(--font-sans);
	}
	.label {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
	}
	h3,
	figcaption {
		text-transform: capitalize;
	}
	section {
		display: grid;
		grid-template-columns: minmax(8rem, 1fr) 5fr;
		gap: 1rem;
		border-top: 1px solid var(--line);
		padding: 1rem 0;
	}
	.label {
		align-content: start;
		flex-direction: column;
		gap: 0.3rem;
	}
	small,
	figcaption {
		font: 400 0.82rem var(--font-mono);
		color: var(--ink-2);
	}
	.variants {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 9rem), 1fr));
		gap: 1rem;
	}
	img,
	.pending {
		width: 100%;
		aspect-ratio: 22/15;
		height: auto;
		display: block;
	}
	@media (max-width: 640px) {
		section {
			grid-template-columns: 1fr;
		}
		.label {
			flex-direction: row;
		}
		.variants {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
