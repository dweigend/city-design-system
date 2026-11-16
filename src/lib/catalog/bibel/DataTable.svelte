<script lang="ts" generics="R extends Record<string, string>">
	/**
	 * Plain table. Below 720 px each row becomes a block with column names, so nothing scrolls sideways.
	 * `mono`: columns in mono (numbers, formulas). The first column is the row header.
	 */
	let {
		columns,
		rows,
		label,
		mono = []
	}: {
		columns: { key: keyof R & string; label: string }[];
		rows: R[];
		label: string;
		mono?: string[];
	} = $props();
</script>

<table aria-label={label}>
	<thead>
		<tr
			>{#each columns as c (c.key)}<th scope="col">{c.label}</th>{/each}</tr
		>
	</thead>
	<tbody>
		{#each rows as r, i (i)}
			<tr>
				{#each columns as c, j (c.key)}
					{#if j === 0}<th scope="row">{r[c.key]}</th>{:else}<td
							data-label={c.label}
							class:mono={mono.includes(c.key)}>{r[c.key]}</td
						>{/if}
				{/each}
			</tr>
		{/each}
	</tbody>
</table>

<style>
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-s);
	}
	thead th {
		text-align: left;
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		font-weight: 400;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--ink-2);
		padding: 0 var(--space-3) var(--space-2) 0;
		border-bottom: var(--hair) solid var(--ink);
	}
	tbody th {
		text-align: left;
		font-weight: 600;
	}
	tbody th,
	td {
		vertical-align: top;
		padding: var(--space-3) var(--space-3) var(--space-3) 0;
		border-bottom: var(--hair) solid var(--line);
	}
	.mono {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		white-space: nowrap;
	}
	@media (max-width: 720px) {
		thead {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip-path: inset(50%);
		}
		tr {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: var(--space-2) var(--space-4);
			padding: var(--space-3) 0;
			border-bottom: var(--hair) solid var(--line);
		}
		tbody th {
			grid-column: 1 / -1;
			padding: 0;
			border: 0;
		}
		td {
			padding: 0;
			border: 0;
			white-space: normal;
		}
		td::before {
			content: attr(data-label);
			display: block;
			font-family: var(--font-mono);
			font-size: var(--text-xs);
			text-transform: uppercase;
			letter-spacing: 0.04em;
			color: var(--ink-3);
		}
	}
</style>
