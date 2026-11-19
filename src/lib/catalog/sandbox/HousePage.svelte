<script lang="ts">
	import RulePlates from './RulePlates.svelte';
	import { composedHousePlates } from '../logic/bibel/composed-houses';
	const plates = composedHousePlates();
</script>

<RulePlates
	title="Composed houses"
	text="Five sections show how painted uses become decks, equipment and routes between neighbours."
	{plates}
	fitView
/>
