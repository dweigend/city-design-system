<script lang="ts">
	import { rulePlates } from '../logic/bibel/hausregel';
	import RulePlates from './RulePlates.svelte';
</script>

<RulePlates
	title="One house rule, any grid"
	text="The same building program on three carriers. The rule reads only cells, sides and neighbors; every part takes its measure from each cell."
	plates={rulePlates()}
/>
