<script lang="ts">
	import { onMount } from 'svelte';
	import { loadEnvelopeKernel } from './envelope-kernel';
	import { roofBlocks } from '../logic/bibel/roof-blocks';
	import { rulePlates } from '../logic/bibel/hausregel';
	import RulePlates from './RulePlates.svelte';
	const carriers = rulePlates();
	let roofs = $state.raw(roofBlocks());
	let message = $state('');
	onMount(() => {
		let active = true;
		void loadEnvelopeKernel()
			.then((roofBuilder) => {
				if (active) roofs = roofBlocks(roofBuilder);
			})
			.catch(() => {
				if (active) message = 'Detailed roofs unavailable.';
			});
		return () => {
			active = false;
		};
	});
</script>

{#if message}<p role="alert">{message}</p>{/if}

<RulePlates
	title="One house rule, any grid"
	text="Historic roofs on four block shapes, followed by the same building program on three carriers. The rule reads only cells, sides and neighbors; every part takes its measure from each cell."
	plates={[...roofs, ...carriers]}
/>
