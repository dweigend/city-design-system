<script lang="ts">
	import { resolve } from '$app/paths';
	import { plannedDemos } from '../data/engine-path';
</script>

<aside aria-labelledby="engine-path">
	<h3 id="engine-path">One engine path <span>Planned</span></h3>
	<div
		class="diagram"
		role="group"
		aria-label="The library and engine feed the miniature and game. Only the game adds landscape controls."
	>
		<div class="controls">Landscape controls</div>
		<div class="outputs">
			<div>Bible miniature</div>
			<div>Game</div>
		</div>
		<div class="base">Shared library + engine</div>
	</div>
	<ul aria-label="Planned demos">
		{#each plannedDemos as demo (demo.id)}
			<li>
				<a href="https://github.com/dweigend/city-design-system/issues/{demo.issue}">
					<span>{demo.id}</span>
					{demo.label}
				</a>
			</li>
		{/each}
	</ul>
	<a href={resolve('/archiv#library-path')}>Library status</a>
	<a href={resolve('/archiv#LIB-1')}>Shared engine principle LIB-1</a>
</aside>

<style>
	aside {
		min-width: 0;
		display: grid;
		align-content: start;
		gap: var(--space-3);
	}
	h3 {
		display: flex;
		justify-content: space-between;
		gap: var(--space-2);
		font-size: var(--text-m);
		font-weight: 600;
	}
	h3 span,
	li span {
		color: var(--ink-2);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		font-weight: 400;
	}
	.diagram {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--space-3) 0;
		font-size: var(--text-s);
		text-align: center;
	}
	.controls,
	.outputs > div,
	.base {
		position: relative;
		padding: var(--space-2) var(--space-1);
		border: var(--hair) solid var(--line);
	}
	.controls {
		grid-column: 2;
		border-style: dashed;
	}
	.outputs {
		grid-column: 1 / -1;
		display: grid;
		grid-template-columns: subgrid;
	}
	.outputs > div:last-child {
		border-inline-start: 0;
	}
	.controls::after,
	.outputs > div::after {
		content: '';
		position: absolute;
		top: 100%;
		left: 50%;
		height: calc(var(--space-3) + 1px);
		border-inline-start: var(--hair) solid var(--ink-2);
	}
	.base {
		grid-column: 1 / -1;
		border-color: var(--ink-2);
		background: var(--paper-2);
		font-weight: 600;
	}
	ul {
		display: grid;
		gap: var(--space-1);
		list-style: none;
		padding: 0;
		margin: 0;
	}
	a {
		display: inline-block;
		padding-block: 3px;
		color: var(--ink);
		font-size: var(--text-s);
		text-underline-offset: 0.18em;
	}
	a:hover {
		text-decoration-thickness: var(--stroke);
	}
	li span {
		display: inline-block;
		min-width: 3.4em;
	}
</style>
