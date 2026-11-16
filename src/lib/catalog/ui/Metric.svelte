<script lang="ts">
	/** Metric: label, number, context. For shares on a scale: Scale in readout mode. */
	let {
		label,
		value,
		unit,
		trend,
		since
	}: { label: string; value: string; unit: string; trend: 'up' | 'down'; since: string } = $props();
</script>

<div class="metric">
	<div class="label">{label}</div>
	<p class="figure">
		<span class="trend" aria-label={trend === 'up' ? 'rising' : 'falling'}
			>{trend === 'up' ? '↑' : '↓'}</span
		>{value}
	</p>
	<p class="context">{unit} · since {since}</p>
</div>

<style>
	.metric {
		display: flex;
		flex-direction: column;
	}
	.label,
	.context {
		height: var(--ctl-s);
		line-height: var(--ctl-s);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		text-transform: uppercase;
		color: var(--ink-2);
	}
	.figure {
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
		height: var(--space-16);
		font-size: var(--text-xxl);
		font-weight: 300;
		letter-spacing: -0.04em;
		line-height: 1;
	}
	.trend {
		font-size: var(--text-l);
		letter-spacing: 0;
	}
	.context {
		text-transform: none;
	}
</style>
