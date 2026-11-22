<script lang="ts">
	import type { DocInput } from './contract-docs';

	let { inputs }: { inputs: readonly DocInput[] } = $props();
</script>

{#if inputs.length}
	<table aria-labelledby="inputs">
		<thead>
			<tr>
				<th scope="col">Name</th>
				<th scope="col">Type</th>
				<th scope="col">Unit</th>
				<th scope="col">Range</th>
				<th scope="col">Default</th>
			</tr>
		</thead>
		<tbody>
			{#each inputs as input (input.name)}
				<tr>
					<th scope="row">
						<code translate="no">{input.name}</code>
						{#if input.shared}<span>Shared</span>{/if}
					</th>
					<td><code translate="no">{input.type}</code></td>
					<td>{input.unit}</td>
					<td>{input.range}</td>
					<td>{input.defaultValue}</td>
				</tr>
			{/each}
		</tbody>
	</table>
{:else}
	<p>No inputs.</p>
{/if}

<style>
	table {
		width: 100%;
		overflow-wrap: anywhere;
		border-collapse: collapse;
		font-variant-numeric: tabular-nums;
		font-size: var(--text-s);
		text-align: start;
	}
	@media (max-width: 540px) {
		table {
			table-layout: fixed;
		}
		thead th:nth-child(3) {
			width: 12%;
		}
		thead th:nth-child(4) {
			width: 25%;
		}
	}
	thead {
		background: var(--paper-2);
	}
	th,
	td {
		padding: var(--space-2);
		border-block-end: var(--hair) solid var(--line);
		vertical-align: top;
		text-align: start;
	}
	tbody th {
		font-weight: 500;
	}
	span {
		display: block;
		color: var(--ink-2);
		font-size: var(--text-xs);
	}
	code {
		font-family: var(--font-mono);
		overflow-wrap: anywhere;
	}
</style>
