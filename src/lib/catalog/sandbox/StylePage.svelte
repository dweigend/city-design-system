<script lang="ts">
	import { stylePlates } from '../logic/bibel/hausregel';
	import RulePlates from './RulePlates.svelte';
</script>

<RulePlates
	title="Style study"
	text="One massing, several looks. Same cells, same program, same seed; only the style of the house rule changes."
	plates={stylePlates()}
/>
