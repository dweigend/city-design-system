<script lang="ts">
	/**
	 * Design matrix (pattern V-Matrix): task × method.
	 * Full square = main tool, empty square = assists. Each row says why,
	 * and what the method is not suited for. Column headers link to the section of the method:
	 * `anker` is an anchor on the same page (#…) or a path into another chapter.
	 * Below 720 px each row becomes a block with “Main tool … Assists …”.
	 */
	import { resolve } from '$app/paths';
	type Verfahren = { id: string; titel: string; anker: string };
	/** Anchors stay anchors; chapter paths go through resolve, the anchor is appended. */
	const ziel = (anker: string) => {
		if (anker.startsWith('#')) return anker;
		const [pfad, hash] = anker.split('#');
		return resolve(pfad as '/') + (hash ? `#${hash}` : '');
	};
	type Zeile = { aufgabe: string; haupt: string; mit: string[]; warum: string; nicht: string };
	let { verfahren, aufgaben, label }: { verfahren: Verfahren[]; aufgaben: Zeile[]; label: string } =
		$props();

	const name = (id: string) => verfahren.find((v) => v.id === id)?.titel ?? id;
	const anker = (id: string) => verfahren.find((v) => v.id === id)?.anker ?? '#';
	const rolle = (z: Zeile, id: string) =>
		z.haupt === id ? 'haupt' : z.mit.includes(id) ? 'mit' : 'leer';
	const rollenName = { haupt: 'Main tool', mit: 'assists', leer: '' } as const;
</script>

<figure>
	<table aria-label={label} style:--n={verfahren.length}>
		<thead>
			<tr>
				<th scope="col" class="aufgabe">Task</th>
				{#each verfahren as v (v.id)}
					<th scope="col" class="verfahren">
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- ziel() uses resolve() or an anchor. -->
						<a href={ziel(v.anker)}>{v.titel}</a>
					</th>
				{/each}
				<th scope="col" class="warum">Why – and what not for</th>
			</tr>
		</thead>
		<tbody>
			{#each aufgaben as z (z.aufgabe)}
				<tr>
					<th scope="row" class="aufgabe">{z.aufgabe}</th>
					{#each verfahren as v (v.id)}
						{@const r = rolle(z, v.id)}
						<td class="mark" data-rolle={r}>
							{#if r !== 'leer'}<span
									class="quadrat"
									role="img"
									aria-label="{v.titel}: {rollenName[r]}"
								></span>{/if}
						</td>
					{/each}
					<td class="warum">
						<p class="nimm">
							<!-- eslint-disable svelte/no-navigation-without-resolve -- ziel() uses resolve() or an anchor. -->
							Main tool:
							<a href={ziel(anker(z.haupt))}>{name(z.haupt)}</a>.{#if z.mit.length}<br />Assists: {#each z.mit as m, i (m)}{i
										? ', '
										: ''}<a href={ziel(anker(m))}>{name(m)}</a>{/each}.{/if}
							<!-- eslint-enable svelte/no-navigation-without-resolve -->
						</p>
						<p>{z.warum}</p>
						<p class="nicht">{z.nicht}</p>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
	<figcaption>
		<span><span class="quadrat" data-rolle="haupt" aria-hidden="true"></span>Main tool</span>
		<span><span class="quadrat" data-rolle="mit" aria-hidden="true"></span>assists</span>
	</figcaption>
</figure>

<style>
	figure {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	table {
		width: 100%;
		border-collapse: collapse;
		table-layout: fixed;
		font-size: var(--text-s);
	}
	th.aufgabe {
		width: 22%;
	}
	th.warum {
		width: 34%;
	}
	thead th {
		text-align: left;
		vertical-align: bottom;
		padding: 0 var(--space-2) var(--space-3) 0;
		border-bottom: var(--hair) solid var(--ink);
		font-weight: 400;
		color: var(--ink-2);
	}
	thead th.verfahren {
		text-align: center;
		padding: 0 var(--space-1) var(--space-3);
		font-size: var(--text-xs);
		line-height: 1.25;
		hyphens: auto;
	}
	thead a {
		color: var(--ink);
		text-decoration: none;
	}
	thead a:hover,
	thead a:focus-visible {
		text-decoration: underline;
	}
	tbody th,
	tbody td {
		vertical-align: top;
		padding: var(--space-3) var(--space-2) var(--space-3) 0;
		border-bottom: var(--hair) solid var(--line);
	}
	tbody th {
		text-align: left;
		font-weight: 600;
	}
	td.mark {
		text-align: center;
		padding-right: 0;
	}
	tbody tr:hover td.mark,
	tbody tr:hover th {
		background: var(--paper-2);
	}
	.quadrat {
		display: inline-block;
		width: var(--space-4);
		height: var(--space-4);
		vertical-align: middle;
		border: 1.5px solid var(--ink);
	}
	[data-rolle='haupt'] .quadrat,
	.quadrat[data-rolle='haupt'] {
		background: var(--ink);
	}
	th.warum,
	td.warum {
		padding-left: var(--space-4);
	}
	td.warum p {
		max-width: 52ch;
	}
	.nimm {
		display: none;
	}
	.nicht {
		margin-top: var(--space-1);
		color: var(--ink-2);
	}
	figcaption {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-6);
		font-size: var(--text-s);
		color: var(--ink-2);
	}
	figcaption > span {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}

	/* Mobile: row = block. The columns become the sentence “Take … add …”. */
	@media (max-width: 720px) {
		thead,
		td.mark {
			display: none;
		}
		tr {
			display: flex;
			flex-direction: column;
			gap: var(--space-1);
			padding: var(--space-3) 0;
			border-bottom: var(--hair) solid var(--line);
		}
		tbody th,
		tbody td {
			padding: 0;
			border: 0;
		}
		th.aufgabe {
			width: auto;
		}
		td.warum {
			padding-left: 0;
		}
		.nimm {
			display: block;
		}
		figcaption {
			display: none;
		}
	}
</style>
