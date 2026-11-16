<script lang="ts">
	import { asset } from '$app/paths';
	import { ExternalLink } from 'lucide-svelte';
	import { archivHerkunftText, lizenzText, type ArchivItem } from '../data/archiv';
	import { facetLabels, facets, type Facet } from './filter';

	/**
	 * Detail of an image: large, with provenance and rights first, then description, classification
	 * and terms. A click on a term filters the grid by it.
	 */
	let {
		item,
		active = [],
		onterm,
		titel
	}: {
		item: ArchivItem;
		active?: string[];
		onterm?: (key: Facet, term: string) => void;
		/** Own title element, e.g. Dialog.Title; otherwise an h2. */
		titel?: import('svelte').Snippet<[string]>;
	} = $props();

	const src = (datei: string) => asset(datei as Parameters<typeof asset>[0]);
	const geschuetzt = $derived(item.herkunft === 'fremd' || item.herkunft === 'ui');
	const begriffe = $derived(
		facets.map((k) => ({ key: k, terms: item.begriffe[k] })).filter((b) => b.terms.length > 0)
	);
</script>

<article class="detail">
	<figure>
		<img src={src(item.datei)} alt={item.titel} />
	</figure>
	<header>
		<span class="nr">{item.nr}</span>
		{#if titel}{@render titel(item.titel)}{:else}<h2>{item.titel}</h2>{/if}
		<!-- Static file, no page navigation: asset() instead of resolve(). -->
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a class="gross" href={src(item.datei)} target="_blank" rel="noopener"
			>Original <ExternalLink size={12} strokeWidth={1.5} aria-hidden="true" /></a
		>
	</header>

	<p class="rechte" class:geschuetzt>
		<strong>{archivHerkunftText(item)}</strong>
		{#if item.quelle}<span class="quelle">{item.quelle}</span>{/if}
		<span>{lizenzText[item.herkunft]}</span>
	</p>

	{#if item.beschreibung}<p class="text">{item.beschreibung}</p>{/if}

	{#if begriffe.length || item.naehe}
		<dl>
			{#if item.naehe}<dt>Proximity</dt>
				<dd>{item.naehe}</dd>{/if}
			{#each begriffe as b (b.key)}
				<dt>{facetLabels[b.key]}</dt>
				<dd>
					{#each b.terms as t (t)}
						{#if onterm}
							<button
								type="button"
								aria-pressed={active.includes(t)}
								onclick={() => onterm(b.key, t)}>{t}</button
							>
						{:else}<span>{t}</span>{/if}
					{/each}
				</dd>
			{/each}
		</dl>
	{/if}

	{#each item.listen as l (l.titel)}
		<section>
			<h3>{l.titel}</h3>
			<ul>
				{#each l.zeilen as z (z)}<li>{z}</li>{/each}
			</ul>
		</section>
	{/each}
</article>

<style>
	.detail {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		font-size: var(--text-s);
		line-height: 1.5;
	}
	figure {
		margin: 0;
		background: var(--paper-2);
	}
	img {
		display: block;
		width: 100%;
		max-height: 52vh;
		object-fit: contain;
	}
	header {
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
	}
	.nr {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--ink-2);
	}
	header :global(h2) {
		flex: 1;
		font-size: var(--text-m);
		font-weight: 600;
		line-height: 1.25;
	}
	.gross {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		flex: none;
		color: var(--ink-2);
		font-size: var(--text-xs);
	}
	.gross:hover {
		color: var(--ink);
	}
	/* Provenance and rights: always visible, protected works with a signal bar. */
	.rechte {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		padding-left: var(--space-3);
		border-left: var(--stroke) solid var(--line);
		color: var(--ink-2);
	}
	.rechte.geschuetzt {
		border-left-color: var(--signal);
	}
	.rechte strong {
		color: var(--ink);
		font-weight: 600;
	}
	.quelle {
		color: var(--ink);
	}
	.text {
		max-width: 62ch;
	}
	dl {
		display: grid;
		grid-template-columns: var(--space-20) 1fr;
		gap: var(--space-1) var(--space-3);
		margin: 0;
	}
	dt {
		color: var(--ink-2);
	}
	dd {
		display: flex;
		flex-wrap: wrap;
		gap: 0 var(--space-2);
		margin: 0;
	}
	dd button {
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-decoration: underline;
		text-decoration-color: var(--line);
		text-underline-offset: 3px;
		cursor: pointer;
	}
	dd button:hover {
		text-decoration-color: var(--ink);
	}
	dd button[aria-pressed='true'] {
		font-weight: 600;
		text-decoration-color: var(--ink);
	}
	@media (pointer: coarse) {
		dd button {
			min-height: var(--space-6);
		}
	}
	section {
		padding-top: var(--space-3);
		border-top: var(--hair) solid var(--line);
	}
	h3 {
		margin-bottom: var(--space-1);
		font-size: var(--text-s);
		font-weight: 600;
	}
	ul {
		margin: 0;
		padding-left: var(--space-4);
		color: var(--ink-2);
	}
</style>
