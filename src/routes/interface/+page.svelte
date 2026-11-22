<script module lang="ts">
	export const lead =
		'The game and the bible share one typeface, flat blocks and fine lines, with one action per view.';
</script>

<script lang="ts">
	import ChapterHeader from '../ChapterHeader.svelte';
	import { chapterAt } from '../chapters';
	import ColorSpecimen from './ColorSpecimen.svelte';
	import ControlsSpecimen from './ControlsSpecimen.svelte';

	const chapter = chapterAt('/interface');
</script>

<svelte:head>
	<title>{chapter.title} · City Design System</title>
</svelte:head>

<ChapterHeader number={chapter.number} title={chapter.title} {lead} />

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

<ControlsSpecimen />
<ColorSpecimen />

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
