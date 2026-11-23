<script lang="ts">
	import { Slider } from '../lib/ui/slider';

	type Parameter = Readonly<{ label: string; min: number; max: number; step: number }>;

	let {
		schema,
		values = $bindable()
	}: {
		schema: Readonly<Record<string, Parameter>>;
		values: Readonly<Record<string, number>>;
	} = $props();
	let draft = $derived({ ...values });

	function commit(key: string, value: number) {
		values = { ...values, [key]: value };
	}
</script>

{#each Object.entries(schema) as [key, { label, min, max, step }] (key)}
	<Slider
		{label}
		{min}
		{max}
		{step}
		bind:value={() => draft[key], (value: number) => (draft = { ...draft, [key]: value })}
		onCommit={(value: number) => commit(key, value)}
	/>
{/each}
