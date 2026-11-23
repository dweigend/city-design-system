<script lang="ts">
	let {
		label,
		values,
		unit
	}: {
		label: string;
		values: readonly [string, string, string];
		unit: string;
	} = $props();
</script>

<figure class="scale-legend" aria-label={label}>
	<div class="scale-ramp" aria-hidden="true"></div>
	<figcaption class="scale-ticks small">
		{#each values as value, index (index)}
			<span>{value}&nbsp;{unit}</span>
		{/each}
	</figcaption>
</figure>
