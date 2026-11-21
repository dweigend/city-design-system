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
				<strong>Bible study.</strong> Solid marks on this schematic section use the shared
				movement-graph types. The <a href={resolve('/sandbox/abnahme')}>sandbox</a> has footbridges over
				alleys; façade landings with portals exist in the City Game prototype and are planned for the
				sandbox (ST12, #37).
			</p>
			<p>
				<strong>Prototype.</strong> The City Game services prototype validates water and power from supply
				nodes to building fittings. Sandbox integration is planned (ST14, #38), marked dashed above.
			</p>
			<p>
				<strong>Lab.</strong> Geodesic bridge rooms between two faces are studied separately in the
				Lab; see <a href={resolve('/formen#kuppel')}>dome geometry</a>. Walkable access is planned.
			</p>
			<p>
				<strong>Planned.</strong> Ordinary
				<a href={resolve('/wachstum#GROW-2')}>growth retains buildings</a>. Setting a route is a
				deliberate intervention under <a href={resolve('/#CITY-4')}>CITY-4</a>; the passage
				threshold marks where a deliberate cut would open (no cut is shown yet).
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
