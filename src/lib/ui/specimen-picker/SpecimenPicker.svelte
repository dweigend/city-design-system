<script lang="ts">
	import { RadioGroup } from 'bits-ui';

	/** A small drawing: polygons in a view box, each filled with a colour token and a shade. */
	type Sketch = {
		viewBox: string;
		faces: readonly { points: string; tone: `--${string}`; shade: 'top' | 'lit' | 'shadow' }[];
	};

	interface Props {
		/** Name the choice, for example "House style". */
		label: string;
		/** Choices in order, each drawn as its own specimen. */
		items: readonly { value: string; label: string; sketch: Sketch }[];
		/** Bind the chosen value, for example bind:value={style}. */
		value: string;
	}

	let { label, items, value = $bindable() }: Props = $props();
</script>

<RadioGroup.Root class="control-specimens" aria-label={label} bind:value>
	{#each items as item (item.value)}
		<RadioGroup.Item class="control control-specimen" value={item.value} title={item.label}>
			<svg viewBox={item.sketch.viewBox} aria-hidden="true">
				{#each item.sketch.faces as face, index (index)}
					<polygon points={face.points} fill="var({face.tone})" />
					<polygon class="control-specimen-shade" points={face.points} data-shade={face.shade} />
				{/each}
			</svg>
			<span class="control-specimen-label label">{item.label}</span>
		</RadioGroup.Item>
	{/each}
</RadioGroup.Root>
