<script lang="ts">
	type Swatch = [token: string, role: string];

	const steps = ['Surroundings', 'Surface', 'Volume', 'Network', 'Core'];
	const gray = ['paper-2', 'paper-3', 'line', 'ink-3', 'ink-2'];
	const flows = [
		['People', 'people', 'cat-business'],
		['Water', 'water', 'cat-health'],
		['Energy', 'energy', 'cat-mobility'],
		['Food', 'food', 'cat-nature'],
		['Material', 'material', 'cat-living']
	];

	const paper: Swatch[] = [
		['paper', 'Page background'],
		['paper-2', 'Panel surface'],
		['paper-3', 'Deeper paper'],
		['line', 'Borders and rules'],
		['ink-3', 'Faint ink'],
		['ink-2', 'Secondary text'],
		['ink', 'Primary text']
	];
	const palette: { heading: string; colors: Swatch[] }[] = [
		{
			heading: 'Ground and terrain',
			colors: [
				['terrain-soil', 'Exposed soil'],
				['ground-stone', 'Stone ground'],
				['ground-sand', 'Sandy ground'],
				['ground-sage', 'Sage ground'],
				['ground-clay', 'Clay ground'],
				['body-living', 'New housing'],
				['cat-lawn', 'Lawn surface'],
				['cat-grass', 'Tall grass'],
				['cat-foliage', 'Leaf canopy'],
				['cat-willow', 'Willow canopy'],
				['cat-evergreen', 'Evergreen canopy'],
				['cat-bark', 'Tree bark']
			]
		},
		{
			heading: 'Blueprint, signal and hazard',
			colors: [
				['blueprint-1', 'Planning tint'],
				['blueprint-2', 'Planning surface'],
				['blueprint-3', 'Planning volume'],
				['blueprint', 'Planned work'],
				['blueprint-5', 'Planning shade'],
				['blueprint-soft', 'Planning tint'],
				['signal-1', 'Signal tint'],
				['signal', 'Selection and frame'],
				['signal-5', 'Signal shade'],
				['cat-hazard-1', 'Hazard tint'],
				['cat-hazard', 'Conflict marking'],
				['cat-hazard-5', 'Hazard shade']
			]
		},

		{
			heading: 'Analysis tones',
			colors: [
				['ana-null', 'Neutral load'],
				['ana-zug-2', 'Low tension'],
				['ana-zug-3', 'Medium tension'],
				['ana-zug', 'High tension'],
				['ana-druck-2', 'Low compression'],
				['ana-druck-3', 'Medium compression'],
				['ana-druck', 'High compression'],
				['ana-druck-5', 'Compression shade']
			]
		}
	];
	const opacity: Swatch[] = [
		['alpha-solid', 'Solid · 100%'],
		['alpha-glass', 'Milky · 60%'],
		['alpha-hull', 'Envelope · 30%'],
		['alpha-trace', 'Trace · 12%']
	];
</script>

