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

{#snippet band(colors: Swatch[], caption?: string, showTokens = false)}
	<figure>
		<div data-color-band>
			{#each colors as [token, role] (token)}
				<span data-tone={token} role="img" aria-label={role} title={'--' + token + ' · ' + role}
				></span>
			{/each}
		</div>
		{#if showTokens}
			<figcaption class="color-band-tokens data" translate="no">
				{#each colors as [token] (token)}
					<span>--{token}</span>
				{/each}
			</figcaption>
		{/if}
		{#if caption}<figcaption>{caption}</figcaption>{/if}
	</figure>
{/snippet}

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
			{@render band(group.colors, undefined, true)}
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
