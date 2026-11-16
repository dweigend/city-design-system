<script lang="ts">
	import type { Glyph } from '../data/prinzipien';
	/** Pictogram per principle: hairline, one signal dot. Purely decorative, the text stands beside it. */
	let { glyph }: { glyph: Glyph } = $props();
	const nodes = [
		[14, 18],
		[44, 14],
		[40, 50],
		[12, 54]
	];
	const moved = [
		[78, 24],
		[110, 10],
		[104, 58],
		[84, 50]
	];
	const edges = [
		[0, 1],
		[1, 2],
		[2, 3],
		[3, 0],
		[0, 2]
	];
	const ticks = Array.from({ length: 5 }, (_, i) =>
		Array.from({ length: 3 }, (_, j) => ({
			x: 14 + i * 23,
			y: 16 + j * 20,
			a: -30 + i * 14 + j * 6
		}))
	).flat();
</script>

<svg viewBox="0 0 124 72" aria-hidden="true">
	{#if glyph === 'graph'}
		{#each edges as [a, b] (`${a}${b}`)}
			<line x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]} />
			<line class="soft" x1={moved[a][0]} y1={moved[a][1]} x2={moved[b][0]} y2={moved[b][1]} />
		{/each}
		{#each nodes as [x, y], i (i)}<circle cx={x} cy={y} r="3" class:dot={i === 0} />{/each}
		{#each moved as [x, y], i (i)}<circle cx={x} cy={y} r="3" class:dot={i === 0} />{/each}
		<text x="62" y="38">→</text>
	{:else if glyph === 'dual'}
		<path d="M20 8H104M20 36H104M20 64H104M20 8V64M62 8V64M104 8V64" />
		<path class="dash" d="M41 22H83V50H41Z" />
		<circle cx="62" cy="36" r="3" class="dot" />
	{:else if glyph === 'lokal'}
		<rect class="dash" x="6" y="4" width="112" height="64" />
		{#each [0, 1, 2] as i (i)}{#each [0, 1, 2] as j (j)}<rect
					x={36 + i * 18}
					y={10 + j * 18}
					width="16"
					height="16"
					class:fill={i === 1 && j === 1}
				/>{/each}{/each}
	{:else if glyph === 'feld'}
		{#each ticks as t, i (i)}<line
				x1={t.x - 7}
				y1={t.y}
				x2={t.x + 7}
				y2={t.y}
				transform="rotate({t.a} {t.x} {t.y})"
			/>{/each}
		<circle cx="14" cy="36" r="3" class="dot" />
	{:else if glyph === 'baum'}
		<path d="M8 8H116V64H8Z M62 8V64 M62 36H116 M89 36V64" />
		<rect x="89" y="36" width="27" height="28" class="fill" />
	{:else if glyph === 'familie'}
		<path d="M10 64V30L28 14L46 30V64Z" />
		<path class="soft" d="M10 64H46" />
		<path d="M72 64L80 32L98 18L114 34L116 64Z" />
		<circle cx="28" cy="46" r="4" class="dot" />
		<circle cx="97" cy="46" r="4" class="dot" />
	{:else if glyph === 'gueltig'}
		<path d="M10 60L22 12L54 18L50 62Z" />
		<path d="M72 12L114 60L114 12L72 60Z" />
		<path class="sig" d="M86 30L100 42M100 30L86 42" />
	{:else if glyph === 'abhaengig'}
		{#each [0, 1, 2, 3, 4, 5] as i (i)}<rect
				x={6 + i * 19.5}
				y="24"
				width="16"
				height="24"
				class:fill={i === 2}
				class:dash={i === 1 || i === 3}
			/>{/each}
	{:else if glyph === 'netz'}
		<path d="M10 54L38 30L70 42L104 18M38 30L44 8M70 42L92 62" />
		<path class="dash" d="M20 14L110 58" />
		{#each [[10, 54], [38, 30], [70, 42], [104, 18], [44, 8], [92, 62]] as [x, y], i (i)}<circle
				cx={x}
				cy={y}
				r="3"
				class:dot={i === 0}
			/>{/each}
	{:else if glyph === 'schichten'}
		{#each [0, 1, 2, 3] as i (i)}<path
				class:dash={i === 3}
				d="M{20} {56 - i * 14}L{44} {46 - i * 14}H{104}L{80} {56 - i * 14}Z"
			/>{/each}
		<circle cx="62" cy="51" r="3" class="dot" />
	{:else if glyph === 'meter'}
		<path d="M14 26V62M110 26V62M14 26H110" />
		<path class="soft" d="M14 40H110" />
		{#each Array.from({ length: 14 }, (_, i) => i) as i (i)}<line
				x1={14 + i * 7.4}
				y1="40"
				x2={14 + i * 7.4}
				y2={i % 5 === 0 ? 34 : 37}
			/>{/each}
		<text x="62" y="58">13 m</text>
	{:else if glyph === 'entartung'}
		<path d="M10 60L30 12H58L54 60Z" />
		<path class="fill" d="M70 60L92 16L112 60Z" />
		<circle cx="92" cy="46" r="3" class="dot" />
	{/if}
</svg>

<style>
	svg {
		width: 100%;
		height: auto;
		aspect-ratio: 124 / 72;
		overflow: visible;
	}
	path,
	line,
	rect,
	circle {
		fill: none;
		stroke: var(--ink);
		stroke-width: 1;
		vector-effect: non-scaling-stroke;
	}
	.soft {
		stroke: var(--ink-3);
	}
	.dash {
		stroke-dasharray: 3 3;
		stroke: var(--ink-2);
	}
	.fill {
		fill: var(--paper-3);
	}
	circle {
		fill: var(--paper);
	}
	.dot {
		fill: var(--signal);
		stroke: var(--signal);
	}
	.sig {
		stroke: var(--signal);
		stroke-width: 2;
	}
	text {
		font-family: var(--font-mono);
		font-size: 10px;
		fill: var(--ink-2);
		text-anchor: middle;
	}
</style>
