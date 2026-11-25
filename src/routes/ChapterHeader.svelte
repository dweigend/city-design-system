<script lang="ts">
	let {
		number = '',
		title,
		lead = ''
	}: { number?: string; title: string; lead?: string } = $props();
</script>

<header class="chapter-header stack">
	<div>
		{#if number}
			<p class="label chapter-number">Chapter {number}</p>
		{/if}
		<h1>{title}</h1>
	</div>
	{#if lead}
		<p class="lead">{lead}</p>
	{/if}
</header>
