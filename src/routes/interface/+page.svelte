<script lang="ts">
	const palette = [
		{
			heading: 'Paper, ink and line',
			tokens: ['paper', 'ink', 'line', 'paper-2', 'ink-2', 'paper-3', 'ink-3']
		},
		{
			heading: 'Categories and flows',
			tokens: [
				'cat-living',
				'cat-health',
				'cat-mobility',
				'cat-business',
				'cat-nature',
				'cat-living-1',
				'cat-living-2',
				'cat-living-3',
				'cat-living-5',
				'cat-health-1',
				'cat-health-2',
				'cat-health-3',
				'cat-health-5',
				'cat-mobility-1',
				'cat-mobility-2',
				'cat-mobility-3',
				'cat-mobility-5',
				'cat-business-1',
				'cat-business-2',
				'cat-business-3',
				'cat-business-5',
				'cat-nature-1',
				'cat-nature-2',
				'cat-nature-3',
				'cat-nature-5',
				'body-living'
			]
		},
		{
			heading: 'Ground and terrain',
			tokens: [
				'cat-foliage',
				'cat-evergreen',
				'cat-willow',
				'cat-grass',
				'cat-bark',
				'cat-lawn',
				'terrain-soil',
				'ground-stone',
				'ground-sand',
				'ground-sage',
				'ground-clay'
			]
		},
		{
			heading: 'Blueprint, signal and hazard',
			tokens: [
				'blueprint',
				'signal',
				'cat-hazard',
				'blueprint-1',
				'blueprint-2',
				'blueprint-3',
				'blueprint-5',
				'blueprint-soft',
				'signal-1',
				'signal-5',
				'cat-hazard-1',
				'cat-hazard-5'
			]
		},
		{
			heading: 'Analysis tones',
			tokens: [
				'ana-zug',
				'ana-null',
				'ana-druck',
				'ana-zug-2',
				'ana-zug-3',
				'ana-druck-2',
				'ana-druck-3',
				'ana-druck-5'
			]
		}
	];
</script>

<svelte:head>
	<title>Interface · City Design System</title>
</svelte:head>

<main class="page stack">
	<header class="stack">
		<h1>Interface</h1>
		<p class="lead"><code>.lead</code> introduces a page.</p>
	</header>

	<section class="stack">
		<h2>Typography</h2>
		<div class="grid">
			<div class="stack">
				<h3>Text formats</h3>
				<p>Body text uses the plain paragraph.</p>
			</div>
			<div class="stack">
				<p class="small"><code>.small</code> for secondary text</p>
				<p class="caption"><code>.caption</code> for picture captions</p>
			</div>
			<div class="stack">
				<p><code>.label</code> <span class="label">Ground level</span></p>
				<p><code>.data</code> <span class="data">24.0 m</span></p>
			</div>
		</div>
	</section>

	<hr class="divider" />
	<section class="stack">
		<h2>Color</h2>
		{#each palette as group (group.heading)}
			<section class="stack">
				<h3>{group.heading}</h3>
				<div class="grid">
					{#each group.tokens as token (token)}
						<figure>
							<span class="swatch swatch-{token}" aria-hidden="true"></span>
							<figcaption><code>--{token}</code></figcaption>
						</figure>
					{/each}
				</div>
			</section>
		{/each}
	</section>

	<hr class="divider" />
	<section class="stack">
		<h2>Layout</h2>
		<p><code>.page</code> sets this column’s width and gutters.</p>

		<div class="grid">
			<div class="stack">
				<p><code>.stack</code> sets the vertical gap.</p>
				<p>Second item</p>
			</div>
			<div class="panel">
				<p><code>.panel</code> sets the surface.</p>
			</div>
		</div>
		<p class="caption"><code>.grid</code> fits the two examples to the available width.</p>

		<div class="cluster">
			<code>.cluster</code>
			<span>Plan</span>
			<span>Section</span>
			<span>Elevation</span>
			<span>Axonometric view</span>
		</div>

		<figure>
			<div class="frame panel"><code>.frame</code></div>
			<figcaption>The frame holds a picture or canvas at 16:9.</figcaption>
		</figure>

		<hr class="divider" />
		<p class="caption"><code>.divider</code> draws a rule between groups.</p>
	</section>
</main>