{#snippet band(colors: Swatch[], caption?: string)}
	<figure>
		<div data-color-band>
			{#each colors as [token, role] (token)}
				<span data-tone={token} role="img" aria-label={role} title={'--' + token + ' · ' + role}
				></span>
			{/each}
		</div>
		{#if caption}<figcaption>{caption}</figcaption>{/if}
	</figure>
{/snippet}

<svelte:head>
	<title>Interface · City Design System</title>
</svelte:head>

<main class="page">
	<header class="stack">
		<h1>Interface</h1>
		<p class="lead">This chapter shows how the design bible uses type, color and layout.</p>
	</header>

	<section class="stack">
		<h2 id="typography">Typography</h2>
		<table aria-labelledby="typography">
			<tbody>
				<tr>
					<th scope="row"><span class="data">h1<br />40/64 px · 1</span></th>
					<td><p data-type-sample="h1">River city</p></td>
				</tr>
				<tr>
					<th scope="row"><span class="data">h2<br />24 px / 1.15</span></th>
					<td><p data-type-sample="h2">Life along the eastern bank</p></td>
				</tr>
				<tr>
					<th scope="row"><span class="data">h3<br />16 px / 1.45</span></th>
					<td><p data-type-sample="h3">A market under the station</p></td>
				</tr>
				<tr>
					<th scope="row"><span class="data">body<br />16 px / 1.45</span></th>
					<td>
						<p>
							The market opens beneath the station before the first tram arrives. Upstream growers
							unload crates by the east stairs. At noon, the stalls fold away and the same passage
							carries people down to the river.
						</p>
					</td>
				</tr>
				<tr>
					<th scope="row"><span class="data">.lead<br />24 px / 1.3</span></th>
					<td><p class="lead">Rail stops link the valley’s hillside homes.</p></td>
				</tr>
				<tr>
					<th scope="row"><span class="data">.small<br />13 px / 1.45</span></th>
					<td><p class="small">High water closes the lower towpath in spring.</p></td>
				</tr>
				<tr>
					<th scope="row"><span class="data">.caption<br />13 px / 1.5</span></th>
					<td><p class="caption">The footbridge crosses the river below the old weir.</p></td>
				</tr>
				<tr>
					<th scope="row"><span class="data">.label<br />11 px / 1.45</span></th>
					<td><p class="label">Upstream water level</p></td>
				</tr>
				<tr>
					<th scope="row"><span class="data">.data<br />11 px / 1.45</span></th>
					<td><p class="data">24.0 m above datum</p></td>
				</tr>
			</tbody>
		</table>
	</section>

	<section class="stack">
		<h2>Color</h2>
		<section>
			<h3>Paper and ink</h3>
			{@render band(paper)}
		</section>

		<section>
			<h3 id="flows">Five flows, five steps</h3>
			<table aria-labelledby="flows" data-color-matrix>
				<thead>
					<tr>
						<th scope="col" aria-label="Flow"><span data-step-name>Flow</span></th>
						{#each steps as name, index (name)}
							<th
								scope="col"
								aria-label={index === 3 ? '4 Network, base tone' : index + 1 + ' ' + name}
							>
								{index + 1}<span data-step-name>&nbsp;{name}</span>
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					<tr>
						<th scope="row">Gray</th>
						{#each gray as token (token)}
							<td data-tone={token} aria-label={'--' + token} title={'--' + token}></td>
						{/each}
					</tr>
					{#each flows as [name, flow, base] (flow)}
						<tr data-flow={flow}>
							<th scope="row">{name}<code translate="no">--{base}</code></th>
							{#each steps as step, index (step)}
								{@const token = '--' + base + (index === 3 ? '' : '-' + (index + 1))}
								<td data-base-tone={index === 3 ? '' : undefined} title={token} aria-label={token}
								></td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</section>

		{#each palette as group (group.heading)}
			<section>
				<h3>{group.heading}</h3>
				{@render band(group.colors)}
			</section>
		{/each}

		<section>
			<h3>Text on color</h3>
			<figure>
				<div data-color-band>
					<span data-text-tone="on-cat" title="--on-cat on Water">Aa</span>
					<span data-text-tone="on-accent" title="--on-accent on Blueprint">Aa</span>
				</div>
				<figcaption>
					<code>--on-cat</code> on Water · <code>--on-accent</code> on Blueprint
				</figcaption>
			</figure>
		</section>

		<section>
			<h3>Opacity</h3>
			{@render band(opacity, 'Solid 100% · Milky 60% · Envelope 30% · Trace 12%')}
		</section>
	</section>

	<section class="stack">
		<h2>Layout</h2>
		<p><code>.page</code> sets the width and gutters of this column.</p>

		<div class="stack">
			<p><code>.stack</code> spaces items vertically.</p>
			<ul>
				<li>Upper terrace</li>
				<li>River path</li>
			</ul>
		</div>

		<p><code>.cluster</code> places items in a wrapping row.</p>
		<div class="cluster">
			<span>Plan</span>
			<span>Section</span>
			<span>Elevation</span>
			<span>Axonometric view</span>
			<span>Street profile</span>
		</div>

		<p><code>.grid</code> fits the two examples below into the available width.</p>
		<div class="grid">
			<div class="panel">
				<p><code>.panel</code> gives content a bordered paper surface.</p>
			</div>
			<figure>
				<div class="frame" aria-hidden="true"><span class="data">16:9</span></div>
				<figcaption><code>.frame</code> holds a picture or canvas at 16:9.</figcaption>
			</figure>
		</div>

		<p><code>.divider</code> draws a rule between groups.</p>
		<hr class="divider" />
	</section>
</main>
