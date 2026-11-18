<script lang="ts">
	import { resolve } from '$app/paths';
	import { stylePlates } from '../logic/bibel/hausregel';
	import RulePlates from './RulePlates.svelte';
</script>

<RulePlates
	title="Style study"
	text="One massing, several looks. Same cells, same program, same seed; only the style of the house rule changes."
	plates={stylePlates()}
/>

<nav aria-label="Sandbox plates">
	<a href={resolve('/sandbox/abnahme')}>Acceptance scene</a>
</nav>

<style>
	nav {
		max-width: 1440px;
		margin: 0 auto;
		padding: 0 var(--space-12) var(--space-8);
		font-size: var(--text-s);
	}
</style>
