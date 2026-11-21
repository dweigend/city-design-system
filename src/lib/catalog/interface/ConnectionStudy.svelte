<script lang="ts">
	import { resolve } from '$app/paths';
	import Abschnitt from '../bibel/Abschnitt.svelte';
	import { connectionViews } from '../logic/connection-study';
	import ConnectionFrame from './ConnectionFrame.svelte';
	import EnginePath from './EnginePath.svelte';
</script>

<Abschnitt id="connections" titel="Four ways into one building">
	<div class="study">
		<div class="comparison">
			<div class="strip">
				{#each connectionViews as connection (connection.id)}
					<ConnectionFrame {connection} />
				{/each}
			</div>
			<p>
				One fixed, schematic section. Solid marks show movement connections available in the
				<a href={resolve('/sandbox/abnahme')}>sandbox</a>. Dashed marks show planned service
				fittings. Cutting a new passage while laying a path is also planned.
			</p>
		</div>
		<EnginePath />
	</div>
</Abschnitt>

<style>
	.study,
	.strip {
		display: grid;
	}
	.study {
		grid-template-columns: minmax(0, 1fr) minmax(210px, 0.29fr);
		gap: var(--space-6);
		align-items: start;
	}
	.strip {
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: var(--space-2);
	}
	p {
		margin-block: var(--space-3) 0;
		max-width: 67ch;
		color: var(--ink-2);
		font-size: var(--text-s);
		line-height: 1.5;
	}
	a {
		color: var(--ink);
		text-underline-offset: 0.18em;
	}
	a:hover {
		text-decoration-thickness: var(--stroke);
	}
	@media (max-width: 1050px) {
		.study {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	@media (max-width: 720px) {
		.strip {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: var(--space-4);
		}
	}
	@media (max-width: 550px) {
		.strip {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
