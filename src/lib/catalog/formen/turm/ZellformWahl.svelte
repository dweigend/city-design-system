<script lang="ts">
	import { ToggleGroup } from 'bits-ui';
	import { cellShapes, testCells, type CellShape } from '../../logic/parametrik/formen/zellen';

	/**
	 * Strip of the cell shapes directly above the image: each option shows its outline, not its name.
	 * The name is there for screen readers and as a tooltip.
	 */
	let { value = $bindable<CellShape>('square') }: { value?: CellShape } = $props();

	const R = 9;
	const umriss = (shape: CellShape) => {
		const poly = testCells[shape].polygon;
		const m = Math.max(...poly.flatMap(([x, y]) => [Math.abs(x), Math.abs(y)]));
		// SVG y downward: plan from above, north at the top.
		return poly
			.map(([x, y]) => `${((x / m) * R).toFixed(2)},${((-y / m) * R).toFixed(2)}`)
			.join(' ');
	};
	const namen: Record<CellShape, string> = {
		square: 'Square',
		triangle: 'Triangle',
		hex: 'Hexagon',
		irregular: 'Skewed quad'
	};
</script>

<ToggleGroup.Root
	type="single"
	{value}
	onValueChange={(v) => {
		if (v) value = v as CellShape;
	}}
	class="cg-zellformen"
	aria-label="Cell shape"
>
	{#each cellShapes as shape (shape)}
		<ToggleGroup.Item
			value={shape}
			class="cg-zellform"
			aria-label={namen[shape]}
			title={namen[shape]}
		>
			<svg viewBox="-11 -11 22 22" width="22" height="22" aria-hidden="true">
				<polygon points={umriss(shape)} />
			</svg>
		</ToggleGroup.Item>
	{/each}
</ToggleGroup.Root>

<style>
	:global(.cg-zellformen) {
		display: inline-flex;
		gap: var(--space-1);
	}
	:global(.cg-zellform) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: calc(var(--ctl-m) - var(--space-2));
		height: calc(var(--ctl-m) - var(--space-2));
		padding: 0;
		border: var(--hair) solid transparent;
		background: none;
		color: var(--ink-3);
		cursor: pointer;
		transition:
			color var(--fast) var(--ease),
			border-color var(--fast) var(--ease);
	}
	:global(.cg-zellform:hover) {
		color: var(--ink);
	}
	:global(.cg-zellform[data-state='on']) {
		color: var(--ink);
		border-color: var(--ink);
	}
	:global(.cg-zellform:focus-visible) {
		outline: 2px solid var(--ink);
		outline-offset: 1px;
	}
	polygon {
		fill: none;
		stroke: currentColor;
		stroke-width: 1.5;
		stroke-linejoin: round;
	}
	@media (max-width: 960px) {
		:global(.cg-zellform) {
			width: 44px;
			height: 44px;
		}
	}
</style>
